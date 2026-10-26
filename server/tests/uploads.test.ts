import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { prisma } from '../src/prisma';
import { clientFor, createProvider, createUser, resetDatabase } from './helpers';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function fileFor(publicUrl: string): string {
  return path.join(config.uploadDir, path.basename(publicUrl));
}

async function exists(publicUrl: string): Promise<boolean> {
  try {
    await fs.access(fileFor(publicUrl));
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  await resetDatabase();
  await fs.rm(config.uploadDir, { recursive: true, force: true });
});

describe('image uploads', () => {
  it('accepts real image signatures, deletes replaced avatars, and rejects disguised files', async () => {
    const provider = await createProvider({
      email: 'uploads.provider@example.test',
      businessName: 'Upload Test Services',
      categoryIds: [],
      locationIds: [],
    });
    const providerClient = await clientFor(provider.email);

    const first = await providerClient.agent
      .post('/api/providers/me/avatar')
      .set('X-CSRF-Token', providerClient.csrf)
      .attach('avatar', PNG_HEADER, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(200);
    const firstUrl = first.body.data.profileImage as string;
    expect(firstUrl).toMatch(/^\/uploads\/[0-9]+-[0-9a-f-]+\.png$/);
    expect(await exists(firstUrl)).toBe(true);

    const second = await providerClient.agent
      .post('/api/providers/me/avatar')
      .set('X-CSRF-Token', providerClient.csrf)
      .attach('avatar', JPEG_HEADER, { filename: 'avatar.jpg', contentType: 'image/jpeg' })
      .expect(200);
    const secondUrl = second.body.data.profileImage as string;
    expect(secondUrl).toMatch(/^\/uploads\/[0-9]+-[0-9a-f-]+\.jpg$/);
    expect(secondUrl).not.toBe(firstUrl);
    expect(await exists(firstUrl)).toBe(false);
    expect(await exists(secondUrl)).toBe(true);

    const disguised = await providerClient.agent
      .post('/api/providers/me/avatar')
      .set('X-CSRF-Token', providerClient.csrf)
      .attach('avatar', Buffer.from('this is not an image at all'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(disguised.body.error.code).toBe('INVALID_FILE');

    const wrongType = await providerClient.agent
      .post('/api/providers/me/avatar')
      .set('X-CSRF-Token', providerClient.csrf)
      .attach('avatar', Buffer.from('%PDF-1.4'), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(wrongType.body.error.code).toBe('INVALID_FILE');

    const profile = await prisma.providerProfile.findUniqueOrThrow({ where: { id: provider.id } });
    expect(profile.profileImage).toBe(secondUrl);
  });

  it('creates and removes portfolio images and enforces the 12-image limit', async () => {
    const provider = await createProvider({
      email: 'portfolio.provider@example.test',
      businessName: 'Portfolio Test Services',
      categoryIds: [],
      locationIds: [],
    });
    const providerClient = await clientFor(provider.email);

    const uploaded = await providerClient.agent
      .post('/api/providers/me/portfolio')
      .set('X-CSRF-Token', providerClient.csrf)
      .field('caption', 'Finished a kitchen pipe replacement in Malolos.')
      .attach('image', PNG_HEADER, { filename: 'work.png', contentType: 'image/png' })
      .expect(201);

    const image = uploaded.body.data.portfolioImages[0] as { id: string; imageUrl: string; caption: string };
    expect(image.caption).toContain('Malolos');
    expect(await exists(image.imageUrl)).toBe(true);

    await providerClient.del(`/api/providers/me/portfolio/${image.id}`).expect(200);
    expect(await exists(image.imageUrl)).toBe(false);
    expect(
      await prisma.portfolioImage.count({ where: { providerId: provider.id } }),
    ).toBe(0);

    for (let index = 0; index < 12; index += 1) {
      await prisma.portfolioImage.create({
        data: {
          providerId: provider.id,
          imageUrl: `/uploads/${Date.now()}-00000000-0000-4000-8000-00000000000${index % 10}.png`,
          caption: `Seed portfolio slot ${index + 1}`,
        },
      });
    }

    const overLimit = await providerClient.agent
      .post('/api/providers/me/portfolio')
      .set('X-CSRF-Token', providerClient.csrf)
      .attach('image', PNG_HEADER, { filename: 'extra.png', contentType: 'image/png' })
      .expect(409);
    expect(overLimit.body.error.code).toBe('PORTFOLIO_LIMIT');
  });

  it('blocks customers from provider image endpoints', async () => {
    await createUser({ email: 'uploads.customer@example.test' });
    const customerClient = await clientFor('uploads.customer@example.test');

    await customerClient.agent
      .post('/api/providers/me/avatar')
      .set('X-CSRF-Token', customerClient.csrf)
      .attach('avatar', PNG_HEADER, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(403);

    await customerClient.agent
      .post('/api/providers/me/portfolio')
      .set('X-CSRF-Token', customerClient.csrf)
      .attach('image', PNG_HEADER, { filename: 'work.png', contentType: 'image/png' })
      .expect(403);
  });
});

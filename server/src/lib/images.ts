import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config';

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function extensionFor(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (startsWith(buffer, JPEG)) return 'jpg';
  if (startsWith(buffer, PNG)) return 'png';
  if (startsWith(buffer, RIFF) && buffer.subarray(8, 12).equals(Buffer.from(WEBP))) return 'webp';
  return null;
}

/**
 * Validates the magic bytes (not just the client-supplied MIME type),
 * writes a random filename, and returns its public URL.
 */
export async function storeImage(buffer: Buffer): Promise<string> {
  const extension = extensionFor(buffer);
  if (!extension) {
    throw new Error('UNSUPPORTED_IMAGE');
  }
  await fs.mkdir(config.uploadDir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  await fs.writeFile(path.join(config.uploadDir, filename), buffer, { flag: 'wx' });
  return `/uploads/${filename}`;
}

/** Deletes only files created inside the configured upload directory. */
export async function deleteStoredImage(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl || !publicUrl.startsWith('/uploads/')) return;
  const filename = path.basename(publicUrl);
  if (!/^[0-9]+-[0-9a-f-]+\.(jpg|png|webp)$/i.test(filename)) return;
  const target = path.join(config.uploadDir, filename);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(config.uploadDir) + path.sep)) return;
  try {
    await fs.unlink(resolved);
  } catch {
    // The file may already be gone; nothing else to do.
  }
}

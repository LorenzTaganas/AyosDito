import { Router } from 'express';
import { asyncHandler, notFound, parseId } from '../lib/http';
import { toLocationRef } from '../lib/serialize';
import type { CategoryDto } from '../../../shared/api-types';
import { prisma } from '../prisma';

export const catalogRouter = Router();

const LOCATION_TYPE_ORDER: Record<string, number> = {
  REGION: 0,
  PROVINCE: 1,
  CITY: 2,
  BARANGAY: 3,
};

async function providerCountForCategory(categoryId: string): Promise<number> {
  return prisma.providerProfile.count({
    where: {
      approvalStatus: 'APPROVED',
      user: { accountStatus: 'ACTIVE', role: 'PROVIDER' },
      listings: { some: { isActive: true, categoryId } },
    },
  });
}

async function serializeCategory(category: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}): Promise<CategoryDto> {
  return {
    ...category,
    providerCount: await providerCountForCategory(category.id),
  };
}

catalogRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const data = await Promise.all(categories.map(serializeCategory));
    res.json({ data });
  }),
);

catalogRouter.get(
  '/categories/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug ?? '');
    if (!slug || slug.length > 80) throw notFound('Category not found.');
    const category = await prisma.category.findFirst({ where: { slug, isActive: true } });
    if (!category) throw notFound('Category not found.');
    res.json({ data: await serializeCategory(category) });
  }),
);

catalogRouter.get(
  '/locations',
  asyncHandler(async (_req, res) => {
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      include: { parent: true },
    });
    locations.sort((a, b) => {
      const typeDiff = (LOCATION_TYPE_ORDER[a.locationType] ?? 9) - (LOCATION_TYPE_ORDER[b.locationType] ?? 9);
      if (typeDiff !== 0) return typeDiff;
      return a.name.localeCompare(b.name);
    });
    res.json({ data: locations.map(toLocationRef) });
  }),
);

catalogRouter.get(
  '/locations/:id/children',
  asyncHandler(async (req, res) => {
    const parentId = parseId(req.params.id, 'location');
    const parent = await prisma.location.findUnique({ where: { id: parentId }, select: { id: true } });
    if (!parent) throw notFound('Location not found.');
    const children = await prisma.location.findMany({
      where: { parentLocationId: parentId, isActive: true },
      include: { parent: true },
      orderBy: { name: 'asc' },
    });
    res.json({ data: children.map(toLocationRef) });
  }),
);

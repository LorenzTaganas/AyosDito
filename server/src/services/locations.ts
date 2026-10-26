import { prisma } from '../prisma';

interface LocationRow {
  id: string;
  parentLocationId: string | null;
}

/**
 * Returns the selected location, all of its ancestors, and all of its
 * descendants. This makes search and request matching work in both
 * directions: a provider covering a city is relevant to a barangay request,
 * and a provider covering a barangay is discoverable when a customer picks
 * the city.
 */
export async function expandRelatedLocationIds(locationIds: string[]): Promise<Set<string>> {
  const rows = await prisma.location.findMany({ select: { id: true, parentLocationId: true } });
  const byId = new Map<string, LocationRow>(rows.map((row) => [row.id, row]));
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentLocationId) continue;
    const siblings = children.get(row.parentLocationId) ?? [];
    siblings.push(row.id);
    children.set(row.parentLocationId, siblings);
  }

  const result = new Set<string>();
  for (const locationId of locationIds) {
    if (!byId.has(locationId)) continue;
    result.add(locationId);

    let cursor = byId.get(locationId)?.parentLocationId ?? null;
    while (cursor && byId.has(cursor)) {
      result.add(cursor);
      cursor = byId.get(cursor)?.parentLocationId ?? null;
    }

    const queue = [...(children.get(locationId) ?? [])];
    while (queue.length > 0) {
      const childId = queue.shift()!;
      if (result.has(childId)) continue;
      result.add(childId);
      queue.push(...(children.get(childId) ?? []));
    }
  }
  return result;
}

export async function getActiveLocation(locationId: string) {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: { parent: true },
  });
  return location && location.isActive ? location : null;
}

export const LOCATION_PARENT_TYPES: Record<string, string[] | null> = {
  REGION: null,
  PROVINCE: ['REGION'],
  CITY: ['REGION', 'PROVINCE'],
  BARANGAY: ['CITY'],
};

export function childTypeAllowed(parentType: string, childType: string): boolean {
  const allowedParents = LOCATION_PARENT_TYPES[childType];
  return Boolean(allowedParents && allowedParents.includes(parentType));
}

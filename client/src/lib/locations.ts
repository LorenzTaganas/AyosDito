import type { LocationDto, LocationRef } from '@shared/api-types';

export interface LocationOption {
  id: string;
  label: string;
  group: string;
}

const TYPE_ORDER: Record<LocationRef['locationType'], number> = {
  REGION: 0,
  PROVINCE: 1,
  CITY: 2,
  BARANGAY: 3,
};

export const LOCATION_TYPE_LABELS: Record<LocationRef['locationType'], string> = {
  REGION: 'Region',
  PROVINCE: 'Province',
  CITY: 'City or municipality',
  BARANGAY: 'Barangay',
};

/**
 * The API exposes a flat active-location list with parent names. Grouping it by
 * type keeps the native select usable on mobile while preserving the hierarchy
 * in each label.
 */
export function buildLocationOptions(locations: LocationDto[] | LocationRef[]): LocationOption[] {
  return [...locations]
    .sort((a, b) => {
      const typeDiff = TYPE_ORDER[a.locationType] - TYPE_ORDER[b.locationType];
      if (typeDiff !== 0) return typeDiff;
      return a.name.localeCompare(b.name);
    })
    .map((location) => ({
      id: location.id,
      label: location.parentName ? `${location.name} · ${location.parentName}` : location.name,
      group: LOCATION_TYPE_LABELS[location.locationType],
    }));
}

export function groupLocationOptions(options: LocationOption[]): Array<[string, LocationOption[]]> {
  const groups = new Map<string, LocationOption[]>();
  for (const option of options) {
    const rows = groups.get(option.group) ?? [];
    rows.push(option);
    groups.set(option.group, rows);
  }
  return [...groups.entries()];
}

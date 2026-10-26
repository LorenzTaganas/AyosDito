import type { LocationRef } from '@shared/api-types';
import type { PriceType } from '@shared/contracts';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pesoWithCents = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Money is stored as integer centavos. */
export function formatPeso(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '—';
  return centavos % 100 === 0 ? peso.format(centavos / 100) : pesoWithCents.format(centavos / 100);
}

export function formatPesosInput(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '';
  return String(centavos / 100);
}

export function pesosToCentavos(value: string | number): number | null {
  if (value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value.replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function locationLabel(location: Pick<LocationRef, 'name' | 'parentName'>): string {
  return location.parentName ? `${location.name}, ${location.parentName}` : location.name;
}

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  STARTING_FROM: 'Starting from',
  ESTIMATE: 'Estimated',
  FIXED: 'Fixed price',
};

export function priceTypeLabel(type: PriceType): string {
  return PRICE_TYPE_LABELS[type];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function dashboardPath(role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN'): string {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'PROVIDER') return '/provider/dashboard';
  return '/customer/dashboard';
}

export function safeNextPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function truncate(value: string | null | undefined, length = 160): string {
  if (!value) return '';
  if (value.length <= length) return value;
  return `${value.slice(0, length).trimEnd()}…`;
}

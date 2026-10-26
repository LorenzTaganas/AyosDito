import { describe, expect, it } from 'vitest';
import {
  dashboardPath,
  formatDate,
  formatDateTime,
  formatPeso,
  formatPesosInput,
  initials,
  locationLabel,
  pesosToCentavos,
  pluralize,
  priceTypeLabel,
  safeNextPath,
  truncate,
} from './format';

describe('formatPeso', () => {
  it('formats whole pesos without decimals', () => {
    expect(formatPeso(150000)).toBe('₱1,500');
    expect(formatPeso(0)).toBe('₱0');
  });

  it('keeps centavos when the amount is not a whole peso', () => {
    expect(formatPeso(123450)).toBe('₱1,234.50');
    expect(formatPeso(1)).toBe('₱0.01');
  });

  it('uses an em dash for unknown prices', () => {
    expect(formatPeso(null)).toBe('—');
    expect(formatPeso(undefined)).toBe('—');
  });
});

describe('money input helpers', () => {
  it('converts whole and comma-separated peso input to centavos', () => {
    expect(pesosToCentavos('1,250.50')).toBe(125050);
    expect(pesosToCentavos('19.99')).toBe(1999);
    expect(pesosToCentavos(250)).toBe(25000);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(pesosToCentavos('')).toBeNull();
    expect(pesosToCentavos('not a price')).toBeNull();
  });

  it('shows centavos as a peso amount for editing', () => {
    expect(formatPesosInput(125050)).toBe('1250.5');
    expect(formatPesosInput(null)).toBe('');
  });
});

describe('date formatting', () => {
  it('formats local dates consistently', () => {
    expect(formatDate('2026-10-26T12:00:00')).toBe('Oct 26, 2026');
    expect(formatDateTime('2026-10-26T14:05:00')).toMatch(/Oct 26, 2026/);
  });

  it('returns an em dash for missing dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });
});

describe('display helpers', () => {
  it('pluralizes counts', () => {
    expect(pluralize(1, 'request')).toBe('1 request');
    expect(pluralize(0, 'request')).toBe('0 requests');
    expect(pluralize(2, 'city', 'cities')).toBe('2 cities');
  });

  it('derives initials from a name', () => {
    expect(initials('Maria Santos')).toBe('MS');
    expect(initials('Jose')).toBe('JO');
    expect(initials('  ')).toBe('?');
  });

  it('labels a location with an optional parent', () => {
    expect(locationLabel({ name: 'Guinhawa', parentName: 'City of Malolos' })).toBe(
      'Guinhawa, City of Malolos',
    );
    expect(locationLabel({ name: 'Bulacan', parentName: null })).toBe('Bulacan');
  });

  it('maps price types to readable labels', () => {
    expect(priceTypeLabel('STARTING_FROM')).toBe('Starting from');
    expect(priceTypeLabel('FIXED')).toBe('Fixed price');
  });

  it('truncates long text at a word boundary', () => {
    expect(truncate('short text', 30)).toBe('short text');
    expect(truncate('The quick brown fox jumps over the lazy dog', 20)).toBe('The quick brown fox…');
    expect(truncate(null)).toBe('');
  });
});

describe('navigation helpers', () => {
  it('maps each role to its dashboard', () => {
    expect(dashboardPath('CUSTOMER')).toBe('/customer/dashboard');
    expect(dashboardPath('PROVIDER')).toBe('/provider/dashboard');
    expect(dashboardPath('ADMIN')).toBe('/admin/dashboard');
  });

  it('only accepts same-origin relative next paths', () => {
    expect(safeNextPath('/customer/requests?page=2')).toBe('/customer/requests?page=2');
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

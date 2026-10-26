import { describe, expect, it } from 'vitest';
import { LOCATION_TYPES } from '@shared/contracts';
import {
  LOCATION_PARENT_TYPES,
  auditActionLabel,
  errorMessage,
  humanizeKey,
  parseAdminFilter,
} from './admin';

describe('auditActionLabel', () => {
  it('uses the written label for known actions', () => {
    expect(auditActionLabel('provider.approved')).toBe('Provider application approved');
    expect(auditActionLabel('verification.rejected')).toBe('Verification rejected');
    expect(auditActionLabel('report.resolved')).toBe('Report closed');
  });

  it('falls back to a humanized action key for new actions', () => {
    expect(auditActionLabel('listing.price_changed')).toBe('Listing price changed');
    expect(auditActionLabel('custom')).toBe('Custom');
  });
});

describe('parseAdminFilter', () => {
  it('accepts values on the allowlist', () => {
    expect(parseAdminFilter('PENDING', ['PENDING', 'APPROVED'] as const)).toBe('PENDING');
    expect(parseAdminFilter('REGION', LOCATION_TYPES)).toBe('REGION');
  });

  it('falls back to ALL for missing or unknown values', () => {
    expect(parseAdminFilter(null, LOCATION_TYPES)).toBe('ALL');
    expect(parseAdminFilter('DROP TABLE', LOCATION_TYPES)).toBe('ALL');
  });
});

describe('humanizeKey', () => {
  it('turns camelCase and snake_case keys into readable words', () => {
    expect(humanizeKey('providerId')).toBe('provider id');
    expect(humanizeKey('previous_status')).toBe('previous status');
    expect(humanizeKey('review-note')).toBe('review note');
  });
});

describe('errorMessage', () => {
  it('prefers a real error message', () => {
    expect(errorMessage(new Error('Server said no.'), 'Fallback')).toBe('Server said no.');
  });

  it('falls back for unknown or blank errors', () => {
    expect(errorMessage('nope', 'Fallback')).toBe('Fallback');
    expect(errorMessage(new Error(''), 'Fallback')).toBe('Fallback');
  });
});

describe('location hierarchy rules', () => {
  it('restricts parents by place type', () => {
    expect(LOCATION_PARENT_TYPES.REGION).toEqual([]);
    expect(LOCATION_PARENT_TYPES.PROVINCE).toEqual(['REGION']);
    expect(LOCATION_PARENT_TYPES.CITY).toEqual(['REGION', 'PROVINCE']);
    expect(LOCATION_PARENT_TYPES.BARANGAY).toEqual(['CITY']);
  });
});

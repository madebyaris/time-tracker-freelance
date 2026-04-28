import { describe, expect, it } from 'vitest';
import { centsToRateOverride, rateOverrideToCents } from './rate';

describe('rateOverrideToCents', () => {
  it('returns null for empty/whitespace input', () => {
    expect(rateOverrideToCents('')).toBeNull();
    expect(rateOverrideToCents('   ')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(rateOverrideToCents('abc')).toBeNull();
    expect(rateOverrideToCents('1.2.3')).toBeNull();
  });

  it('returns null for non-positive values', () => {
    expect(rateOverrideToCents('0')).toBeNull();
    expect(rateOverrideToCents('-5')).toBeNull();
  });

  it('rounds to nearest cent', () => {
    expect(rateOverrideToCents('12.50')).toBe(1250);
    expect(rateOverrideToCents('12.345')).toBe(1235);
    expect(rateOverrideToCents('12.344')).toBe(1234);
  });

  it('handles integers', () => {
    expect(rateOverrideToCents('100')).toBe(10000);
  });
});

describe('centsToRateOverride', () => {
  it('returns empty string for null', () => {
    expect(centsToRateOverride(null)).toBe('');
  });

  it('formats with 2 decimals', () => {
    expect(centsToRateOverride(1250)).toBe('12.50');
    expect(centsToRateOverride(10000)).toBe('100.00');
    expect(centsToRateOverride(1)).toBe('0.01');
  });

  it('round-trips with rateOverrideToCents', () => {
    for (const cents of [1, 50, 1250, 9999, 100000]) {
      expect(rateOverrideToCents(centsToRateOverride(cents))).toBe(cents);
    }
  });
});

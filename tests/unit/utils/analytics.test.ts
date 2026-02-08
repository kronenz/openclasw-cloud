import { describe, it, expect } from 'vitest';
import { calculateUsageTrend } from '../../../src/utils/analytics.js';

describe('calculateUsageTrend', () => {
  it('returns stable for empty array', () => {
    expect(calculateUsageTrend([])).toBe('stable');
  });

  it('returns stable for single value', () => {
    expect(calculateUsageTrend([100])).toBe('stable');
  });

  it('returns stable for steady values', () => {
    const steadyValues = Array.from({ length: 10 }, () => 1000);
    expect(calculateUsageTrend(steadyValues)).toBe('stable');
  });

  it('returns increasing when second half is 20%+ higher', () => {
    // First half: avg = 1000, second half: avg = 1500 (50% increase > 20%)
    const values = [
      ...Array.from({ length: 5 }, () => 1000),
      ...Array.from({ length: 5 }, () => 1500),
    ];
    expect(calculateUsageTrend(values)).toBe('increasing');
  });

  it('returns decreasing when second half is 20%+ lower', () => {
    // First half: avg = 1000, second half: avg = 500 (50% decrease > 20%)
    const values = [
      ...Array.from({ length: 5 }, () => 1000),
      ...Array.from({ length: 5 }, () => 500),
    ];
    expect(calculateUsageTrend(values)).toBe('decreasing');
  });

  it('returns stable for borderline values (exactly at 20% boundary - increasing)', () => {
    // First half: avg = 1000, second half: avg = 1200 (exactly 20% increase)
    // secondAvg (1200) should equal firstAvg * 1.2 (1200), so stable
    const values = [
      ...Array.from({ length: 5 }, () => 1000),
      ...Array.from({ length: 5 }, () => 1200),
    ];
    expect(calculateUsageTrend(values)).toBe('stable');
  });

  it('returns stable for borderline values (exactly at 20% boundary - decreasing)', () => {
    // First half: avg = 1000, second half: avg = 800 (exactly 20% decrease)
    // secondAvg (800) should equal firstAvg * 0.8 (800), so stable
    const values = [
      ...Array.from({ length: 5 }, () => 1000),
      ...Array.from({ length: 5 }, () => 800),
    ];
    expect(calculateUsageTrend(values)).toBe('stable');
  });

  it('returns stable for all zeros', () => {
    const allZeros = Array.from({ length: 10 }, () => 0);
    expect(calculateUsageTrend(allZeros)).toBe('stable');
  });

  it('returns increasing when first half is zero and second half is positive', () => {
    const values = [
      ...Array.from({ length: 5 }, () => 0),
      ...Array.from({ length: 5 }, () => 1000),
    ];
    expect(calculateUsageTrend(values)).toBe('increasing');
  });

  it('handles odd-length arrays correctly', () => {
    // 7 values: first 3 (avg=1000), last 4 (avg=1500)
    const values = [1000, 1000, 1000, 1500, 1500, 1500, 1500];
    expect(calculateUsageTrend(values)).toBe('increasing');
  });

  it('returns stable when second half is slightly higher (below 20% threshold)', () => {
    // First half: avg = 1000, second half: avg = 1100 (10% increase)
    const values = [
      ...Array.from({ length: 5 }, () => 1000),
      ...Array.from({ length: 5 }, () => 1100),
    ];
    expect(calculateUsageTrend(values)).toBe('stable');
  });

  it('returns stable when second half is slightly lower (below 20% threshold)', () => {
    // First half: avg = 1000, second half: avg = 900 (10% decrease)
    const values = [
      ...Array.from({ length: 5 }, () => 1000),
      ...Array.from({ length: 5 }, () => 900),
    ];
    expect(calculateUsageTrend(values)).toBe('stable');
  });

  it('handles two values correctly', () => {
    // First half: [1000], second half: [1500]
    expect(calculateUsageTrend([1000, 1500])).toBe('increasing');

    // First half: [1500], second half: [1000]
    expect(calculateUsageTrend([1500, 1000])).toBe('decreasing');

    // First half: [1000], second half: [1100] (10% increase)
    expect(calculateUsageTrend([1000, 1100])).toBe('stable');
  });

  it('returns stable when first half is zero and second half is also zero', () => {
    const values = [
      ...Array.from({ length: 5 }, () => 0),
      ...Array.from({ length: 5 }, () => 0),
    ];
    expect(calculateUsageTrend(values)).toBe('stable');
  });

  it('handles mixed zero and non-zero values in first half', () => {
    // First half avg: (0+0+0+0+1000)/5 = 200
    // Second half avg: (500+500+500+500+500)/5 = 500
    // 500 > 200 * 1.2 (240), so increasing
    const values = [0, 0, 0, 0, 1000, 500, 500, 500, 500, 500];
    expect(calculateUsageTrend(values)).toBe('increasing');
  });
});

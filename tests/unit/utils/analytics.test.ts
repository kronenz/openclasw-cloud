import { describe, it, expect } from 'vitest';
import { calculateUsageTrend, aggregateTokenUsage } from '../../../src/utils/analytics.js';

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

describe('aggregateTokenUsage', () => {
  it('returns 0 for empty array', () => {
    expect(aggregateTokenUsage([])).toBe(0);
  });

  it('returns value for single record', () => {
    const records = [{ total_tokens: 1000 }];
    expect(aggregateTokenUsage(records)).toBe(1000);
  });

  it('aggregates last 7 days (default window)', () => {
    const records = Array.from({ length: 14 }, (_, i) => ({
      total_tokens: 100,
    }));
    // Last 7 days: 7 * 100 = 700
    expect(aggregateTokenUsage(records)).toBe(700);
  });

  it('aggregates previous week (fromEnd=7)', () => {
    const records = Array.from({ length: 14 }, (_, i) => ({
      total_tokens: i < 7 ? 100 : 200,
    }));
    // Days 7-13 (fromEnd=7, windowSize=7): 7 * 100 = 700
    expect(aggregateTokenUsage(records, 7)).toBe(700);
  });

  it('handles fromEnd larger than array length', () => {
    const records = [
      { total_tokens: 100 },
      { total_tokens: 200 },
      { total_tokens: 300 },
    ];
    // fromEnd=10, windowSize=7: should clamp to available records
    expect(aggregateTokenUsage(records, 10)).toBe(0);
  });

  it('handles records with null total_tokens', () => {
    const records = [
      { total_tokens: 100 },
      { total_tokens: null as any },
      { total_tokens: 200 },
      { total_tokens: undefined as any },
      { total_tokens: 300 },
    ];
    // Should treat null/undefined as 0: 100 + 0 + 200 + 0 + 300 = 600
    expect(aggregateTokenUsage(records)).toBe(600);
  });

  it('handles window of 1 day', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      total_tokens: (i + 1) * 100,
    }));
    // Last 1 day: 1000 (the last record)
    expect(aggregateTokenUsage(records, 0, 1)).toBe(1000);
  });

  it('handles window exactly matching array length', () => {
    const records = [
      { total_tokens: 100 },
      { total_tokens: 200 },
      { total_tokens: 300 },
    ];
    expect(aggregateTokenUsage(records, 0, 3)).toBe(600);
  });

  it('handles window larger than array length', () => {
    const records = [
      { total_tokens: 100 },
      { total_tokens: 200 },
    ];
    // Window of 10 but only 2 records: should sum all 2
    expect(aggregateTokenUsage(records, 0, 10)).toBe(300);
  });

  it('handles fromEnd=0 windowSize=3 for last 3 days', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      total_tokens: (i + 1) * 100,
    }));
    // Last 3 days: 800 + 900 + 1000 = 2700
    expect(aggregateTokenUsage(records, 0, 3)).toBe(2700);
  });

  it('handles middle window slice', () => {
    const records = Array.from({ length: 20 }, (_, i) => ({
      total_tokens: (i + 1) * 10,
    }));
    // fromEnd=10, windowSize=5: indices 5-9 (values 60,70,80,90,100)
    // 60 + 70 + 80 + 90 + 100 = 400
    expect(aggregateTokenUsage(records, 10, 5)).toBe(400);
  });

  it('returns 0 when fromEnd equals array length', () => {
    const records = [
      { total_tokens: 100 },
      { total_tokens: 200 },
      { total_tokens: 300 },
    ];
    // fromEnd=3: start from beginning, windowSize=7
    // Since we skip the last 3, nothing is included
    expect(aggregateTokenUsage(records, 3)).toBe(0);
  });

  it('handles all zero tokens', () => {
    const records = Array.from({ length: 7 }, () => ({
      total_tokens: 0,
    }));
    expect(aggregateTokenUsage(records)).toBe(0);
  });
});

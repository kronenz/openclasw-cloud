import { TREND_INCREASE_MULTIPLIER, TREND_DECREASE_MULTIPLIER } from '../config/constants.js';

export type UsageTrend = 'increasing' | 'decreasing' | 'stable';

/**
 * Calculate usage trend by comparing first half average vs second half average.
 * @param values Array of numeric values (e.g., daily token counts)
 * @returns 'increasing' if second half is 20%+ higher, 'decreasing' if 20%+ lower, 'stable' otherwise
 */
export function calculateUsageTrend(values: number[]): UsageTrend {
  if (values.length < 2) return 'stable';

  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

  if (firstAvg === 0) return secondAvg > 0 ? 'increasing' : 'stable';

  if (secondAvg > firstAvg * TREND_INCREASE_MULTIPLIER) return 'increasing';
  if (secondAvg < firstAvg * TREND_DECREASE_MULTIPLIER) return 'decreasing';
  return 'stable';
}

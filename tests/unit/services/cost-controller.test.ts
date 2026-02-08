import { describe, it, expect } from 'vitest';
import { CostController } from '../../../src/services/cost-controller.js';

// Test calculateCost and getDowngradeModel without needing env bindings
describe('CostController', () => {
  // Create a minimal mock for unit testing pure functions
  const controller = new CostController({} as any);

  describe('calculateCost', () => {
    it('calculates opus cost correctly', () => {
      // 1000 input + 1000 output tokens
      const cost = controller.calculateCost('opus', 1000, 1000);
      // (1000/1000) * 0.015 + (1000/1000) * 0.075 = 0.015 + 0.075 = 0.09
      expect(cost).toBeCloseTo(0.09);
    });

    it('calculates sonnet cost correctly', () => {
      const cost = controller.calculateCost('sonnet', 1000, 1000);
      // (1) * 0.003 + (1) * 0.015 = 0.018
      expect(cost).toBeCloseTo(0.018);
    });

    it('calculates haiku cost correctly', () => {
      const cost = controller.calculateCost('haiku', 1000, 1000);
      // (1) * 0.00025 + (1) * 0.00125 = 0.0015
      expect(cost).toBeCloseTo(0.0015);
    });

    it('calculates flash cost correctly', () => {
      const cost = controller.calculateCost('flash', 1000, 1000);
      // (1) * 0.0001 + (1) * 0.0005 = 0.0006
      expect(cost).toBeCloseTo(0.0006);
    });

    it('handles zero tokens', () => {
      expect(controller.calculateCost('opus', 0, 0)).toBe(0);
    });

    it('handles large token counts', () => {
      const cost = controller.calculateCost('haiku', 1_000_000, 500_000);
      expect(cost).toBeGreaterThan(0);
    });

    it('falls back to haiku pricing for unknown models', () => {
      const cost = controller.calculateCost('unknown-model', 1000, 1000);
      const haikuCost = controller.calculateCost('haiku', 1000, 1000);
      expect(cost).toBe(haikuCost);
    });
  });

  describe('getDowngradeModel', () => {
    it('downgrades opus to sonnet', () => {
      expect(controller.getDowngradeModel('opus')).toBe('sonnet');
    });

    it('downgrades sonnet to haiku', () => {
      expect(controller.getDowngradeModel('sonnet')).toBe('haiku');
    });

    it('downgrades haiku to flash', () => {
      expect(controller.getDowngradeModel('haiku')).toBe('flash');
    });

    it('keeps flash as flash (lowest tier)', () => {
      expect(controller.getDowngradeModel('flash')).toBe('flash');
    });

    it('returns flash for unknown models', () => {
      expect(controller.getDowngradeModel('unknown')).toBe('flash');
    });
  });
});

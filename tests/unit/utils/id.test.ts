import { describe, it, expect } from 'vitest';
import {
  generateId,
  generateTenantId,
  generateResourceId,
  generateIncidentId,
  generateSubscriptionId,
  generateSubdomain,
} from '../../../src/utils/id.js';

describe('ID Generation', () => {
  it('generates UUID without prefix', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates ID with prefix', () => {
    const id = generateId('test');
    expect(id).toMatch(/^test_[0-9a-f]{8}-/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('generates tenant ID with tn_ prefix', () => {
    const id = generateTenantId();
    expect(id).toMatch(/^tn_/);
  });

  it('generates resource ID with res_ prefix', () => {
    const id = generateResourceId();
    expect(id).toMatch(/^res_/);
  });

  it('generates incident ID with inc_ prefix', () => {
    const id = generateIncidentId();
    expect(id).toMatch(/^inc_/);
  });

  it('generates subscription ID with sub_ prefix', () => {
    const id = generateSubscriptionId();
    expect(id).toMatch(/^sub_/);
  });
});

describe('Subdomain Generation', () => {
  it('converts name to lowercase kebab-case', () => {
    expect(generateSubdomain('My Coffee Shop')).toBe('my-coffee-shop');
  });

  it('removes special characters', () => {
    expect(generateSubdomain('Café & Bar!')).toBe('caf-bar');
  });

  it('truncates to 32 characters', () => {
    const longName = 'A'.repeat(50);
    expect(generateSubdomain(longName).length).toBeLessThanOrEqual(32);
  });

  it('returns "tenant" for empty input', () => {
    expect(generateSubdomain('')).toBe('tenant');
  });

  it('handles Korean characters', () => {
    const subdomain = generateSubdomain('카페 라떼');
    expect(subdomain).toBe('카페-라떼');
  });

  it('strips leading and trailing hyphens', () => {
    expect(generateSubdomain('--test--')).toBe('test');
  });
});

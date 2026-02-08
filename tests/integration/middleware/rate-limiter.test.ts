import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-chars!';

// Mock KV for rate limiter tests
class MockKV {
  private store = new Map<string, { value: string; expiration: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiration > 0 && Date.now() > item.expiration) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiration = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : 0;
    this.store.set(key, { value, expiration });
  }

  clear() {
    this.store.clear();
  }
}

describe('Rate Limiter Middleware', () => {
  let mockCache: MockKV;

  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
    mockCache = new MockKV();
    (env as any).CACHE = mockCache;
  });

  beforeEach(() => {
    mockCache.clear();
  });

  it('allows request when under limit', async () => {
    const validToken = await createJWT(
      { sub: 'tn_ratelimit-1', role: 'tenant' },
      JWT_SECRET,
      3600
    );

    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${validToken}`,
      },
    }, env);

    // Should not be rate limited
    expect(res.status).not.toBe(429);

    // Check rate limit headers
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
  });

  it('returns 429 when rate limit exceeded', async () => {
    const validToken = await createJWT(
      { sub: 'tn_ratelimit-2', role: 'tenant' },
      JWT_SECRET,
      3600
    );

    // Make 100 requests to hit the limit
    for (let i = 0; i < 100; i++) {
      await app.request('/api/tenants', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${validToken}`,
        },
      }, env);
    }

    // 101st request should be rate limited
    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${validToken}`,
      },
    }, env);

    expect(res.status).toBe(429);
    const json = await res.json() as any;
    expect(json).toEqual({
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  });

  it('sets X-RateLimit-Limit and X-RateLimit-Remaining headers', async () => {
    const validToken = await createJWT(
      { sub: 'tn_ratelimit-3', role: 'tenant' },
      JWT_SECRET,
      3600
    );

    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${validToken}`,
      },
    }, env);

    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
  });

  it('skips rate limiting when no tenantId', async () => {
    // Health endpoint doesn't have auth and therefore no tenantId
    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    expect(res.status).not.toBe(429);
    expect(res.status).toBe(200);
  });

  it('allows request on cache failure (graceful degradation)', async () => {
    // Create a mock that throws on get
    const failingCache = {
      get: async () => {
        throw new Error('Cache error');
      },
      put: async () => {
        throw new Error('Cache error');
      },
    };

    (env as any).CACHE = failingCache;

    const validToken = await createJWT(
      { sub: 'tn_ratelimit-4', role: 'tenant' },
      JWT_SECRET,
      3600
    );

    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${validToken}`,
      },
    }, env);

    // Should not fail due to cache error
    expect(res.status).not.toBe(500);
    expect(res.status).not.toBe(429);

    // Restore mock cache
    (env as any).CACHE = mockCache;
  });
});

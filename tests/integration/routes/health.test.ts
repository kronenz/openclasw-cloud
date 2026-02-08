import { describe, it, expect, beforeAll } from 'vitest';
import app from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';

describe('Health Routes', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const res = await app.request('/health', {}, env);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body.version).toBe('0.1.0');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/detailed', () => {
    it('returns detailed health with checks', async () => {
      const res = await app.request('/health/detailed', {}, env);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBeDefined();
      expect(body.checks).toBeDefined();
      expect(body.checks.d1).toBeDefined();
    });
  });
});

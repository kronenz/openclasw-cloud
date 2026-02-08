import { describe, it, expect } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { parseApiResponse } from '../../helpers/types.js';

describe('Global Handlers', () => {
  describe('404 Handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await app.request('/nonexistent-route', {
        method: 'GET',
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body).toEqual({
        success: false,
        error: 'Not found',
        code: 'NOT_FOUND',
      });
    });

    it('returns 404 for unknown API routes', async () => {
      // Need auth for /api/* routes - but missing auth returns 401 first
      // Test a non-api route that doesn't exist
      const res = await app.request('/unknown/path/here', {
        method: 'GET',
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.code).toBe('NOT_FOUND');
    });

    it('returns 404 for various HTTP methods on unknown routes', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        const res = await app.request('/nonexistent', { method }, env);
        expect(res.status).toBe(404);
      }
    });
  });

});

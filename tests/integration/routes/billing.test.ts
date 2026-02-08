import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';

const JWT_SECRET = 'test-jwt-secret';

async function getAuthHeader(tenantId = 'tn_test-tenant-1') {
  const token = await createJWT({ sub: tenantId, role: 'admin' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe('Billing Routes', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
  });

  describe('GET /api/billing/plans', () => {
    it('returns billing plans', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/billing/plans', { headers }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.data[0].name).toBe('starter');
      expect(body.data[1].name).toBe('growth');
      expect(body.data[2].name).toBe('enterprise');
    });
  });

  describe('POST /api/billing/webhook', () => {
    it('accepts webhook without signature', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment.paid',
          tenant_id: 'tn_test-tenant-1',
          amount: 49000,
        }),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.received).toBe(true);
    });
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';
import { parseApiResponse } from '../../helpers/types.js';

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
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.data[0].name).toBe('starter');
      expect(body.data[1].name).toBe('growth');
      expect(body.data[2].name).toBe('enterprise');
    });
  });

  describe('POST /api/billing/subscription/upgrade', () => {
    it('rejects upgrade without plan_id', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/billing/subscription/upgrade?tenant_id=tn_test-tenant-1', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects upgrade with invalid plan_id', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/billing/subscription/upgrade?tenant_id=tn_test-tenant-1', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_plan_id: 'invalid_plan' }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/billing/subscription/cancel', () => {
    it('succeeds with valid request', async () => {
      // Create tenant and subscription first
      await env.DB.prepare(
        `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_test-tenant-1', 'Test Corp', 'starter', 'active', 'test-corp', 'test@example.com').run();

      await env.DB.prepare(
        `INSERT OR REPLACE INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_test', 'tn_test-tenant-1', 'plan_starter', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      const headers = await getAuthHeader();
      const res = await app.request('/api/billing/subscription/cancel?tenant_id=tn_test-tenant-1', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.message).toContain('7 days');
    });
  });

  describe('POST /api/billing/webhook', () => {
    it('accepts webhook with valid signature', async () => {
      // Create tenant first so the webhook can create notification
      await env.DB.prepare(
        `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_test-tenant-1', 'Test Corp', 'starter', 'active', 'test-corp', 'test@example.com').run();

      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        type: 'payment.paid',
        tenant_id: 'tn_test-tenant-1',
        amount: 49000,
      });

      // Generate valid signature
      const signatureBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(webhookSecret + payload)
      );
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const headers = await getAuthHeader();
      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.received).toBe(true);
    });

    it('rejects webhook without signature when secret is configured', async () => {
      (env as any).PORTONE_WEBHOOK_SECRET = 'test-webhook-secret';

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

      expect(res.status).toBe(401);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_SIGNATURE');
    });

    it('rejects webhook when secret is not configured', async () => {
      (env as any).PORTONE_WEBHOOK_SECRET = undefined;

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

      expect(res.status).toBe(503);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('CONFIGURATION_ERROR');
    });

    it('rejects webhook with invalid JSON payload', async () => {
      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const invalidPayload = '{ invalid json';

      // Generate signature for invalid payload
      const signatureBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(webhookSecret + invalidPayload)
      );
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const headers = await getAuthHeader();
      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: invalidPayload,
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_PAYLOAD');
    });

    it('handles webhook with missing event type', async () => {
      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        tenant_id: 'tn_test-tenant-1',
        amount: 49000,
      });

      // Generate valid signature
      const signatureBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(webhookSecret + payload)
      );
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const headers = await getAuthHeader();
      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      // Should succeed but log warning about unknown event type
      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
    });
  });

  describe('GET /api/billing/usage', () => {
    it('returns usage data for valid tenant', async () => {
      // Create tenant and subscription
      await env.DB.prepare(
        `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_test-tenant-1', 'Test Corp', 'starter', 'active', 'test-corp', 'test@example.com').run();

      await env.DB.prepare(
        `INSERT OR REPLACE INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_test', 'tn_test-tenant-1', 'plan_starter', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      const headers = await getAuthHeader();
      const res = await app.request('/api/billing/usage?tenant_id=tn_test-tenant-1', {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('period_start');
      expect(body.data).toHaveProperty('period_end');
      expect(body.data).toHaveProperty('total_tokens');
      expect(body.data).toHaveProperty('total_cost');
      expect(body.data).toHaveProperty('total_requests');
      expect(body.data).toHaveProperty('daily_breakdown');
    });
  });
});

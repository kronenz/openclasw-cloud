import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb, createTestTenant } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';
import { parseApiResponse } from '../../helpers/types.js';

const JWT_SECRET = 'test-jwt-secret';

async function getAuthHeader(tenantId = 'tn_test-tenant-1') {
  const token = await createJWT({ sub: tenantId, role: 'tenant' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe('Dashboard API', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
    await createTestTenant({
      id: 'tn_dashboard-test',
      name: 'Dashboard Test Tenant',
      status: 'active',
      subdomain: `dashboard-test-${Date.now()}`,
    });

    // Create a subscription for the tenant
    await env.DB.prepare(
      `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      'sub_dashboard-test',
      'tn_dashboard-test',
      'plan_starter',
      'active',
      '2026-01-01',
      '2026-02-01'
    ).run();

    // Create some daily usage records for chart tests
    await env.DB.prepare(
      `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost) VALUES (?, ?, ?, ?, ?)`
    ).bind('tn_dashboard-test', '2026-02-09', 100, 50000, 2.5).run();

    await env.DB.prepare(
      `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost) VALUES (?, ?, ?, ?, ?)`
    ).bind('tn_dashboard-test', '2026-02-08', 80, 40000, 2.0).run();

    await env.DB.prepare(
      `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost) VALUES (?, ?, ?, ?, ?)`
    ).bind('tn_dashboard-test', '2026-02-07', 120, 60000, 3.0).run();

    // Create some notifications
    await env.DB.prepare(
      `INSERT INTO notifications (id, tenant_id, channel, type, status, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      'notif_1',
      'tn_dashboard-test',
      'email',
      'info',
      'sent',
      'Welcome to OpenClasw'
    ).run();
  });

  describe('GET /api/dashboard/summary', () => {
    it('should return dashboard summary for authenticated tenant', async () => {
      const headers = await getAuthHeader('tn_dashboard-test');
      const res = await app.request('/api/dashboard/summary', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('tenant');
      expect(body.data).toHaveProperty('usage_today');
      expect(body.data).toHaveProperty('subscription');
      expect(body.data).toHaveProperty('notifications');
      expect(body.data).toHaveProperty('health_status');

      // Verify tenant info
      expect(body.data.tenant.id).toBe('tn_dashboard-test');
      expect(body.data.tenant.name).toBe('Dashboard Test Tenant');
      expect(body.data.tenant.status).toBe('active');

      // Verify usage_today structure
      expect(body.data.usage_today).toHaveProperty('tokens');
      expect(body.data.usage_today).toHaveProperty('requests');
      expect(body.data.usage_today).toHaveProperty('cost');
      expect(body.data.usage_today.tokens).toBe(50000);
      expect(body.data.usage_today.requests).toBe(100);

      // Verify subscription structure
      expect(body.data.subscription).toHaveProperty('plan');
      expect(body.data.subscription).toHaveProperty('status');
      expect(body.data.subscription).toHaveProperty('period_end');
      expect(body.data.subscription.status).toBe('active');

      // Verify notifications is an array
      expect(Array.isArray(body.data.notifications)).toBe(true);
      expect(body.data.notifications.length).toBeGreaterThan(0);

      // Verify health_status
      expect(body.data.health_status).toBe('healthy');
    });

    it('should return 404 for non-existent tenant', async () => {
      const headers = await getAuthHeader('tn_nonexistent');
      const res = await app.request('/api/dashboard/summary', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/dashboard/summary', {
        method: 'GET',
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/charts', () => {
    it('should return chart data with default 30d period', async () => {
      const headers = await getAuthHeader('tn_dashboard-test');
      const res = await app.request('/api/dashboard/charts', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('period');
      expect(body.data).toHaveProperty('data');
      expect(body.data.period).toBe('30d');
      expect(Array.isArray(body.data.data)).toBe(true);

      // Should have at least the records we inserted
      expect(body.data.data.length).toBeGreaterThan(0);

      // Verify data structure
      if (body.data.data.length > 0) {
        const dataPoint = body.data.data[0];
        expect(dataPoint).toHaveProperty('date');
        expect(dataPoint).toHaveProperty('total_tokens');
        expect(dataPoint).toHaveProperty('total_requests');
        expect(dataPoint).toHaveProperty('total_cost');
      }
    });

    it('should accept period=7d query param', async () => {
      const headers = await getAuthHeader('tn_dashboard-test');
      const res = await app.request('/api/dashboard/charts?period=7d', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.period).toBe('7d');
      expect(Array.isArray(body.data.data)).toBe(true);
    });

    it('should accept period=90d query param', async () => {
      const headers = await getAuthHeader('tn_dashboard-test');
      const res = await app.request('/api/dashboard/charts?period=90d', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.period).toBe('90d');
      expect(Array.isArray(body.data.data)).toBe(true);
    });

    it('should return empty data array when no usage exists', async () => {
      // Create a tenant with no usage data
      await createTestTenant({
        id: 'tn_no-usage',
        name: 'No Usage Tenant',
        status: 'active',
        subdomain: `no-usage-${Date.now()}`,
      });

      const headers = await getAuthHeader('tn_no-usage');
      const res = await app.request('/api/dashboard/charts', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.period).toBe('30d');
      expect(body.data.data).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/dashboard/charts', {
        method: 'GET',
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/dashboard/api-key/regenerate', () => {
    it('should regenerate API key and return new key', async () => {
      const headers = await getAuthHeader('tn_dashboard-test');
      const res = await app.request('/api/dashboard/api-key/regenerate', {
        method: 'POST',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('api_key');
      expect(body.data).toHaveProperty('expires_in');
      expect(typeof body.data.api_key).toBe('string');
      expect(body.data.api_key.length).toBeGreaterThan(0);
      expect(body.data.expires_in).toBe('365 days');

      // Verify the key was stored in KV
      const storedTenantId = await env.CACHE.get(`apikey:${body.data.api_key}`);
      expect(storedTenantId).toBe('tn_dashboard-test');
    });

    it('should return 404 for non-existent tenant', async () => {
      const headers = await getAuthHeader('tn_nonexistent');
      const res = await app.request('/api/dashboard/api-key/regenerate', {
        method: 'POST',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/dashboard/api-key/regenerate', {
        method: 'POST',
      }, env);

      expect(res.status).toBe(401);
    });
  });
});

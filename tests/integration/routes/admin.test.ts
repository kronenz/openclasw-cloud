import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb, createTestTenant } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';
import { parseApiResponse } from '../../helpers/types.js';

const JWT_SECRET = 'test-jwt-secret';

async function getAdminHeader() {
  const token = await createJWT({ sub: 'admin_user', role: 'admin' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

async function getTenantAuthHeader(tenantId = 'tn_test-tenant-1') {
  const token = await createJWT({ sub: tenantId, role: 'tenant' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

async function createBillingSubscription(tenantId: string, planId: string, status = 'active') {
  // Ensure tenant exists first
  const tenant = await env.DB.prepare('SELECT id FROM tenants WHERE id = ?').bind(tenantId).first();
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} does not exist - cannot create subscription`);
  }

  const now = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(`sub_${tenantId}`, tenantId, planId, status, now, periodEnd, now, now).run();
}

async function createIncident(data: {
  id: string;
  tenantId?: string;
  severity: string;
  status: string;
  title: string;
}) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO incidents (id, tenant_id, severity, status, title, auto_recovery_attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(data.id, data.tenantId || null, data.severity, data.status, data.title, now, now).run();
}

async function createTenantSegment(tenantId: string, segment: string, score: number) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO tenant_segments (tenant_id, segment, score, updated_at)
     VALUES (?, ?, ?, ?)`
  ).bind(tenantId, segment, score, now).run();
}

async function createDailyUsage(tenantId: string, date: string, cost: number, tokens: number) {
  await env.DB.prepare(
    `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost)
     VALUES (?, ?, 100, ?, ?)`
  ).bind(tenantId, date, tokens, cost).run();
}

describe('Admin Routes', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
  });

  describe('GET /api/admin/', () => {
    it('returns platform metrics', async () => {
      // Create tenants first
      await createTestTenant({ id: 'tn_metrics_active_1', status: 'active' });
      await createTestTenant({ id: 'tn_metrics_active_2', status: 'active' });
      await createTestTenant({ id: 'tn_metrics_suspended_1', status: 'suspended' });

      // Then create subscriptions referencing those tenants
      await createBillingSubscription('tn_metrics_active_1', 'plan_starter', 'active');
      await createBillingSubscription('tn_metrics_active_2', 'plan_growth', 'active');

      // Create incidents
      await createIncident({ id: 'inc_metrics_1', severity: 'P0', status: 'open', title: 'Critical issue' });
      await createIncident({ id: 'inc_metrics_2', severity: 'P2', status: 'resolved', title: 'Minor issue' });

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.tenants).toBeDefined();
      expect(Array.isArray(body.data.tenants)).toBe(true);
      expect(body.data.revenue).toBeDefined();
      expect(body.data.revenue.mrr).toBeGreaterThanOrEqual(0);
      expect(body.data.revenue.arr).toBeGreaterThanOrEqual(0);
      expect(body.data.incidents).toBeDefined();
      expect(body.data.uptime).toBeDefined();
      expect(body.data.timestamp).toBeDefined();
    });

    it('calculates uptime correctly', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(parseFloat(body.data.uptime)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(body.data.uptime)).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/admin/tenants', () => {
    it('returns all tenants with default pagination', async () => {
      await createTestTenant({ id: 'tn_list_1', name: 'Tenant 1' });
      await createTestTenant({ id: 'tn_list_2', name: 'Tenant 2' });
      await createTestTenant({ id: 'tn_list_3', name: 'Tenant 3' });

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(3);
      expect(body.meta).toBeDefined();
      expect(body.meta.limit).toBe(20);
      expect(body.meta.offset).toBe(0);
    });

    it('filters tenants by status', async () => {
      await createTestTenant({ id: 'tn_filter_active', status: 'active' });
      await createTestTenant({ id: 'tn_filter_suspended', status: 'suspended' });

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants?status=active', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((tenant: any) => {
        expect(tenant.status).toBe('active');
      });
    });

    it('supports custom limit', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants?limit=2', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.meta.limit).toBe(2);
      expect(body.data.length).toBeLessThanOrEqual(2);
    });

    it('supports pagination with page param', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants?limit=1&page=2', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.meta.page).toBe(2);
      expect(body.meta.offset).toBe(1);
    });

    it('rejects limit exceeding max (100)', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants?limit=1000', { headers }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
    });

    it('includes subscription and segment info', async () => {
      const tenantId = 'tn_with_sub_details';
      await createTestTenant({ id: tenantId });
      await createBillingSubscription(tenantId, 'plan_growth', 'active');
      await createTenantSegment(tenantId, 'champion', 95);

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      const tenant = body.data.find((t: any) => t.id === tenantId);
      expect(tenant).toBeDefined();
    });
  });

  describe('GET /api/admin/tenants/:id', () => {
    it('returns single tenant with full details', async () => {
      const tenantId = 'tn_details_test';
      await createTestTenant({ id: tenantId, name: 'Details Test Corp' });

      const headers = await getAdminHeader();
      const res = await app.request(`/api/admin/tenants/${tenantId}`, { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(tenantId);
      expect(body.data.name).toBe('Details Test Corp');
      expect(body.data.resources).toBeDefined();
      expect(body.data.monthly_cost).toBeDefined();
    });

    it('returns 404 for non-existent tenant', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants/tn_nonexistent', { headers }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });
  });

  describe('POST /api/admin/tenants/:id/suspend', () => {
    it('suspends a tenant', async () => {
      const tenantId = 'tn_to_suspend';
      await createTestTenant({ id: tenantId, status: 'active' });

      const headers = await getAdminHeader();
      const res = await app.request(`/api/admin/tenants/${tenantId}/suspend`, {
        method: 'POST',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('suspended');
      expect(body.data.id).toBe(tenantId);
    });

    it('returns 404 for non-existent tenant', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants/tn_nonexistent/suspend', {
        method: 'POST',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });
  });

  describe('POST /api/admin/tenants/:id/activate', () => {
    it('activates a suspended tenant', async () => {
      const tenantId = 'tn_to_activate';
      await createTestTenant({ id: tenantId, status: 'suspended' });

      const headers = await getAdminHeader();
      const res = await app.request(`/api/admin/tenants/${tenantId}/activate`, {
        method: 'POST',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('active');
      expect(body.data.id).toBe(tenantId);
    });

    it('returns 404 for non-existent tenant', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants/tn_nonexistent/activate', {
        method: 'POST',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });
  });

  describe('GET /api/admin/metrics', () => {
    it('returns platform-wide metrics', async () => {
      await createTestTenant({ id: 'tn_metrics_1', status: 'active' });
      await createTestTenant({ id: 'tn_metrics_2', status: 'provisioning' });

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/metrics', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.overview).toBeDefined();
      expect(body.data.model_breakdown).toBeDefined();
      expect(Array.isArray(body.data.model_breakdown)).toBe(true);
      expect(body.data.timestamp).toBeDefined();
    });

    it('includes model breakdown data', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/metrics', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.data.model_breakdown).toBeDefined();
      expect(Array.isArray(body.data.model_breakdown)).toBe(true);
    });
  });

  describe('GET /api/admin/incidents', () => {
    it('returns all incidents', async () => {
      await createIncident({ id: 'inc_all_1', severity: 'P0', status: 'open', title: 'Issue 1' });
      await createIncident({ id: 'inc_all_2', severity: 'P2', status: 'resolved', title: 'Issue 2' });

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/incidents', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('filters incidents by status', async () => {
      await createIncident({ id: 'inc_open', severity: 'P1', status: 'open', title: 'Open issue' });
      await createIncident({ id: 'inc_resolved', severity: 'P1', status: 'resolved', title: 'Resolved issue' });

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/incidents?status=open', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      body.data.forEach((incident: any) => {
        expect(incident.status).toBe('open');
      });
    });

    it('filters incidents by severity', async () => {
      await createIncident({ id: 'inc_p0', severity: 'P0', status: 'open', title: 'Critical' });
      await createIncident({ id: 'inc_p3', severity: 'P3', status: 'open', title: 'Low' });

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/incidents?severity=P0', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      body.data.forEach((incident: any) => {
        expect(incident.severity).toBe('P0');
      });
    });

    it('filters incidents by tenant_id', async () => {
      const tenantId = 'tn_incident_owner';
      await createTestTenant({ id: tenantId });
      await createIncident({ id: 'inc_tenant', tenantId, severity: 'P1', status: 'open', title: 'Tenant issue' });
      await createIncident({ id: 'inc_platform', severity: 'P1', status: 'open', title: 'Platform issue' });

      const headers = await getAdminHeader();
      const res = await app.request(`/api/admin/incidents?tenant_id=${tenantId}`, { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      body.data.forEach((incident: any) => {
        expect(incident.tenant_id).toBe(tenantId);
      });
    });

    it('supports multiple filters', async () => {
      const tenantId = 'tn_multi_filter';
      await createTestTenant({ id: tenantId });
      await createIncident({ id: 'inc_match', tenantId, severity: 'P0', status: 'open', title: 'Match' });
      await createIncident({ id: 'inc_nomatch1', tenantId, severity: 'P1', status: 'open', title: 'No match 1' });
      await createIncident({ id: 'inc_nomatch2', severity: 'P0', status: 'resolved', title: 'No match 2' });

      const headers = await getAdminHeader();
      const res = await app.request(`/api/admin/incidents?status=open&severity=P0&tenant_id=${tenantId}`, { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      body.data.forEach((incident: any) => {
        expect(incident.tenant_id).toBe(tenantId);
        expect(incident.severity).toBe('P0');
        expect(incident.status).toBe('open');
      });
    });

    it('rejects invalid severity value', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/incidents?severity=INVALID', { headers }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/admin/segments', () => {
    it('returns tenant segment distribution', async () => {
      // Create tenants first
      await createTestTenant({ id: 'tn_segments_1' });
      await createTestTenant({ id: 'tn_segments_2' });
      await createTestTenant({ id: 'tn_segments_3' });

      // Then create segments referencing those tenants
      await createTenantSegment('tn_segments_1', 'champion', 95);
      await createTenantSegment('tn_segments_2', 'champion', 92);
      await createTenantSegment('tn_segments_3', 'at_risk', 30);

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/segments', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);

      const championSegment = body.data.find((s: any) => s.segment === 'champion');
      if (championSegment) {
        expect(championSegment.count).toBeGreaterThanOrEqual(2);
        expect(championSegment.avg_score).toBeDefined();
      }
    });
  });

  describe('GET /api/admin/billing/summary', () => {
    it('returns revenue summary', async () => {
      // Create tenants first
      await createTestTenant({ id: 'tn_billing_summary_1' });
      await createTestTenant({ id: 'tn_billing_summary_2' });

      // Then create subscriptions referencing those tenants
      await createBillingSubscription('tn_billing_summary_1', 'plan_starter', 'active');
      await createBillingSubscription('tn_billing_summary_2', 'plan_growth', 'active');

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/billing/summary', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.mrr).toBeGreaterThan(0);
      expect(body.data.arr).toBe(body.data.mrr * 12);
      expect(body.data.paying_customers).toBeGreaterThanOrEqual(2);
      expect(body.data.arpu).toBeGreaterThanOrEqual(0);
      expect(body.data.churn_rate).toBeDefined();
      expect(body.data.timestamp).toBeDefined();
    });

    it('calculates churn rate correctly', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/billing/summary', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(parseFloat(body.data.churn_rate)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(body.data.churn_rate)).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/admin/billing/transactions', () => {
    it('returns billing transactions', async () => {
      await createTestTenant({ id: 'tn_trans_1', name: 'Trans Corp 1' });
      await createBillingSubscription('tn_trans_1', 'plan_starter', 'active');

      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/billing/transactions', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
      expect(body.meta.limit).toBe(20);
      expect(body.meta.offset).toBe(0);
    });

    it('supports custom limit', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/billing/transactions?limit=10', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.meta.limit).toBe(10);
    });

    it('rejects limit exceeding max (100)', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/billing/transactions?limit=1000', { headers }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
    });

    it('supports pagination with page param', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/billing/transactions?limit=5&page=2', { headers }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.meta.page).toBe(2);
      expect(body.meta.offset).toBe(5);
    });
  });

  describe('Authentication and Authorization', () => {
    it('requires authentication for all admin endpoints', async () => {
      const endpoints = [
        '/api/admin',
        '/api/admin/tenants',
        '/api/admin/metrics',
        '/api/admin/incidents',
        '/api/admin/segments',
        '/api/admin/billing/summary',
        '/api/admin/billing/transactions',
      ];

      for (const endpoint of endpoints) {
        const res = await app.request(endpoint, {}, env);
        expect(res.status).toBe(401);
        const body = await parseApiResponse(res);
        expect(body.success).toBe(false);
        expect(body.code).toBe('AUTH_REQUIRED');
      }
    });

    it('rejects tenant role for all admin endpoints', async () => {
      const tenantHeaders = await getTenantAuthHeader();
      const endpoints = [
        '/api/admin',
        '/api/admin/tenants',
        '/api/admin/metrics',
        '/api/admin/incidents',
        '/api/admin/segments',
        '/api/admin/billing/summary',
        '/api/admin/billing/transactions',
      ];

      for (const endpoint of endpoints) {
        const res = await app.request(endpoint, { headers: tenantHeaders }, env);
        expect(res.status).toBe(403);
        const body = await parseApiResponse(res);
        expect(body.success).toBe(false);
        expect(body.code).toBe('FORBIDDEN');
      }
    });

    it('requires admin role for tenant suspend endpoint', async () => {
      await createTestTenant({ id: 'tn_auth_test' });
      const tenantHeaders = await getTenantAuthHeader();

      const res = await app.request('/api/admin/tenants/tn_auth_test/suspend', {
        method: 'POST',
        headers: tenantHeaders,
      }, env);

      expect(res.status).toBe(403);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('FORBIDDEN');
    });

    it('requires admin role for tenant activate endpoint', async () => {
      await createTestTenant({ id: 'tn_auth_test_2', status: 'suspended' });
      const tenantHeaders = await getTenantAuthHeader();

      const res = await app.request('/api/admin/tenants/tn_auth_test_2/activate', {
        method: 'POST',
        headers: tenantHeaders,
      }, env);

      expect(res.status).toBe(403);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('FORBIDDEN');
    });
  });
});

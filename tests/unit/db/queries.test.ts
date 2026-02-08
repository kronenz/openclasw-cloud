import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import {
  createTenant,
  getTenant,
  listTenants,
  updateTenant,
  createTenantResource,
  getTenantResources,
  logUsage,
  getDailyUsage,
  listBillingPlans,
  createIncident,
  listIncidents,
  updateIncident,
} from '../../../src/db/queries.js';

describe('D1 Queries', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  describe('Tenant CRUD', () => {
    it('creates and retrieves a tenant', async () => {
      const tenant = await createTenant(env.DB, {
        id: 'tn_q-test-1',
        name: 'Query Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'query-test',
        contact_email: 'query@test.com',
        contact_name: null,
        metadata: null,
      });

      expect(tenant.id).toBe('tn_q-test-1');
      expect(tenant.name).toBe('Query Test Corp');

      const fetched = await getTenant(env.DB, 'tn_q-test-1');
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe('Query Test Corp');
    });

    it('lists tenants with status filter', async () => {
      // Create test data first
      await createTenant(env.DB, {
        id: 'tn_q-list-1',
        name: 'List Test 1',
        plan: 'starter',
        status: 'active',
        subdomain: 'list-test-1',
        contact_email: 'list1@test.com',
        contact_name: null,
        metadata: null,
      });

      const all = await listTenants(env.DB);
      expect(all.length).toBeGreaterThan(0);

      const active = await listTenants(env.DB, { status: 'active' });
      active.forEach(t => expect(t.status).toBe('active'));
    });

    it('updates tenant fields', async () => {
      await createTenant(env.DB, {
        id: 'tn_q-update',
        name: 'Before Update',
        plan: 'starter',
        status: 'active',
        subdomain: 'before-update',
        contact_email: 'update@test.com',
        contact_name: null,
        metadata: null,
      });

      const updated = await updateTenant(env.DB, 'tn_q-update', {
        name: 'After Update',
        plan: 'growth',
      });

      expect(updated!.name).toBe('After Update');
      expect(updated!.plan).toBe('growth');
    });

    it('returns null for non-existent tenant', async () => {
      const result = await getTenant(env.DB, 'tn_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Tenant Resources', () => {
    it('creates and retrieves resources', async () => {
      await createTenant(env.DB, {
        id: 'tn_q-res',
        name: 'Resource Test',
        plan: 'starter',
        status: 'active',
        subdomain: 'res-test',
        contact_email: 'res@test.com',
        contact_name: null,
        metadata: null,
      });

      await createTenantResource(env.DB, {
        id: 'res_test-1',
        tenant_id: 'tn_q-res',
        resource_type: 'worker',
        resource_id: 'worker-tn_q-res',
        config: null,
      });

      const resources = await getTenantResources(env.DB, 'tn_q-res');
      expect(resources).toHaveLength(1);
      expect(resources[0].resource_type).toBe('worker');
    });
  });

  describe('Usage', () => {
    it('logs and retrieves usage', async () => {
      await createTenant(env.DB, {
        id: 'tn_q-usage',
        name: 'Usage Test',
        plan: 'starter',
        status: 'active',
        subdomain: 'usage-test',
        contact_email: 'usage@test.com',
        contact_name: null,
        metadata: null,
      });

      await logUsage(env.DB, {
        id: 'log_1',
        tenant_id: 'tn_q-usage',
        model: 'haiku',
        input_tokens: 1000,
        output_tokens: 500,
        cost_usd: 0.001,
        endpoint: '/chat',
      });

      // getDailyUsage needs aggregated data
      const today = new Date().toISOString().split('T')[0];
      const usage = await getDailyUsage(env.DB, 'tn_q-usage', today);
      // No aggregated data yet, so should be null
      expect(usage).toBeNull();
    });
  });

  describe('Billing Plans', () => {
    it('lists all billing plans', async () => {
      const plans = await listBillingPlans(env.DB);
      expect(plans).toHaveLength(3);
      expect(plans.map(p => p.name)).toEqual(['starter', 'growth', 'enterprise']);
      expect(plans[0].monthly_price).toBe(49000);
    });
  });

  describe('Incidents', () => {
    it('creates and lists incidents', async () => {
      await createTenant(env.DB, {
        id: 'tn_q-inc',
        name: 'Incident Test',
        plan: 'starter',
        status: 'active',
        subdomain: 'inc-test',
        contact_email: 'inc@test.com',
        contact_name: null,
        metadata: null,
      });

      await createIncident(env.DB, {
        id: 'inc_test-1',
        tenant_id: 'tn_q-inc',
        severity: 'P2',
        status: 'open',
        title: 'Test Incident',
        description: 'Test description',
        auto_recovery_attempts: 0,
        resolved_at: null,
      });

      const incidents = await listIncidents(env.DB, { tenantId: 'tn_q-inc' });
      expect(incidents).toHaveLength(1);
      expect(incidents[0].severity).toBe('P2');
    });

    it('updates incident status', async () => {
      // Create fresh test data for this test
      await createTenant(env.DB, {
        id: 'tn_q-inc-2',
        name: 'Incident Test 2',
        plan: 'starter',
        status: 'active',
        subdomain: 'inc-test-2',
        contact_email: 'inc2@test.com',
        contact_name: null,
        metadata: null,
      });

      await createIncident(env.DB, {
        id: 'inc_test-2',
        tenant_id: 'tn_q-inc-2',
        severity: 'P2',
        status: 'open',
        title: 'Test Incident 2',
        description: 'Test description 2',
        auto_recovery_attempts: 0,
        resolved_at: null,
      });

      await updateIncident(env.DB, 'inc_test-2', {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      });

      const resolved = await listIncidents(env.DB, { tenantId: 'tn_q-inc-2', status: 'resolved' });
      expect(resolved).toHaveLength(1);
    });
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb, createTestTenant } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';
import { parseApiResponse } from '../../helpers/types.js';

const JWT_SECRET = 'test-jwt-secret';

async function getAuthHeader(tenantId = 'tn_test-tenant-1') {
  const token = await createJWT({ sub: tenantId, role: 'admin' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe('Tenant Routes', () => {
  beforeAll(async () => {
    await setupTestDb();
    // Set JWT_SECRET on env for auth middleware
    (env as any).JWT_SECRET = JWT_SECRET;
  });

  describe('POST /api/tenants', () => {
    it('creates a tenant with valid data', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Tenant',
          contact_email: 'new@example.com',
          plan: 'starter',
        }),
      }, env);

      expect(res.status).toBe(201);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('New Tenant');
      expect(body.data.status).toBe('provisioning');
      expect(body.data.id).toMatch(/^tn_/);
    });

    it('rejects invalid data', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('requires authentication', async () => {
      const res = await app.request('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'No Auth Tenant',
          contact_email: 'no@auth.com',
        }),
      }, env);

      expect(res.status).toBe(401);
    });

    it('returns 400 when missing name', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_email: 'test@example.com',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with invalid email', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Tenant',
          contact_email: 'not-an-email',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with reserved subdomain', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Admin Tenant',
          contact_email: 'admin@example.com',
          subdomain: 'admin',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with invalid subdomain format', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Tenant',
          contact_email: 'test@example.com',
          subdomain: 'Invalid_Subdomain',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/tenants', () => {
    it('lists tenants', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants', {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('returns 400 when limit exceeds max (100)', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants?limit=101', {
        headers,
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with negative offset', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants?offset=-1', {
        headers,
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/tenants/:id', () => {
    it('returns a tenant by ID', async () => {
      await createTestTenant();
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants/tn_test-tenant-1', {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('tn_test-tenant-1');
    });

    it('returns 404 for non-existent tenant', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants/tn_nonexistent', {
        headers,
      }, env);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/tenants/:id', () => {
    it('updates tenant fields', async () => {
      await createTestTenant();
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants/tn_test-tenant-1', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Corp' }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.data.name).toBe('Updated Corp');
    });

    it('returns 400 with invalid status', async () => {
      await createTestTenant();
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants/tn_test-tenant-1', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid_status' }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/tenants/:id', () => {
    it('soft deletes a tenant', async () => {
      await createTestTenant({ id: 'tn_to-delete', name: 'Delete Me' });
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants/tn_to-delete', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.data.status).toBe('deleted');
    });
  });

  describe('GET /api/tenants/:id/usage', () => {
    it('returns 400 with invalid date format', async () => {
      await createTestTenant();
      const headers = await getAuthHeader();
      const res = await app.request('/api/tenants/tn_test-tenant-1/usage?start_date=invalid-date', {
        headers,
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });
});

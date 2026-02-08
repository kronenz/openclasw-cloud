import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';

const JWT_SECRET = 'test-jwt-secret';

async function getAdminHeader() {
  const token = await createJWT({ sub: 'admin_user', role: 'admin' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

async function getNonAdminHeader() {
  const token = await createJWT({ sub: 'tn_test-tenant-1', role: 'user' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe('Admin Auth Middleware', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
  });

  describe('Authentication', () => {
    it('rejects requests without Authorization header', async () => {
      const res = await app.request('/api/admin/tenants', {}, env);
      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('AUTH_REQUIRED');
      expect(body.error).toBe('Missing authorization');
    });

    it('rejects requests with malformed Authorization header', async () => {
      const res = await app.request('/api/admin/tenants', {
        headers: { Authorization: 'InvalidFormat token123' },
      }, env);
      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('AUTH_REQUIRED');
    });

    it('rejects requests with missing Bearer prefix', async () => {
      const token = await createJWT({ sub: 'admin_user', role: 'admin' }, JWT_SECRET);
      const res = await app.request('/api/admin/tenants', {
        headers: { Authorization: token },
      }, env);
      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('AUTH_REQUIRED');
    });

    it('rejects requests with invalid JWT token', async () => {
      const res = await app.request('/api/admin/tenants', {
        headers: { Authorization: 'Bearer invalid-jwt-token' },
      }, env);
      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('AUTH_INVALID');
      expect(body.error).toBe('Invalid token');
    });

    it('rejects expired JWT tokens', async () => {
      const token = await createJWT({ sub: 'admin_user', role: 'admin' }, JWT_SECRET, -1);
      const res = await app.request('/api/admin/tenants', {
        headers: { Authorization: `Bearer ${token}` },
      }, env);
      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('AUTH_INVALID');
    });

    it('rejects tokens signed with wrong secret', async () => {
      const token = await createJWT({ sub: 'admin_user', role: 'admin' }, 'wrong-secret');
      const res = await app.request('/api/admin/tenants', {
        headers: { Authorization: `Bearer ${token}` },
      }, env);
      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('AUTH_INVALID');
    });
  });

  describe('Authorization', () => {
    it('rejects tokens without role claim', async () => {
      const token = await createJWT({ sub: 'some_user' }, JWT_SECRET);
      const res = await app.request('/api/admin/tenants', {
        headers: { Authorization: `Bearer ${token}` },
      }, env);
      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('FORBIDDEN');
      expect(body.error).toBe('Admin access required');
    });

    it('rejects tokens with non-admin role', async () => {
      const headers = await getNonAdminHeader();
      const res = await app.request('/api/admin/tenants', {
        headers,
      }, env);
      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('FORBIDDEN');
      expect(body.error).toBe('Admin access required');
    });

    it('rejects tokens with role "user"', async () => {
      const token = await createJWT({ sub: 'user_id', role: 'user' }, JWT_SECRET);
      const res = await app.request('/api/admin/tenants', {
        headers: { Authorization: `Bearer ${token}` },
      }, env);
      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('FORBIDDEN');
    });

    it('rejects tokens with role "tenant"', async () => {
      const token = await createJWT({ sub: 'tenant_id', role: 'tenant' }, JWT_SECRET);
      const res = await app.request('/api/admin/tenants', {
        headers: { Authorization: `Bearer ${token}` },
      }, env);
      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.code).toBe('FORBIDDEN');
    });

    it('accepts tokens with admin role', async () => {
      const headers = await getAdminHeader();
      const res = await app.request('/api/admin/tenants', {
        headers,
      }, env);
      expect(res.status).toBe(200);
    });

    it('accepts admin tokens with additional claims', async () => {
      const token = await createJWT({
        sub: 'admin_user',
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
      }, JWT_SECRET);
      const res = await app.request('/api/admin/tenants', {
        headers: { Authorization: `Bearer ${token}` },
      }, env);
      expect(res.status).toBe(200);
    });
  });

  describe('Multiple endpoints protection', () => {
    it('protects GET /api/admin/tenants', async () => {
      const headers = await getNonAdminHeader();
      const res = await app.request('/api/admin/tenants', { headers }, env);
      expect(res.status).toBe(403);
    });

    it('protects GET /api/admin/metrics', async () => {
      const headers = await getNonAdminHeader();
      const res = await app.request('/api/admin/metrics', { headers }, env);
      expect(res.status).toBe(403);
    });

    it('protects POST /api/admin/tenants/:id/suspend', async () => {
      const headers = await getNonAdminHeader();
      const res = await app.request('/api/admin/tenants/tn_test/suspend', {
        method: 'POST',
        headers,
      }, env);
      expect(res.status).toBe(403);
    });

    it('protects GET /api/admin/incidents', async () => {
      const headers = await getNonAdminHeader();
      const res = await app.request('/api/admin/incidents', { headers }, env);
      expect(res.status).toBe(403);
    });
  });
});

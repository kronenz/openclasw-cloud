import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';
import { createTenant } from '../../../src/db/queries.js';
import { parseApiResponse } from '../../helpers/types.js';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-chars!';

describe('Tenant Scope Middleware', () => {
  let ownerToken: string;
  let otherToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;

    // Create test tenants in the database
    await createTenant(env.DB, {
      id: 'tn_owner',
      name: 'Owner Tenant',
      plan: 'starter',
      status: 'active',
      subdomain: 'owner-tenant',
      contact_email: 'owner@example.com',
      contact_name: 'Owner User',
      metadata: null,
    });

    await createTenant(env.DB, {
      id: 'tn_other',
      name: 'Other Tenant',
      plan: 'starter',
      status: 'active',
      subdomain: 'other-tenant',
      contact_email: 'other@example.com',
      contact_name: 'Other User',
      metadata: null,
    });

    // Create JWT tokens for different users
    ownerToken = await createJWT(
      { sub: 'tn_owner' },
      JWT_SECRET,
      3600
    );

    otherToken = await createJWT(
      { sub: 'tn_other' },
      JWT_SECRET,
      3600
    );

    adminToken = await createJWT(
      { sub: 'admin_user', role: 'admin' },
      JWT_SECRET,
      3600
    );
  });

  describe('Regular user access control', () => {
    it('allows regular user to access their own tenant data', async () => {
      const res = await app.request('/api/tenants/tn_owner', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      }, env);

      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('tn_owner');
    });

    it('prevents regular user from accessing another tenant\'s data', async () => {
      const res = await app.request('/api/tenants/tn_other', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      }, env);

      expect(res.status).toBe(403);
      const json = await parseApiResponse(res);
      expect(json).toEqual({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
      });
    });

    it('prevents regular user from updating another tenant', async () => {
      const res = await app.request('/api/tenants/tn_other', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      }, env);

      expect(res.status).toBe(403);
      const json = await parseApiResponse(res);
      expect(json).toEqual({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
      });
    });

    it('prevents regular user from deleting another tenant', async () => {
      const res = await app.request('/api/tenants/tn_other', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      }, env);

      expect(res.status).toBe(403);
      const json = await parseApiResponse(res);
      expect(json).toEqual({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
      });
    });

    it('allows regular user to access their own tenant usage', async () => {
      const res = await app.request('/api/tenants/tn_owner/usage', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      }, env);

      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(json.data.tenant_id).toBe('tn_owner');
    });

    it('prevents regular user from accessing another tenant\'s usage', async () => {
      const res = await app.request('/api/tenants/tn_other/usage', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      }, env);

      expect(res.status).toBe(403);
      const json = await parseApiResponse(res);
      expect(json).toEqual({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
      });
    });

    it('allows regular user to access their own tenant health', async () => {
      const res = await app.request('/api/tenants/tn_owner/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      }, env);

      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(json.data.tenant_id).toBe('tn_owner');
    });

    it('prevents regular user from accessing another tenant\'s health', async () => {
      const res = await app.request('/api/tenants/tn_other/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      }, env);

      expect(res.status).toBe(403);
      const json = await parseApiResponse(res);
      expect(json).toEqual({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
      });
    });
  });

  describe('Admin user access control', () => {
    it('allows admin user to access any tenant\'s data', async () => {
      const res = await app.request('/api/tenants/tn_owner', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      }, env);

      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('tn_owner');
    });

    it('allows admin user to access another tenant\'s data', async () => {
      const res = await app.request('/api/tenants/tn_other', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      }, env);

      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('tn_other');
    });

    it('allows admin user to update any tenant', async () => {
      const res = await app.request('/api/tenants/tn_other', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated by Admin',
        }),
      }, env);

      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Updated by Admin');
    });

    it('allows admin user to access any tenant\'s usage', async () => {
      const res = await app.request('/api/tenants/tn_other/usage', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      }, env);

      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(json.data.tenant_id).toBe('tn_other');
    });

    it('allows admin user to access any tenant\'s health', async () => {
      const res = await app.request('/api/tenants/tn_other/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      }, env);

      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(json.data.tenant_id).toBe('tn_other');
    });
  });

  describe('Routes without tenant ID parameter', () => {
    it('allows requests to list endpoint (no tenant ID param)', async () => {
      const res = await app.request('/api/tenants', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      }, env);

      // Should pass through tenant-scope middleware since there's no :id param
      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('allows requests to create endpoint (no tenant ID param)', async () => {
      const res = await app.request('/api/tenants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Tenant',
          contact_email: 'new@example.com',
          subdomain: 'new-tenant',
        }),
      }, env);

      // Should pass through tenant-scope middleware since there's no :id param
      expect(res.status).toBe(201);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
    });
  });

  describe('Cross-user verification', () => {
    it('verifies user tn_other cannot access tn_owner data', async () => {
      const res = await app.request('/api/tenants/tn_owner', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${otherToken}`,
        },
      }, env);

      expect(res.status).toBe(403);
      const json = await parseApiResponse(res);
      expect(json).toEqual({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
      });
    });

    it('verifies user tn_other can access their own data', async () => {
      const res = await app.request('/api/tenants/tn_other', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${otherToken}`,
        },
      }, env);

      expect(res.status).toBe(200);
      const json = await parseApiResponse(res);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('tn_other');
    });
  });
});

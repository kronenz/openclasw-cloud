import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb, createTestTenant } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';
import { parseApiResponse } from '../../helpers/types.js';

const JWT_SECRET = 'test-jwt-secret-for-vitest';

async function getAuthHeader(tenantId = 'tn_test-tenant-1') {
  const token = await createJWT({ sub: tenantId, role: 'admin' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe('Integration Routes - Telegram', () => {
  let originalFetch: typeof global.fetch;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
    testTenant = await createTestTenant({ id: 'tn_telegram_test' });
  });

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('PUT /api/tenants/:id/integrations/telegram', () => {
    it('saves bot token and calls setWebhook successfully', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      // Mock Telegram API setWebhook call
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: true, description: 'Webhook was set' }),
      });
      global.fetch = fetchMock;

      const res = await app.request('/api/tenants/tn_telegram_test/integrations/telegram', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.webhook_set).toBe(true);

      // Verify setWebhook was called
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/setWebhook'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Verify bot token was stored in KV
      const storedToken = await env.CACHE.get('telegram:bot:tn_telegram_test');
      expect(storedToken).toBe('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    });

    it('returns 400 when bot_token is missing', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      const res = await app.request('/api/tenants/tn_telegram_test/integrations/telegram', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when bot_token format is invalid', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      const res = await app.request('/api/tenants/tn_telegram_test/integrations/telegram', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'invalid-token',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/telegram', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        }),
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_telegram_test/integrations/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        }),
      }, env);

      expect(res.status).toBe(401);
    });

    it('handles setWebhook failure gracefully', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      // Mock Telegram API setWebhook failure
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, description: 'Invalid webhook URL' }),
      });
      global.fetch = fetchMock;

      const res = await app.request('/api/tenants/tn_telegram_test/integrations/telegram', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        }),
      }, env);

      expect(res.status).toBe(500);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Failed to set webhook');
    });
  });

  describe('DELETE /api/tenants/:id/integrations/telegram', () => {
    beforeEach(async () => {
      // Set up a bot token for deletion tests
      await env.CACHE.put('telegram:bot:tn_telegram_test', '123456:test-token');
    });

    it('deletes bot token and calls deleteWebhook successfully', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      // Mock Telegram API deleteWebhook call
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: true, description: 'Webhook was deleted' }),
      });
      global.fetch = fetchMock;

      const res = await app.request('/api/tenants/tn_telegram_test/integrations/telegram', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.webhook_deleted).toBe(true);

      // Verify deleteWebhook was called
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/deleteWebhook'),
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Verify bot token was removed from KV
      const storedToken = await env.CACHE.get('telegram:bot:tn_telegram_test');
      expect(storedToken).toBeNull();
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/telegram', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 404 when bot token does not exist', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      // Clear any existing token
      await env.CACHE.delete('telegram:bot:tn_telegram_test');

      const res = await app.request('/api/tenants/tn_telegram_test/integrations/telegram', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toContain('No Telegram integration found');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_telegram_test/integrations/telegram', {
        method: 'DELETE',
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/tenants/:id/integrations', () => {
    beforeEach(async () => {
      // Clear all integration data
      await env.CACHE.delete('telegram:bot:tn_telegram_test');
      await env.CACHE.delete('slack:bot:tn_telegram_test');
    });

    it('returns empty list when no integrations exist', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      const res = await app.request('/api/tenants/tn_telegram_test/integrations', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.integrations).toEqual([]);
    });

    it('returns telegram integration when it exists', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      // Set up telegram integration
      await env.CACHE.put('telegram:bot:tn_telegram_test', '123456:test-token');

      const res = await app.request('/api/tenants/tn_telegram_test/integrations', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.integrations).toHaveLength(1);
      expect(body.data.integrations[0]).toEqual({
        platform: 'telegram',
        status: 'active',
      });
    });

    it('returns multiple integrations when they exist', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      // Set up multiple integrations
      await env.CACHE.put('telegram:bot:tn_telegram_test', '123456:test-token');
      await env.CACHE.put('slack:bot:tn_telegram_test', 'xoxb-test-token');

      const res = await app.request('/api/tenants/tn_telegram_test/integrations', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.integrations).toHaveLength(2);
      expect(body.data.integrations).toContainEqual({
        platform: 'telegram',
        status: 'active',
      });
      expect(body.data.integrations).toContainEqual({
        platform: 'slack',
        status: 'active',
      });
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_telegram_test/integrations', {
        method: 'GET',
      }, env);

      expect(res.status).toBe(401);
    });
  });
});

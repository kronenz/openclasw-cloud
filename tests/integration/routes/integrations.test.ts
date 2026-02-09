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
      await env.CACHE.delete('discord:bot:tn_telegram_test');
      await env.CACHE.delete('kakaotalk:api:tn_telegram_test');
      await env.CACHE.delete('whatsapp:token:tn_telegram_test');
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

    it('returns all five platform integrations when they exist', async () => {
      const headers = await getAuthHeader('tn_telegram_test');

      // Set up all integrations
      await env.CACHE.put('telegram:bot:tn_telegram_test', '123456:test-token');
      await env.CACHE.put('slack:bot:tn_telegram_test', 'xoxb-test-token');
      await env.CACHE.put('discord:bot:tn_telegram_test', 'discord-bot-token');
      await env.CACHE.put('kakaotalk:api:tn_telegram_test', 'kakao-api-key');
      await env.CACHE.put('whatsapp:token:tn_telegram_test', 'whatsapp-access-token');

      const res = await app.request('/api/tenants/tn_telegram_test/integrations', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.integrations).toHaveLength(5);
      expect(body.data.integrations).toContainEqual({ platform: 'telegram', status: 'active' });
      expect(body.data.integrations).toContainEqual({ platform: 'slack', status: 'active' });
      expect(body.data.integrations).toContainEqual({ platform: 'discord', status: 'active' });
      expect(body.data.integrations).toContainEqual({ platform: 'kakaotalk', status: 'active' });
      expect(body.data.integrations).toContainEqual({ platform: 'whatsapp', status: 'active' });
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

describe('Integration Routes - Slack', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
    (env as any).CACHE = env.CACHE;
    testTenant = await createTestTenant({ id: 'tn_slack_test' });
  });

  describe('PUT /api/tenants/:id/integrations/slack', () => {
    it('saves bot token successfully', async () => {
      const headers = await getAuthHeader('tn_slack_test');

      const res = await app.request('/api/tenants/tn_slack_test/integrations/slack', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'xoxb-fake-test-token-not-real',
        }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.connected).toBe(true);

      // Verify bot token was stored in KV
      const storedToken = await env.CACHE.get('slack:bot:tn_slack_test');
      expect(storedToken).toBe('xoxb-fake-test-token-not-real');
    });

    it('saves bot token and signing secret successfully', async () => {
      const headers = await getAuthHeader('tn_slack_test');

      const res = await app.request('/api/tenants/tn_slack_test/integrations/slack', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'xoxb-test-token-with-secret',
          signing_secret: 'abc123secret456def',
        }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);

      // Verify both were stored
      const storedToken = await env.CACHE.get('slack:bot:tn_slack_test');
      const storedSecret = await env.CACHE.get('slack:signing:tn_slack_test');
      expect(storedToken).toBe('xoxb-test-token-with-secret');
      expect(storedSecret).toBe('abc123secret456def');
    });

    it('returns 400 when bot_token is missing', async () => {
      const headers = await getAuthHeader('tn_slack_test');

      const res = await app.request('/api/tenants/tn_slack_test/integrations/slack', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when bot_token does not start with xoxb-', async () => {
      const headers = await getAuthHeader('tn_slack_test');

      const res = await app.request('/api/tenants/tn_slack_test/integrations/slack', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'invalid-slack-token',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/slack', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'xoxb-valid-token',
        }),
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_slack_test/integrations/slack', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'xoxb-valid-token',
        }),
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/tenants/:id/integrations/slack', () => {
    beforeEach(async () => {
      await env.CACHE.put('slack:bot:tn_slack_test', 'xoxb-test-token');
      await env.CACHE.put('slack:signing:tn_slack_test', 'test-secret');
    });

    it('deletes bot token and signing secret successfully', async () => {
      const headers = await getAuthHeader('tn_slack_test');

      const res = await app.request('/api/tenants/tn_slack_test/integrations/slack', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.disconnected).toBe(true);

      // Verify tokens were removed from KV
      const storedToken = await env.CACHE.get('slack:bot:tn_slack_test');
      const storedSecret = await env.CACHE.get('slack:signing:tn_slack_test');
      expect(storedToken).toBeNull();
      expect(storedSecret).toBeNull();
    });

    it('returns 404 when bot token does not exist', async () => {
      const headers = await getAuthHeader('tn_slack_test');

      // Clear any existing token
      await env.CACHE.delete('slack:bot:tn_slack_test');

      const res = await app.request('/api/tenants/tn_slack_test/integrations/slack', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toContain('No Slack integration found');
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/slack', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_slack_test/integrations/slack', {
        method: 'DELETE',
      }, env);

      expect(res.status).toBe(401);
    });
  });
});

describe('Integration Routes - Discord', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
    (env as any).CACHE = env.CACHE;
    testTenant = await createTestTenant({ id: 'tn_discord_test' });
  });

  describe('PUT /api/tenants/:id/integrations/discord', () => {
    it('saves bot token and application ID successfully', async () => {
      const headers = await getAuthHeader('tn_discord_test');

      const res = await app.request('/api/tenants/tn_discord_test/integrations/discord', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'discord-fake-test-bot-token-not-real',
          application_id: '1234567890123456789',
        }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.connected).toBe(true);

      // Verify both were stored in KV
      const storedToken = await env.CACHE.get('discord:bot:tn_discord_test');
      const storedAppId = await env.CACHE.get('discord:app:tn_discord_test');
      expect(storedToken).toBe('discord-fake-test-bot-token-not-real');
      expect(storedAppId).toBe('1234567890123456789');
    });

    it('returns 400 when bot_token is missing', async () => {
      const headers = await getAuthHeader('tn_discord_test');

      const res = await app.request('/api/tenants/tn_discord_test/integrations/discord', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: '1234567890123456789',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when application_id is missing', async () => {
      const headers = await getAuthHeader('tn_discord_test');

      const res = await app.request('/api/tenants/tn_discord_test/integrations/discord', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'valid-bot-token',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/discord', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'valid-token',
          application_id: '123456',
        }),
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_discord_test/integrations/discord', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: 'valid-token',
          application_id: '123456',
        }),
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/tenants/:id/integrations/discord', () => {
    beforeEach(async () => {
      await env.CACHE.put('discord:bot:tn_discord_test', 'test-bot-token');
      await env.CACHE.put('discord:app:tn_discord_test', 'test-app-id');
    });

    it('deletes bot token and application ID successfully', async () => {
      const headers = await getAuthHeader('tn_discord_test');

      const res = await app.request('/api/tenants/tn_discord_test/integrations/discord', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.disconnected).toBe(true);

      // Verify both were removed from KV
      const storedToken = await env.CACHE.get('discord:bot:tn_discord_test');
      const storedAppId = await env.CACHE.get('discord:app:tn_discord_test');
      expect(storedToken).toBeNull();
      expect(storedAppId).toBeNull();
    });

    it('returns 404 when bot token does not exist', async () => {
      const headers = await getAuthHeader('tn_discord_test');

      await env.CACHE.delete('discord:bot:tn_discord_test');

      const res = await app.request('/api/tenants/tn_discord_test/integrations/discord', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toContain('No Discord integration found');
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/discord', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_discord_test/integrations/discord', {
        method: 'DELETE',
      }, env);

      expect(res.status).toBe(401);
    });
  });
});

describe('Integration Routes - KakaoTalk', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
    (env as any).CACHE = env.CACHE;
    testTenant = await createTestTenant({ id: 'tn_kakaotalk_test' });
  });

  describe('PUT /api/tenants/:id/integrations/kakaotalk', () => {
    it('saves API key successfully', async () => {
      const headers = await getAuthHeader('tn_kakaotalk_test');

      const res = await app.request('/api/tenants/tn_kakaotalk_test/integrations/kakaotalk', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: 'kakao-api-key-abc123def456',
        }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.connected).toBe(true);

      // Verify API key was stored in KV
      const storedKey = await env.CACHE.get('kakaotalk:api:tn_kakaotalk_test');
      expect(storedKey).toBe('kakao-api-key-abc123def456');
    });

    it('saves API key and bot ID successfully', async () => {
      const headers = await getAuthHeader('tn_kakaotalk_test');

      const res = await app.request('/api/tenants/tn_kakaotalk_test/integrations/kakaotalk', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: 'kakao-api-key-with-bot',
          bot_id: 'bot_12345',
        }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);

      // Verify both were stored
      const storedKey = await env.CACHE.get('kakaotalk:api:tn_kakaotalk_test');
      const storedBotId = await env.CACHE.get('kakaotalk:bot:tn_kakaotalk_test');
      expect(storedKey).toBe('kakao-api-key-with-bot');
      expect(storedBotId).toBe('bot_12345');
    });

    it('returns 400 when api_key is missing', async () => {
      const headers = await getAuthHeader('tn_kakaotalk_test');

      const res = await app.request('/api/tenants/tn_kakaotalk_test/integrations/kakaotalk', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/kakaotalk', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: 'valid-key',
        }),
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_kakaotalk_test/integrations/kakaotalk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: 'valid-key',
        }),
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/tenants/:id/integrations/kakaotalk', () => {
    beforeEach(async () => {
      await env.CACHE.put('kakaotalk:api:tn_kakaotalk_test', 'test-api-key');
      await env.CACHE.put('kakaotalk:bot:tn_kakaotalk_test', 'test-bot-id');
    });

    it('deletes API key and bot ID successfully', async () => {
      const headers = await getAuthHeader('tn_kakaotalk_test');

      const res = await app.request('/api/tenants/tn_kakaotalk_test/integrations/kakaotalk', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.disconnected).toBe(true);

      // Verify both were removed from KV
      const storedKey = await env.CACHE.get('kakaotalk:api:tn_kakaotalk_test');
      const storedBotId = await env.CACHE.get('kakaotalk:bot:tn_kakaotalk_test');
      expect(storedKey).toBeNull();
      expect(storedBotId).toBeNull();
    });

    it('returns 404 when API key does not exist', async () => {
      const headers = await getAuthHeader('tn_kakaotalk_test');

      await env.CACHE.delete('kakaotalk:api:tn_kakaotalk_test');

      const res = await app.request('/api/tenants/tn_kakaotalk_test/integrations/kakaotalk', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toContain('No KakaoTalk integration found');
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/kakaotalk', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_kakaotalk_test/integrations/kakaotalk', {
        method: 'DELETE',
      }, env);

      expect(res.status).toBe(401);
    });
  });
});

describe('Integration Routes - WhatsApp', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
    (env as any).CACHE = env.CACHE;
    testTenant = await createTestTenant({ id: 'tn_whatsapp_test' });
  });

  describe('PUT /api/tenants/:id/integrations/whatsapp', () => {
    it('saves phone number ID and access token successfully', async () => {
      const headers = await getAuthHeader('tn_whatsapp_test');

      const res = await app.request('/api/tenants/tn_whatsapp_test/integrations/whatsapp', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: '1234567890123456',
          access_token: 'EAABsbCS1iHgBO7ZC9wZDZD',
        }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.connected).toBe(true);

      // Verify both were stored in KV
      const storedToken = await env.CACHE.get('whatsapp:token:tn_whatsapp_test');
      const storedPhone = await env.CACHE.get('whatsapp:phone:tn_whatsapp_test');
      expect(storedToken).toBe('EAABsbCS1iHgBO7ZC9wZDZD');
      expect(storedPhone).toBe('1234567890123456');
    });

    it('returns 400 when phone_number_id is missing', async () => {
      const headers = await getAuthHeader('tn_whatsapp_test');

      const res = await app.request('/api/tenants/tn_whatsapp_test/integrations/whatsapp', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: 'valid-token',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when access_token is missing', async () => {
      const headers = await getAuthHeader('tn_whatsapp_test');

      const res = await app.request('/api/tenants/tn_whatsapp_test/integrations/whatsapp', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: '1234567890',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/whatsapp', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: '123',
          access_token: 'token',
        }),
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_whatsapp_test/integrations/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: '123',
          access_token: 'token',
        }),
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/tenants/:id/integrations/whatsapp', () => {
    beforeEach(async () => {
      await env.CACHE.put('whatsapp:token:tn_whatsapp_test', 'test-access-token');
      await env.CACHE.put('whatsapp:phone:tn_whatsapp_test', 'test-phone-id');
    });

    it('deletes access token and phone number ID successfully', async () => {
      const headers = await getAuthHeader('tn_whatsapp_test');

      const res = await app.request('/api/tenants/tn_whatsapp_test/integrations/whatsapp', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.disconnected).toBe(true);

      // Verify both were removed from KV
      const storedToken = await env.CACHE.get('whatsapp:token:tn_whatsapp_test');
      const storedPhone = await env.CACHE.get('whatsapp:phone:tn_whatsapp_test');
      expect(storedToken).toBeNull();
      expect(storedPhone).toBeNull();
    });

    it('returns 404 when access token does not exist', async () => {
      const headers = await getAuthHeader('tn_whatsapp_test');

      await env.CACHE.delete('whatsapp:token:tn_whatsapp_test');

      const res = await app.request('/api/tenants/tn_whatsapp_test/integrations/whatsapp', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toContain('No WhatsApp integration found');
    });

    it('returns 404 when tenant does not exist', async () => {
      const headers = await getAuthHeader('tn_nonexistent');

      const res = await app.request('/api/tenants/tn_nonexistent/integrations/whatsapp', {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/tenants/tn_whatsapp_test/integrations/whatsapp', {
        method: 'DELETE',
      }, env);

      expect(res.status).toBe(401);
    });
  });
});

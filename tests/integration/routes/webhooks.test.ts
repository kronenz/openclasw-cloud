import { describe, it, expect, beforeAll, vi } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb, createTestTenant } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';

const JWT_SECRET = 'test-jwt-secret';

async function getAuthHeader(tenantId = 'tn_test-tenant-1') {
  const token = await createJWT({ sub: tenantId, role: 'admin' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe('Webhook Routes', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;

    // Create test tenant
    await createTestTenant('tn_test-tenant-1', {
      name: 'Test Corp',
      plan: 'starter',
      status: 'active',
      subdomain: 'test-corp',
      contact_email: 'test@example.com',
    });

    // Mock AI.run for all tests
    (env as any).AI = {
      run: vi.fn().mockResolvedValue({
        response: '안녕하세요! 무엇을 도와드릴까요?',
      }),
    };

    // Mock STORAGE.get for SOUL.md retrieval
    (env as any).STORAGE = {
      get: vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue('당신은 친절한 AI 비서입니다. 한국어로 응답하세요.'),
      }),
    };

    // Mock CACHE for Slack bot token
    (env as any).CACHE = {
      get: vi.fn().mockResolvedValue(null),
    };
  });

  describe('POST /api/webhooks/messenger - Telegram', () => {
    it('processes valid Telegram message', async () => {
      const headers = await getAuthHeader();
      const telegramUpdate = {
        update_id: 123456,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          from: { id: 456, first_name: 'Test', username: 'testuser' },
          text: '안녕하세요',
          date: Math.floor(Date.now() / 1000),
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'telegram',
          'X-Tenant-ID': 'tn_test-tenant-1',
        },
        body: JSON.stringify(telegramUpdate),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.received).toBe(true);
    });

    it('returns 200 for invalid Telegram update (missing text)', async () => {
      const headers = await getAuthHeader();
      const telegramUpdate = {
        update_id: 123457,
        message: {
          message_id: 2,
          chat: { id: 123, type: 'private' },
          date: Math.floor(Date.now() / 1000),
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'telegram',
          'X-Tenant-ID': 'tn_test-tenant-1',
        },
        body: JSON.stringify(telegramUpdate),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.received).toBe(true);
    });

    it('returns 403 for inactive tenant', async () => {
      // Create inactive tenant
      await env.DB.prepare(
        `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_inactive', 'Inactive Corp', 'starter', 'suspended', 'inactive', 'inactive@example.com').run();

      const headers = await getAuthHeader('tn_inactive');
      const telegramUpdate = {
        update_id: 123458,
        message: {
          message_id: 3,
          chat: { id: 123, type: 'private' },
          from: { id: 456, first_name: 'Test', username: 'testuser' },
          text: '안녕하세요',
          date: Math.floor(Date.now() / 1000),
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'telegram',
          'X-Tenant-ID': 'tn_inactive',
        },
        body: JSON.stringify(telegramUpdate),
      }, env);

      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Tenant not found or inactive');
    });
  });

  describe('POST /api/webhooks/messenger - Slack', () => {
    it('responds to URL verification challenge', async () => {
      const headers = await getAuthHeader();
      const slackChallenge = {
        type: 'url_verification',
        challenge: 'test-challenge-string',
        token: 'test-token',
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'slack',
          'X-Tenant-ID': 'tn_test-tenant-1',
        },
        body: JSON.stringify(slackChallenge),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.challenge).toBe('test-challenge-string');
    });

    it('processes valid Slack message event', async () => {
      const headers = await getAuthHeader();
      const slackEvent = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U123456',
          text: '안녕하세요',
          channel: 'C123456',
          ts: '1234567890.123456',
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'slack',
          'X-Tenant-ID': 'tn_test-tenant-1',
        },
        body: JSON.stringify(slackEvent),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.received).toBe(true);
    });

    it('returns 403 for inactive tenant', async () => {
      const headers = await getAuthHeader('tn_inactive');
      const slackEvent = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U123456',
          text: '안녕하세요',
          channel: 'C123456',
          ts: '1234567890.123456',
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'slack',
          'X-Tenant-ID': 'tn_inactive',
        },
        body: JSON.stringify(slackEvent),
      }, env);

      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Tenant not found or inactive');
    });
  });

  describe('POST /api/webhooks/messenger - Discord', () => {
    it('responds to PING with PONG', async () => {
      const headers = await getAuthHeader();
      const discordPing = {
        type: 1, // PING
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'discord',
          'X-Tenant-ID': 'tn_test-tenant-1',
        },
        body: JSON.stringify(discordPing),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.type).toBe(1); // PONG
    });

    it('processes valid Discord application command', async () => {
      const headers = await getAuthHeader();
      const discordCommand = {
        type: 2, // APPLICATION_COMMAND
        id: 'interaction-id',
        application_id: 'app-id',
        data: {
          name: 'help',
          content: '도움말',
        },
        channel_id: 'channel-123',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'discord',
          'X-Tenant-ID': 'tn_test-tenant-1',
        },
        body: JSON.stringify(discordCommand),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.type).toBe(4); // CHANNEL_MESSAGE_WITH_SOURCE
      expect(body.data.content).toBe('안녕하세요! 무엇을 도와드릴까요?');
    });

    it('returns error message for inactive tenant', async () => {
      const headers = await getAuthHeader('tn_inactive');
      const discordCommand = {
        type: 2, // APPLICATION_COMMAND
        id: 'interaction-id',
        application_id: 'app-id',
        data: {
          name: 'help',
          content: '도움말',
        },
        channel_id: 'channel-123',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'discord',
          'X-Tenant-ID': 'tn_inactive',
        },
        body: JSON.stringify(discordCommand),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.type).toBe(4);
      expect(body.data.content).toBe('서비스를 사용할 수 없습니다. 관리자에게 문의하세요.');
    });
  });

  describe('POST /api/webhooks/messenger - KakaoTalk', () => {
    it('processes valid KakaoTalk message', async () => {
      const headers = await getAuthHeader();
      const kakaoRequest = {
        userRequest: {
          utterance: '안녕하세요',
          user: {
            id: 'kakao-user-123',
            properties: {},
          },
        },
        bot: {
          id: 'tn_test-tenant-1',
        },
        action: {
          name: 'chat',
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'kakaotalk',
        },
        body: JSON.stringify(kakaoRequest),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.version).toBe('2.0');
      expect(body.template.outputs).toHaveLength(1);
      expect(body.template.outputs[0].simpleText.text).toBe('안녕하세요! 무엇을 도와드릴까요?');
    });

    it('returns error for missing utterance', async () => {
      const headers = await getAuthHeader();
      const kakaoRequest = {
        userRequest: {
          user: {
            id: 'kakao-user-123',
          },
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'kakaotalk',
        },
        body: JSON.stringify(kakaoRequest),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.version).toBe('2.0');
      expect(body.template.outputs[0].simpleText.text).toBe('메시지를 인식할 수 없습니다.');
    });

    it('returns error message for inactive tenant', async () => {
      const headers = await getAuthHeader('tn_inactive');
      const kakaoRequest = {
        userRequest: {
          utterance: '안녕하세요',
          user: {
            id: 'kakao-user-123',
          },
        },
        bot: {
          id: 'tn_inactive',
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'kakaotalk',
        },
        body: JSON.stringify(kakaoRequest),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.version).toBe('2.0');
      expect(body.template.outputs[0].simpleText.text).toBe('서비스를 사용할 수 없습니다. 관리자에게 문의하세요.');
    });
  });

  describe('POST /api/webhooks/messenger - Error Handling', () => {
    it('returns 400 when X-Tenant-ID header is missing for telegram', async () => {
      const headers = await getAuthHeader();
      const telegramUpdate = {
        update_id: 123456,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          from: { id: 456, first_name: 'Test', username: 'testuser' },
          text: '안녕하세요',
          date: Math.floor(Date.now() / 1000),
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'telegram',
        },
        body: JSON.stringify(telegramUpdate),
      }, env);

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Missing X-Tenant-ID header');
      expect(body.code).toBe('MISSING_TENANT_ID');
    });

    it('returns 400 when X-Tenant-ID header is missing for slack', async () => {
      const headers = await getAuthHeader();
      const slackEvent = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U123456',
          text: '안녕하세요',
          channel: 'C123456',
          ts: '1234567890.123456',
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'slack',
        },
        body: JSON.stringify(slackEvent),
      }, env);

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Missing X-Tenant-ID header');
      expect(body.code).toBe('MISSING_TENANT_ID');
    });

    it('returns 400 when X-Tenant-ID header is missing for discord', async () => {
      const headers = await getAuthHeader();
      const discordCommand = {
        type: 2, // APPLICATION_COMMAND
        id: 'interaction-id',
        application_id: 'app-id',
        data: {
          name: 'help',
          content: '도움말',
        },
        channel_id: 'channel-123',
        member: {
          user: { id: 'user-123', username: 'testuser' },
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'discord',
        },
        body: JSON.stringify(discordCommand),
      }, env);

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Missing X-Tenant-ID header');
      expect(body.code).toBe('MISSING_TENANT_ID');
    });

    it('returns error when bot ID is missing for kakaotalk', async () => {
      const headers = await getAuthHeader();
      const kakaoRequest = {
        userRequest: {
          utterance: '안녕하세요',
          user: {
            id: 'kakao-user-123',
          },
        },
        action: {
          name: 'chat',
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'kakaotalk',
        },
        body: JSON.stringify(kakaoRequest),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.version).toBe('2.0');
      expect(body.template.outputs[0].simpleText.text).toBe('서비스 설정이 필요합니다. 관리자에게 문의하세요.');
    });

    it('returns success for unknown platform', async () => {
      const headers = await getAuthHeader();
      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'unknown-platform',
        },
        body: JSON.stringify({ message: 'test' }),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.received).toBe(true);
    });

    it('handles AI inference failure gracefully for KakaoTalk', async () => {
      // Mock AI.run to throw error
      (env as any).AI.run = vi.fn().mockRejectedValue(new Error('AI service unavailable'));

      const headers = await getAuthHeader();
      const kakaoRequest = {
        userRequest: {
          utterance: '안녕하세요',
          user: {
            id: 'kakao-user-123',
          },
        },
        bot: {
          id: 'tn_test-tenant-1',
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'kakaotalk',
        },
        body: JSON.stringify(kakaoRequest),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.version).toBe('2.0');
      expect(body.template.outputs[0].simpleText.text).toBe('죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');

      // Restore mock
      (env as any).AI.run = vi.fn().mockResolvedValue({
        response: '안녕하세요! 무엇을 도와드릴까요?',
      });
    });

    it('handles AI inference failure gracefully for Discord', async () => {
      // Mock AI.run to throw error
      (env as any).AI.run = vi.fn().mockRejectedValue(new Error('AI service unavailable'));

      const headers = await getAuthHeader();
      const discordCommand = {
        type: 2, // APPLICATION_COMMAND
        id: 'interaction-id',
        data: {
          name: 'help',
        },
        channel_id: 'channel-123',
        member: {
          user: { id: 'user-123' },
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'discord',
          'X-Tenant-ID': 'tn_test-tenant-1',
        },
        body: JSON.stringify(discordCommand),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.type).toBe(4);
      expect(body.data.content).toBe('죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');

      // Restore mock
      (env as any).AI.run = vi.fn().mockResolvedValue({
        response: '안녕하세요! 무엇을 도와드릴까요?',
      });
    });
  });
});

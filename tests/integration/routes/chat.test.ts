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

describe('Chat API', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
    await createTestTenant({
      id: 'tn_chat-test',
      name: 'Chat Test Tenant',
      status: 'active',
      subdomain: `chat-test-${Date.now()}`,
    });
  });

  describe('POST /api/chat/:tenantId', () => {
    it('should create a new conversation and return response', async () => {
      const headers = await getAuthHeader('tn_chat-test');
      const res = await app.request('/api/chat/tn_chat-test', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello, how are you?' }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('session_id');
      expect(body.data).toHaveProperty('response');
      expect(body.data).toHaveProperty('message_id');
      expect(typeof body.data.session_id).toBe('string');
      expect(typeof body.data.response).toBe('string');
    });

    it('should use existing session_id if provided', async () => {
      const headers = await getAuthHeader('tn_chat-test');
      const sessionId = 'session_existing_test';

      const res = await app.request('/api/chat/tn_chat-test', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'First message', session_id: sessionId }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.data.session_id).toBe(sessionId);
    });

    it('should reject empty message', async () => {
      const headers = await getAuthHeader('tn_chat-test');
      const res = await app.request('/api/chat/tn_chat-test', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject message that is too long', async () => {
      const headers = await getAuthHeader('tn_chat-test');
      const longMessage = 'a'.repeat(5000);

      const res = await app.request('/api/chat/tn_chat-test', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: longMessage }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request for non-existent tenant', async () => {
      const headers = await getAuthHeader('tn_nonexistent');
      const res = await app.request('/api/chat/tn_nonexistent', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TENANT_NOT_FOUND');
    });
  });

  describe('GET /api/chat/:tenantId/history', () => {
    it('should return list of sessions', async () => {
      const headers = await getAuthHeader('tn_chat-test');

      // Create a message first
      await app.request('/api/chat/tn_chat-test', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test for history', session_id: 'session_history_1' }),
      }, env);

      // Get sessions
      const res = await app.request('/api/chat/tn_chat-test/history', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('sessions');
      expect(Array.isArray(body.data.sessions)).toBe(true);
      expect(body.data.sessions.length).toBeGreaterThan(0);
      expect(body.data.sessions[0]).toHaveProperty('session_id');
      expect(body.data.sessions[0]).toHaveProperty('last_message_at');
      expect(body.data.sessions[0]).toHaveProperty('message_count');
    });

    it('should return messages for specific session', async () => {
      const headers = await getAuthHeader('tn_chat-test');
      const sessionId = 'session_msgs_test';

      // Create messages
      await app.request('/api/chat/tn_chat-test', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Message 1', session_id: sessionId }),
      }, env);

      // Get messages
      const res = await app.request(`/api/chat/tn_chat-test/history?session_id=${sessionId}`, {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('session_id');
      expect(body.data.session_id).toBe(sessionId);
      expect(body.data).toHaveProperty('messages');
      expect(Array.isArray(body.data.messages)).toBe(true);
      // Should have at least 2 messages (1 user + 1 assistant)
      expect(body.data.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject invalid limit', async () => {
      const headers = await getAuthHeader('tn_chat-test');
      const res = await app.request('/api/chat/tn_chat-test/history?limit=1000', {
        method: 'GET',
        headers,
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/chat/:tenantId/history/:sessionId', () => {
    it('should delete conversation session', async () => {
      const headers = await getAuthHeader('tn_chat-test');
      const sessionId = 'session_delete_test';

      // Create a message
      await app.request('/api/chat/tn_chat-test', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'To be deleted', session_id: sessionId }),
      }, env);

      // Delete session
      const res = await app.request(`/api/chat/tn_chat-test/history/${sessionId}`, {
        method: 'DELETE',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.session_id).toBe(sessionId);
      expect(body.data.deleted).toBe(true);

      // Verify messages are deleted
      const res2 = await app.request(`/api/chat/tn_chat-test/history?session_id=${sessionId}`, {
        method: 'GET',
        headers,
      }, env);
      const body2 = await parseApiResponse(res2);
      expect(body2.data.messages.length).toBe(0);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for POST', async () => {
      const res = await app.request('/api/chat/tn_chat-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      }, env);

      expect(res.status).toBe(401);
    });

    it('should require authentication for GET history', async () => {
      const res = await app.request('/api/chat/tn_chat-test/history', {
        method: 'GET',
      }, env);

      expect(res.status).toBe(401);
    });

    it('should require authentication for DELETE', async () => {
      const res = await app.request('/api/chat/tn_chat-test/history/session123', {
        method: 'DELETE',
      }, env);

      expect(res.status).toBe(401);
    });
  });
});

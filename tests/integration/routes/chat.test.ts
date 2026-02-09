import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/index.js';
import { createTestEnv, createTestTenant, createTestAuth } from '../../helpers.js';

describe('Chat API', () => {
  let env: ReturnType<typeof createTestEnv>;
  let tenantId: string;
  let authHeader: string;

  beforeEach(async () => {
    env = createTestEnv();
    const tenant = await createTestTenant(env.DB, { name: 'Chat Test Tenant', status: 'active' });
    tenantId = tenant.id;
    authHeader = await createTestAuth(env, tenantId);
  });

  describe('POST /api/chat/:tenantId', () => {
    it('should create a new conversation and return AI response', async () => {
      const req = new Request(`http://localhost/api/chat/${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          message: 'Hello, how are you?',
        }),
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('session_id');
      expect(json.data).toHaveProperty('response');
      expect(json.data).toHaveProperty('message_id');
      expect(typeof json.data.session_id).toBe('string');
      expect(typeof json.data.response).toBe('string');
    });

    it('should use existing session_id if provided', async () => {
      const sessionId = 'session_test123';

      // First message
      const req1 = new Request(`http://localhost/api/chat/${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          message: 'First message',
          session_id: sessionId,
        }),
      });

      const res1 = await app.fetch(req1, env);
      expect(res1.status).toBe(200);

      const json1 = await res1.json();
      expect(json1.data.session_id).toBe(sessionId);

      // Second message in same session
      const req2 = new Request(`http://localhost/api/chat/${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          message: 'Second message',
          session_id: sessionId,
        }),
      });

      const res2 = await app.fetch(req2, env);
      expect(res2.status).toBe(200);

      const json2 = await res2.json();
      expect(json2.data.session_id).toBe(sessionId);
    });

    it('should reject empty message', async () => {
      const req = new Request(`http://localhost/api/chat/${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          message: '',
        }),
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should reject message that is too long', async () => {
      const longMessage = 'a'.repeat(5000);

      const req = new Request(`http://localhost/api/chat/${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          message: longMessage,
        }),
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request for inactive tenant', async () => {
      const inactiveTenant = await createTestTenant(env.DB, {
        name: 'Inactive Tenant',
        status: 'suspended'
      });
      const inactiveAuth = await createTestAuth(env, inactiveTenant.id);

      const req = new Request(`http://localhost/api/chat/${inactiveTenant.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': inactiveAuth,
        },
        body: JSON.stringify({
          message: 'Hello',
        }),
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('TENANT_NOT_FOUND');
    });
  });

  describe('GET /api/chat/:tenantId/history', () => {
    it('should return list of sessions when no session_id provided', async () => {
      // Create some messages first
      const req1 = new Request(`http://localhost/api/chat/${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          message: 'Test message',
          session_id: 'session1',
        }),
      });
      await app.fetch(req1, env);

      // Get sessions
      const req2 = new Request(`http://localhost/api/chat/${tenantId}/history`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      const res = await app.fetch(req2, env);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('sessions');
      expect(Array.isArray(json.data.sessions)).toBe(true);
      expect(json.data.sessions.length).toBeGreaterThan(0);
      expect(json.data.sessions[0]).toHaveProperty('session_id');
      expect(json.data.sessions[0]).toHaveProperty('last_message_at');
      expect(json.data.sessions[0]).toHaveProperty('message_count');
    });

    it('should return messages for specific session', async () => {
      const sessionId = 'session_history_test';

      // Create some messages
      for (let i = 0; i < 3; i++) {
        const req = new Request(`http://localhost/api/chat/${tenantId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            message: `Message ${i + 1}`,
            session_id: sessionId,
          }),
        });
        await app.fetch(req, env);
      }

      // Get messages
      const req = new Request(`http://localhost/api/chat/${tenantId}/history?session_id=${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('session_id');
      expect(json.data.session_id).toBe(sessionId);
      expect(json.data).toHaveProperty('messages');
      expect(Array.isArray(json.data.messages)).toBe(true);
      // Should have 3 user messages + 3 assistant responses = 6 total
      expect(json.data.messages.length).toBe(6);
    });

    it('should respect limit parameter', async () => {
      const sessionId = 'session_limit_test';

      // Create many messages
      for (let i = 0; i < 10; i++) {
        const req = new Request(`http://localhost/api/chat/${tenantId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            message: `Message ${i + 1}`,
            session_id: sessionId,
          }),
        });
        await app.fetch(req, env);
      }

      // Get limited messages
      const req = new Request(`http://localhost/api/chat/${tenantId}/history?session_id=${sessionId}&limit=5`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.messages.length).toBe(5);
    });

    it('should reject invalid limit', async () => {
      const req = new Request(`http://localhost/api/chat/${tenantId}/history?limit=1000`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/chat/:tenantId/history/:sessionId', () => {
    it('should delete conversation session', async () => {
      const sessionId = 'session_delete_test';

      // Create messages
      const req1 = new Request(`http://localhost/api/chat/${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          message: 'Test message',
          session_id: sessionId,
        }),
      });
      await app.fetch(req1, env);

      // Delete session
      const req2 = new Request(`http://localhost/api/chat/${tenantId}/history/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': authHeader,
        },
      });

      const res = await app.fetch(req2, env);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.session_id).toBe(sessionId);
      expect(json.data.deleted).toBe(true);

      // Verify messages are deleted
      const req3 = new Request(`http://localhost/api/chat/${tenantId}/history?session_id=${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      const res3 = await app.fetch(req3, env);
      const json3 = await res3.json();
      expect(json3.data.messages.length).toBe(0);
    });

    it('should reject deletion for inactive tenant', async () => {
      const inactiveTenant = await createTestTenant(env.DB, {
        name: 'Inactive Tenant',
        status: 'suspended'
      });
      const inactiveAuth = await createTestAuth(env, inactiveTenant.id);

      const req = new Request(`http://localhost/api/chat/${inactiveTenant.id}/history/session123`, {
        method: 'DELETE',
        headers: {
          'Authorization': inactiveAuth,
        },
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('TENANT_NOT_FOUND');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for POST', async () => {
      const req = new Request(`http://localhost/api/chat/${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello',
        }),
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(401);
    });

    it('should require authentication for GET', async () => {
      const req = new Request(`http://localhost/api/chat/${tenantId}/history`, {
        method: 'GET',
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(401);
    });

    it('should require authentication for DELETE', async () => {
      const req = new Request(`http://localhost/api/chat/${tenantId}/history/session123`, {
        method: 'DELETE',
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(401);
    });
  });
});

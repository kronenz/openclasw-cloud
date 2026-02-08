import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';

const JWT_SECRET = 'test-jwt-secret';

describe('Auth Middleware', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
  });

  it('allows unauthenticated access to /health', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
  });

  it('rejects requests without Authorization header', async () => {
    const res = await app.request('/api/tenants', {}, env);
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  it('rejects requests with invalid Bearer token', async () => {
    const res = await app.request('/api/tenants', {
      headers: { Authorization: 'Bearer invalid-token' },
    }, env);
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('AUTH_INVALID');
  });

  it('accepts requests with valid JWT', async () => {
    const token = await createJWT({ sub: 'tn_test', role: 'admin' }, JWT_SECRET);
    const res = await app.request('/api/tenants', {
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(200);
  });

  it('rejects expired tokens', async () => {
    const token = await createJWT({ sub: 'tn_test' }, JWT_SECRET, -1);
    const res = await app.request('/api/tenants', {
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(401);
  });

  it('rejects tokens with wrong secret', async () => {
    const token = await createJWT({ sub: 'tn_test' }, 'wrong-secret');
    const res = await app.request('/api/tenants', {
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(401);
  });
});

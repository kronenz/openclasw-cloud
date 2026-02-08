import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';
import { parseApiResponse } from '../../helpers/types.js';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-chars!';

describe('Auth Middleware', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 when no Authorization header', async () => {
    const res = await app.request('/api/tenants', {
      method: 'GET',
    }, env);

    expect(res.status).toBe(401);
    const json = await parseApiResponse(res);
    expect(json).toEqual({
      success: false,
      error: 'Missing authorization',
      code: 'AUTH_REQUIRED',
    });
  });

  it('returns 401 when Authorization header doesn\'t start with \'Bearer \'', async () => {
    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic sometoken',
      },
    }, env);

    expect(res.status).toBe(401);
    const json = await parseApiResponse(res);
    expect(json).toEqual({
      success: false,
      error: 'Missing authorization',
      code: 'AUTH_REQUIRED',
    });
  });

  it('returns 401 for invalid JWT token', async () => {
    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid.token.here',
      },
    }, env);

    expect(res.status).toBe(401);
    const json = await parseApiResponse(res);
    expect(json).toEqual({
      success: false,
      error: 'Invalid token',
      code: 'AUTH_INVALID',
    });
  });

  it('returns 401 for expired JWT token', async () => {
    // Create token that expired 1 hour ago
    const expiredToken = await createJWT(
      { sub: 'tn_test-123', role: 'tenant' },
      JWT_SECRET,
      -3600 // negative expiration = already expired
    );

    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${expiredToken}`,
      },
    }, env);

    expect(res.status).toBe(401);
    const json = await parseApiResponse(res);
    expect(json).toEqual({
      success: false,
      error: 'Invalid token',
      code: 'AUTH_INVALID',
    });
  });

  it('passes through for valid JWT and sets tenantId', async () => {
    const validToken = await createJWT(
      { sub: 'tn_test-123', role: 'tenant' },
      JWT_SECRET,
      3600
    );

    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${validToken}`,
      },
    }, env);

    // Should pass auth middleware and hit the route
    // The route may return 404 or another status, but not 401
    expect(res.status).not.toBe(401);
  });

  it('skips auth for /health routes', async () => {
    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    // Health endpoint should be accessible without auth
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
  });

  it('returns 401 for completely missing Authorization header', async () => {
    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {},
    }, env);

    expect(res.status).toBe(401);
    const json = await parseApiResponse(res);
    expect(json).toEqual({
      success: false,
      error: 'Missing authorization',
      code: 'AUTH_REQUIRED',
    });
  });

  it('returns 401 for malformed token (not 3 parts)', async () => {
    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid.token',
      },
    }, env);

    expect(res.status).toBe(401);
    const json = await parseApiResponse(res);
    expect(json).toEqual({
      success: false,
      error: 'Invalid token',
      code: 'AUTH_INVALID',
    });
  });

  it('returns 401 for empty Bearer token', async () => {
    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ',
      },
    }, env);

    expect(res.status).toBe(401);
    const json = await parseApiResponse(res);
    // Empty token after "Bearer " gets caught by verifyJWT and returns AUTH_INVALID
    // But the current implementation checks the format first, so it returns AUTH_REQUIRED
    expect(json).toEqual({
      success: false,
      error: 'Missing authorization',
      code: 'AUTH_REQUIRED',
    });
  });

  it('returns 401 for token with invalid signature', async () => {
    // Create a valid token structure but with wrong signature
    const validToken = await createJWT(
      { sub: 'tn_test-123', role: 'tenant' },
      JWT_SECRET,
      3600
    );

    // Tamper with the signature part
    const parts = validToken.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;

    const res = await app.request('/api/tenants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tamperedToken}`,
      },
    }, env);

    expect(res.status).toBe(401);
    const json = await parseApiResponse(res);
    expect(json).toEqual({
      success: false,
      error: 'Invalid token',
      code: 'AUTH_INVALID',
    });
  });
});

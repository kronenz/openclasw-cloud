import { describe, it, expect } from 'vitest';
import { createJWT, verifyJWT, generateApiKey } from '../../../src/utils/crypto.js';

const TEST_SECRET = 'test-jwt-secret-key-for-testing';

describe('JWT', () => {
  it('creates and verifies a valid JWT', async () => {
    const payload = { sub: 'tn_test-123', role: 'admin' };
    const token = await createJWT(payload, TEST_SECRET, 3600);

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const verified = await verifyJWT(token, TEST_SECRET);
    expect(verified.sub).toBe('tn_test-123');
    expect(verified.role).toBe('admin');
    expect(verified.iat).toBeDefined();
    expect(verified.exp).toBeDefined();
  });

  it('rejects JWT with wrong secret', async () => {
    const token = await createJWT({ sub: 'test' }, TEST_SECRET);
    await expect(verifyJWT(token, 'wrong-secret')).rejects.toThrow('Invalid JWT signature');
  });

  it('rejects expired JWT', async () => {
    const token = await createJWT({ sub: 'test' }, TEST_SECRET, -1);
    await expect(verifyJWT(token, TEST_SECRET)).rejects.toThrow('JWT expired');
  });

  it('rejects malformed JWT', async () => {
    await expect(verifyJWT('not.a.jwt', TEST_SECRET)).rejects.toThrow();
    await expect(verifyJWT('invalid', TEST_SECRET)).rejects.toThrow('Invalid JWT format');
  });

  it('throws on malformed JWT payload', async () => {
    // Create a JWT-like string with valid structure but invalid JSON payload
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const invalidPayload = btoa('not-valid-json').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    // Create a dummy signature
    const signature = 'dummysignature';
    const malformedToken = `${header}.${invalidPayload}.${signature}`;

    await expect(verifyJWT(malformedToken, TEST_SECRET))
      .rejects.toThrow();
  });

  it('includes iat and exp claims', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await createJWT({ sub: 'test' }, TEST_SECRET, 3600);
    const after = Math.floor(Date.now() / 1000);

    const payload = await verifyJWT(token, TEST_SECRET);
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
    expect(payload.exp).toBe((payload.iat as number) + 3600);
  });
});

describe('API Key Generation', () => {
  it('generates 64-character hex string', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey()));
    expect(keys.size).toBe(50);
  });
});

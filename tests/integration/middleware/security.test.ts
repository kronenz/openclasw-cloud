import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';

describe('Security Middleware', () => {
  beforeAll(() => {
    // Ensure environment is set for testing
    if (!(env as any).ENVIRONMENT) {
      (env as any).ENVIRONMENT = 'test';
    }
  });

  it('sets X-Content-Type-Options header', async () => {
    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-Frame-Options header', async () => {
    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('sets Referrer-Policy header', async () => {
    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('sets X-XSS-Protection header', async () => {
    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
  });

  it('sets Permissions-Policy header', async () => {
    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('sets CSP and HSTS headers in production environment', async () => {
    // Save original environment
    const originalEnv = (env as any).ENVIRONMENT;

    // Set to production
    (env as any).ENVIRONMENT = 'production';

    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');

    // Restore original environment
    (env as any).ENVIRONMENT = originalEnv;
  });

  it('sets CSP in all environments but HSTS only in production', async () => {
    // Ensure we're in test/development
    (env as any).ENVIRONMENT = 'test';

    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    // CSP applies in all environments to catch issues early
    expect(res.headers.get('Content-Security-Policy')).not.toBeNull();
    // HSTS only in production (breaks dev with HTTP)
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('applies security headers to all routes', async () => {
    const res = await app.request('/api/nonexistent', {
      method: 'GET',
    }, env);

    // Even on 404, security headers should be present
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});

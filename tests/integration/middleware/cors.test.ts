import { describe, it, expect } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';

describe('CORS Middleware', () => {
  it('allows requests with no origin header', async () => {
    const res = await app.request('/health', {
      method: 'GET',
    }, env);
    expect(res.status).toBe(200);
  });

  it('allows requests from localhost', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'http://localhost:3000' },
    }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  it('allows requests from openclaw.ai', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'https://openclaw.ai' },
    }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://openclaw.ai');
  });

  it('allows requests from openclaw.ai subdomains', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'https://dashboard.openclaw.ai' },
    }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://dashboard.openclaw.ai');
  });

  it('denies requests from unauthorized origins', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'https://evil-site.com' },
    }, env);
    // Hono CORS returns null origin which means no CORS headers
    const allowOrigin = res.headers.get('Access-Control-Allow-Origin');
    expect(allowOrigin).toBeNull();
  });

  it('handles OPTIONS preflight requests', async () => {
    const res = await app.request('/api/tenants', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://openclaw.ai',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    }, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://openclaw.ai');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('allows 127.0.0.1 origin', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'http://127.0.0.1:8787' },
    }, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:8787');
  });

  it('sets credentials header to true', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'https://openclaw.ai' },
    }, env);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('allows all standard HTTP methods', async () => {
    const res = await app.request('/api/tenants', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://openclaw.ai',
        'Access-Control-Request-Method': 'DELETE',
      },
    }, env);
    const allowMethods = res.headers.get('Access-Control-Allow-Methods');
    expect(allowMethods).toContain('GET');
    expect(allowMethods).toContain('POST');
    expect(allowMethods).toContain('PUT');
    expect(allowMethods).toContain('DELETE');
    expect(allowMethods).toContain('OPTIONS');
  });

  it('allows all custom headers in CORS config', async () => {
    const res = await app.request('/api/tenants', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://openclaw.ai',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'X-Platform-Type, X-Tenant-ID',
      },
    }, env);
    const allowHeaders = res.headers.get('Access-Control-Allow-Headers');
    expect(allowHeaders).toContain('Content-Type');
    expect(allowHeaders).toContain('Authorization');
    expect(allowHeaders).toContain('X-Platform-Type');
    expect(allowHeaders).toContain('X-Tenant-ID');
  });

  it('denies origins with localhost as substring (e.g. evil-localhost.com)', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'https://evil-localhost.com' },
    }, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('denies subdomain-like strings that do not end with .openclaw.ai', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'https://openclaw.ai.evil.com' },
    }, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows localhost with different ports', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'http://localhost:5173' },
    }, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('allows deeply nested subdomains', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'Origin': 'https://staging.api.openclaw.ai' },
    }, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://staging.api.openclaw.ai');
  });
});

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { envValidatorMiddleware } from '../../../src/middleware/env-validator.js';
import { parseApiResponse } from '../../helpers/types.js';

describe('Environment Validator Middleware', () => {
  beforeAll(() => {
    // Mock console.error to avoid test output clutter
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows requests when all required bindings are present', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const env = {
      DB: {},      // mock D1
      STORAGE: {}, // mock R2
      CACHE: {},   // mock KV
      JWT_SECRET: 'test-secret',
      AI: {},      // mock AI Gateway
      ENVIRONMENT: 'test',
    };

    const res = await app.request('/test', {}, env);
    expect(res.status).toBe(200);
    const body = await parseApiResponse(res);
    expect(body.ok).toBe(true);
  });

  it('returns 503 when DB binding is missing', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const env = {
      STORAGE: {},
      CACHE: {},
      JWT_SECRET: 'test-secret',
      AI: {},
      ENVIRONMENT: 'test',
    };

    const res = await app.request('/test', {}, env);
    expect(res.status).toBe(503);
    const body = await parseApiResponse(res);
    expect(body.success).toBe(false);
    expect(body.code).toBe('CONFIGURATION_ERROR');
    expect(body.error).toBe('Service configuration error');
  });

  it('returns 503 when STORAGE binding is missing', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const env = {
      DB: {},
      CACHE: {},
      JWT_SECRET: 'test-secret',
      AI: {},
      ENVIRONMENT: 'test',
    };

    const res = await app.request('/test', {}, env);
    expect(res.status).toBe(503);
    const body = await parseApiResponse(res);
    expect(body.success).toBe(false);
    expect(body.code).toBe('CONFIGURATION_ERROR');
  });

  it('returns 503 when CACHE binding is missing', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const env = {
      DB: {},
      STORAGE: {},
      JWT_SECRET: 'test-secret',
      AI: {},
      ENVIRONMENT: 'test',
    };

    const res = await app.request('/test', {}, env);
    expect(res.status).toBe(503);
    const body = await parseApiResponse(res);
    expect(body.success).toBe(false);
    expect(body.code).toBe('CONFIGURATION_ERROR');
  });

  it('returns 503 when AI binding is missing', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const env = {
      DB: {},
      STORAGE: {},
      CACHE: {},
      JWT_SECRET: 'test-secret',
      ENVIRONMENT: 'test',
    };

    const res = await app.request('/test', {}, env);
    expect(res.status).toBe(503);
    const body = await parseApiResponse(res);
    expect(body.success).toBe(false);
    expect(body.code).toBe('CONFIGURATION_ERROR');
  });

  it('returns 503 when all bindings are missing', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {}, {});
    expect(res.status).toBe(503);
    const body = await parseApiResponse(res);
    expect(body.success).toBe(false);
    expect(body.code).toBe('CONFIGURATION_ERROR');
  });

  it('logs structured error when bindings are missing', async () => {
    const errorSpy = vi.spyOn(console, 'error');

    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test', {}, {});

    expect(errorSpy).toHaveBeenCalled();
    const logCall = errorSpy.mock.calls[errorSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    expect(logData.level).toBe('error');
    expect(logData.event).toBe('missing_required_bindings');
    expect(logData.error_message).toContain('Missing bindings');
  });

  it('returns 503 when JWT_SECRET is missing', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const env = {
      DB: {},
      STORAGE: {},
      CACHE: {},
      AI: {},
      ENVIRONMENT: 'test',
    };

    const res = await app.request('/test', {}, env);
    expect(res.status).toBe(503);
    const body = await parseApiResponse(res);
    expect(body.success).toBe(false);
    expect(body.code).toBe('CONFIGURATION_ERROR');
  });

  it('returns 503 when ENVIRONMENT binding is missing', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const env = {
      DB: {},
      STORAGE: {},
      CACHE: {},
      JWT_SECRET: 'test-secret',
      AI: {},
    };

    const res = await app.request('/test', {}, env);
    expect(res.status).toBe(503);
    const body = await parseApiResponse(res);
    expect(body.success).toBe(false);
    expect(body.code).toBe('CONFIGURATION_ERROR');
  });

  it('checks all required bindings progressively', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    // Missing all
    const res1 = await app.request('/test', {}, {});
    expect(res1.status).toBe(503);

    // Missing five
    const res2 = await app.request('/test', {}, { DB: {} });
    expect(res2.status).toBe(503);

    // Missing four
    const res3 = await app.request('/test', {}, { DB: {}, STORAGE: {} });
    expect(res3.status).toBe(503);

    // Missing three
    const res4 = await app.request('/test', {}, { DB: {}, STORAGE: {}, CACHE: {} });
    expect(res4.status).toBe(503);

    // Missing two
    const res5 = await app.request('/test', {}, { DB: {}, STORAGE: {}, CACHE: {}, JWT_SECRET: 'test' });
    expect(res5.status).toBe(503);

    // Missing one (ENVIRONMENT)
    const res6 = await app.request('/test', {}, { DB: {}, STORAGE: {}, CACHE: {}, JWT_SECRET: 'test', AI: {} });
    expect(res6.status).toBe(503);

    // All present
    const res7 = await app.request('/test', {}, { DB: {}, STORAGE: {}, CACHE: {}, JWT_SECRET: 'test', AI: {}, ENVIRONMENT: 'test' });
    expect(res7.status).toBe(200);
  });
});

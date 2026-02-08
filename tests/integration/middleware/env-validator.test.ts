import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { envValidatorMiddleware } from '../../../src/middleware/env-validator.js';
import { parseApiResponse } from '../../helpers/types.js';

describe('Environment Validator Middleware', () => {
  beforeAll(() => {
    // Mock console.error to avoid test output clutter
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('allows requests when all required bindings are present', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const env = {
      DB: {},      // mock D1
      STORAGE: {}, // mock R2
      CACHE: {},   // mock KV
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

  it('checks all three required bindings', async () => {
    const app = new Hono();
    app.use('*', envValidatorMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    // Missing all three
    const res1 = await app.request('/test', {}, {});
    expect(res1.status).toBe(503);

    // Missing two
    const res2 = await app.request('/test', {}, { DB: {} });
    expect(res2.status).toBe(503);

    // Missing one
    const res3 = await app.request('/test', {}, { DB: {}, STORAGE: {} });
    expect(res3.status).toBe(503);

    // All present
    const res4 = await app.request('/test', {}, { DB: {}, STORAGE: {}, CACHE: {} });
    expect(res4.status).toBe(200);
  });
});

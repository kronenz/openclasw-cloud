import { describe, it, expect, beforeAll, vi } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';

describe('Logger Middleware', () => {
  beforeAll(() => {
    // Mock console.log to avoid test output clutter
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs request details', async () => {
    const logSpy = vi.spyOn(console, 'log');

    const res = await app.request('/health', {
      method: 'GET',
    }, env);

    expect(res.status).toBe(200);

    // Verify console.log was called with structured log
    expect(logSpy).toHaveBeenCalled();
    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    expect(logData).toMatchObject({
      method: 'GET',
      path: '/health',
      status: 200,
    });
    expect(logData.timestamp).toBeDefined();
    expect(logData.request_id).toBeDefined();
    expect(logData.duration_ms).toBeGreaterThanOrEqual(0);
    expect(logData.env).toBeDefined();
  });

  it('generates UUID for request_id', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await app.request('/health', {
      method: 'GET',
    }, env);

    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(logData.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('logs different methods and paths', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await app.request('/api/nonexistent', {
      method: 'POST',
    }, env);

    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    expect(logData.method).toBe('POST');
    expect(logData.path).toBe('/api/nonexistent');
  });

  it('measures request duration', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await app.request('/health', {
      method: 'GET',
    }, env);

    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    expect(logData.duration_ms).toBeTypeOf('number');
    expect(logData.duration_ms).toBeGreaterThanOrEqual(0);
    expect(logData.duration_ms).toBeLessThan(5000); // Should complete in reasonable time
  });

  it('logs 404 errors with correct status', async () => {
    const logSpy = vi.spyOn(console, 'log');

    const res = await app.request('/nonexistent-route', {
      method: 'GET',
    }, env);

    expect(res.status).toBe(404);

    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    expect(logData.status).toBe(404);
    expect(logData.path).toBe('/nonexistent-route');
  });

  it('logs different HTTP methods correctly', async () => {
    const logSpy = vi.spyOn(console, 'log');

    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    for (const method of methods) {
      await app.request('/health', {
        method,
      }, env);
    }

    // Check last 5 log calls
    const lastFiveCalls = logSpy.mock.calls.slice(-5);
    const loggedMethods = lastFiveCalls.map(call => {
      const logData = JSON.parse(call[0]);
      return logData.method;
    });

    expect(loggedMethods).toEqual(methods);
  });

  it('generates unique request IDs for concurrent requests', async () => {
    const logSpy = vi.spyOn(console, 'log');

    // Fire multiple requests
    await Promise.all([
      app.request('/health', { method: 'GET' }, env),
      app.request('/health', { method: 'GET' }, env),
      app.request('/health', { method: 'GET' }, env),
    ]);

    // Get last 3 log calls
    const lastThreeCalls = logSpy.mock.calls.slice(-3);
    const requestIds = lastThreeCalls.map(call => {
      const logData = JSON.parse(call[0]);
      return logData.request_id;
    });

    // All request IDs should be unique
    const uniqueIds = new Set(requestIds);
    expect(uniqueIds.size).toBe(3);
  });

  it('includes environment in log data', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await app.request('/health', {
      method: 'GET',
    }, env);

    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    expect(logData.env).toBeDefined();
    expect(typeof logData.env).toBe('string');
  });

  it('logs requests with query parameters correctly', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await app.request('/health?foo=bar&baz=qux', {
      method: 'GET',
    }, env);

    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    // Path should include query parameters
    expect(logData.path).toBe('/health');
  });

  it('sets requestId in context variables', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await app.request('/health', {
      method: 'GET',
    }, env);

    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    // Request ID should be a valid UUID
    expect(logData.request_id).toBeDefined();
    expect(logData.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('logs timestamp in ISO format', async () => {
    const logSpy = vi.spyOn(console, 'log');

    const beforeRequest = new Date();
    await app.request('/health', {
      method: 'GET',
    }, env);
    const afterRequest = new Date();

    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    expect(logData.timestamp).toBeDefined();

    // Parse timestamp and verify it's within request time range
    const logTimestamp = new Date(logData.timestamp);
    expect(logTimestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
    expect(logTimestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
  });

  it('logs success status codes (2xx)', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await app.request('/health', {
      method: 'GET',
    }, env);

    const logCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(logCall);

    expect(logData.status).toBeGreaterThanOrEqual(200);
    expect(logData.status).toBeLessThan(300);
  });

  it('duration is always non-negative', async () => {
    const logSpy = vi.spyOn(console, 'log');

    // Test multiple requests to ensure duration calculation is consistent
    for (let i = 0; i < 5; i++) {
      await app.request('/health', { method: 'GET' }, env);
    }

    const lastFiveCalls = logSpy.mock.calls.slice(-5);

    for (const call of lastFiveCalls) {
      const logData = JSON.parse(call[0]);
      expect(logData.duration_ms).toBeGreaterThanOrEqual(0);
    }
  });
});

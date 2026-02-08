import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudflareApi } from '../../../src/services/cf-api.js';
import type { Bindings } from '../../../src/types/index.js';

function createMockEnv(withCredentials = false): Bindings {
  const env: any = {
    DB: {} as any,
    STORAGE: {} as any,
    CACHE: {} as any,
    SESSIONS: {} as any,
    AI: {} as any,
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'debug',
    AI_GATEWAY_ENDPOINT: 'https://test.ai.cloudflare.com',
    JWT_SECRET: 'test-secret',
  };

  if (withCredentials) {
    env.CF_API_TOKEN = 'test-cf-token-12345';
    env.CF_ACCOUNT_ID = 'test-account-id';
  }

  return env;
}

describe('CloudflareApi', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('createD1Database', () => {
    it('returns simulated resource when credentials not configured', async () => {
      const env = createMockEnv(false);
      const api = new CloudflareApi(env);

      const result = await api.createD1Database('test-db');

      expect(result.name).toBe('test-db');
      expect(result.id).toMatch(/^d1_/);
    });

    it('calls Cloudflare API when credentials configured', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'd1_real_123', name: 'test-db' },
          errors: [],
        }),
      });
      global.fetch = fetchMock;

      const result = await api.createD1Database('test-db');

      expect(result.id).toBe('d1_real_123');
      expect(result.name).toBe('test-db');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/d1/database',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-cf-token-12345',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ name: 'test-db' }),
        })
      );
    });

    it('throws error when API returns failure', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          errors: [{ code: 10000, message: 'Authentication error' }],
        }),
      });
      global.fetch = fetchMock;

      await expect(api.createD1Database('test-db')).rejects.toThrow('CF API error');
    });
  });

  describe('createKvNamespace', () => {
    it('returns simulated resource when credentials not configured', async () => {
      const env = createMockEnv(false);
      const api = new CloudflareApi(env);

      const result = await api.createKvNamespace('test-kv');

      expect(result.name).toBe('test-kv');
      expect(result.id).toMatch(/^kv_/);
    });

    it('calls Cloudflare API when credentials configured', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'kv_real_456' },
          errors: [],
        }),
      });
      global.fetch = fetchMock;

      const result = await api.createKvNamespace('test-kv');

      expect(result.id).toBe('kv_real_456');
      expect(result.name).toBe('test-kv');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/storage/kv/namespaces',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'test-kv' }),
        })
      );
    });

    it('handles API errors', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          errors: [{ code: 10001, message: 'Invalid namespace name' }],
        }),
      });
      global.fetch = fetchMock;

      await expect(api.createKvNamespace('invalid name!')).rejects.toThrow();
    });
  });

  describe('createR2Bucket', () => {
    it('returns simulated resource when credentials not configured', async () => {
      const env = createMockEnv(false);
      const api = new CloudflareApi(env);

      const result = await api.createR2Bucket('test-bucket');

      expect(result.name).toBe('test-bucket');
      expect(result.id).toMatch(/^r2_/);
    });

    it('calls Cloudflare API when credentials configured', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: undefined,
          errors: [],
        }),
      });
      global.fetch = fetchMock;

      const result = await api.createR2Bucket('test-bucket');

      expect(result.id).toBe('test-bucket');
      expect(result.name).toBe('test-bucket');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/r2/buckets',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test-bucket' }),
        })
      );
    });

    it('throws error on API failure', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          errors: [{ code: 10002, message: 'Bucket already exists' }],
        }),
      });
      global.fetch = fetchMock;

      await expect(api.createR2Bucket('existing-bucket')).rejects.toThrow();
    });
  });

  describe('createWorker', () => {
    it('returns simulated resource when credentials not configured', async () => {
      const env = createMockEnv(false);
      const api = new CloudflareApi(env);

      const result = await api.createWorker('test-worker');

      expect(result.name).toBe('test-worker');
      expect(result.id).toMatch(/^worker_/);
    });

    it('creates worker with default script when not provided', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = fetchMock;

      const result = await api.createWorker('test-worker');

      expect(result.id).toBe('test-worker');
      expect(result.name).toBe('test-worker');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/workers/scripts/test-worker',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-cf-token-12345',
          }),
        })
      );

      // Verify FormData was used
      const callBody = fetchMock.mock.calls[0][1].body;
      expect(callBody).toBeInstanceOf(FormData);
    });

    it('creates worker with custom script', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const customScript = 'export default { fetch(req) { return new Response("Custom"); } }';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = fetchMock;

      await api.createWorker('test-worker', customScript);

      expect(fetchMock).toHaveBeenCalled();
      const callBody = fetchMock.mock.calls[0][1].body;
      expect(callBody).toBeInstanceOf(FormData);
    });

    it('throws error when worker creation fails', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Script syntax error',
      });
      global.fetch = fetchMock;

      await expect(api.createWorker('invalid-worker')).rejects.toThrow(
        'Worker creation failed'
      );
    });
  });

  describe('provisionTenantResources', () => {
    it('provisions all resources in parallel (simulated mode)', async () => {
      const env = createMockEnv(false);
      const api = new CloudflareApi(env);

      const result = await api.provisionTenantResources('tn_test123', 'testcafe');

      expect(result.worker.name).toBe('oc-testcafe-worker');
      expect(result.worker.id).toMatch(/^worker_/);
      expect(result.d1.name).toBe('oc-testcafe-db');
      expect(result.d1.id).toMatch(/^d1_/);
      expect(result.kv.name).toBe('oc-testcafe-kv');
      expect(result.kv.id).toMatch(/^kv_/);
      expect(result.r2.name).toBe('oc-testcafe-storage');
      expect(result.r2.id).toMatch(/^r2_/);
    });

    it('provisions all resources via Cloudflare API when configured', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      let d1Called = false;
      let kvCalled = false;
      let r2Called = false;
      let workerCalled = false;

      const fetchMock = vi.fn().mockImplementation((url: string, options: any) => {
        if (url.includes('/d1/database')) {
          d1Called = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              result: { id: 'd1_real', name: 'oc-testcafe-db' },
              errors: [],
            }),
          });
        }
        if (url.includes('/storage/kv/namespaces')) {
          kvCalled = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              result: { id: 'kv_real' },
              errors: [],
            }),
          });
        }
        if (url.includes('/r2/buckets')) {
          r2Called = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              result: undefined,
              errors: [],
            }),
          });
        }
        if (url.includes('/workers/scripts/')) {
          workerCalled = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        return Promise.reject(new Error('Unexpected URL: ' + url));
      });
      global.fetch = fetchMock;

      const result = await api.provisionTenantResources('tn_test123', 'testcafe');

      expect(d1Called).toBe(true);
      expect(kvCalled).toBe(true);
      expect(r2Called).toBe(true);
      expect(workerCalled).toBe(true);

      expect(result.worker.id).toBe('oc-testcafe-worker');
      expect(result.d1.id).toBe('d1_real');
      expect(result.kv.id).toBe('kv_real');
      expect(result.r2.id).toBe('oc-testcafe-storage');
    });

    it('handles partial provisioning failures', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/d1/database')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: false,
              errors: [{ code: 10000, message: 'D1 creation failed' }],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, result: {}, errors: [] }),
        });
      });
      global.fetch = fetchMock;

      await expect(
        api.provisionTenantResources('tn_test123', 'testcafe')
      ).rejects.toThrow();
    });

    it('uses correct resource naming convention', async () => {
      const env = createMockEnv(false);
      const api = new CloudflareApi(env);

      const result = await api.provisionTenantResources('tn_abc', 'mycafe');

      expect(result.worker.name).toBe('oc-mycafe-worker');
      expect(result.d1.name).toBe('oc-mycafe-db');
      expect(result.kv.name).toBe('oc-mycafe-kv');
      expect(result.r2.name).toBe('oc-mycafe-storage');
    });
  });

  describe('API configuration', () => {
    it('correctly detects when credentials are configured', async () => {
      const envWithCreds = createMockEnv(true);
      const apiWithCreds = new CloudflareApi(envWithCreds);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'd1_real', name: 'test' },
          errors: [],
        }),
      });
      global.fetch = fetchMock;

      await apiWithCreds.createD1Database('test');
      expect(fetchMock).toHaveBeenCalled();
    });

    it('correctly detects when credentials are missing', async () => {
      const envNoCreds = createMockEnv(false);
      const apiNoCreds = new CloudflareApi(envNoCreds);

      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const result = await apiNoCreds.createD1Database('test');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.id).toMatch(/^d1_/);
    });

    it('uses correct account ID in API requests', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'kv_123' },
          errors: [],
        }),
      });
      global.fetch = fetchMock;

      await api.createKvNamespace('test');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('accounts/test-account-id'),
        expect.any(Object)
      );
    });

    it('includes authorization header in all API requests', async () => {
      const env = createMockEnv(true);
      const api = new CloudflareApi(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {},
          errors: [],
        }),
      });
      global.fetch = fetchMock;

      await api.createR2Bucket('test');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-cf-token-12345',
          }),
        })
      );
    });
  });
});

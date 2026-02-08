import { vi } from 'vitest';
import type { Bindings } from '../../src/types/index.js';

/**
 * Creates a mock D1 database with chainable prepare/bind/first/all/run methods
 */
export function createMockDB(): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
  } as any;
}

/**
 * Creates a mock R2 bucket with get/put/delete/list/head methods
 */
function createMockR2Bucket(): R2Bucket {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
    head: vi.fn().mockResolvedValue(null),
  } as any;
}

/**
 * Creates a mock KV namespace with get/put/delete/list methods
 */
function createMockKVNamespace(): KVNamespace {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
  } as any;
}

/**
 * Creates a mock Cloudflare AI binding
 */
function createMockAI(): Ai {
  return {
    run: vi.fn().mockResolvedValue({ response: 'AI generated response' }),
  } as any;
}

/**
 * Creates a mock ExecutionContext with waitUntil and passThroughOnException
 */
export function createMockExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn((promise: Promise<any>) => {
      // Store the promise so tests can await it if needed
    }),
    passThroughOnException: vi.fn(),
  } as any;
}

/**
 * Creates a full mock environment with all required bindings
 *
 * @param overrides - Partial bindings to override default values
 * @returns Complete Bindings object with all required fields
 *
 * @example
 * ```ts
 * const env = createMockEnv();
 * const envWithSlack = createMockEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' });
 * ```
 */
export function createMockEnv(overrides?: Partial<Bindings>): Bindings {
  const defaultEnv: Bindings = {
    // Cloudflare resources
    DB: createMockDB(),
    STORAGE: createMockR2Bucket(),
    CACHE: createMockKVNamespace(),
    SESSIONS: createMockKVNamespace(),
    AI: createMockAI(),

    // Required environment variables
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'debug',
    AI_GATEWAY_ENDPOINT: 'https://test.ai.cloudflare.com',
    JWT_SECRET: 'test-secret-key-for-testing',

    // Optional environment variables
    SLACK_WEBHOOK_URL: undefined,
    PORTONE_WEBHOOK_SECRET: undefined,
    PORTONE_API_KEY: undefined,
    CF_API_TOKEN: undefined,
    CF_ACCOUNT_ID: undefined,
    RESEND_API_KEY: undefined,
  };

  return {
    ...defaultEnv,
    ...overrides,
  };
}

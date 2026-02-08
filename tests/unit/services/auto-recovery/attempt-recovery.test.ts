import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoRecovery } from '../../../../src/services/auto-recovery.js';
import type { Bindings, TenantHealth, Incident, Tenant, TenantResource } from '../../../../src/types/index.js';
import { structuredLog } from '../../../../src/utils/log.js';
import { MAX_RECOVERY_ATTEMPTS } from '../../../../src/config/constants.js';
import { createMockEnv } from '../../../helpers/mocks.js';

vi.mock('../../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

describe('AutoRecovery - attemptRecovery', () => {
  let env: Bindings;
  let recovery: AutoRecovery;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    env = createMockEnv();
    recovery = new AutoRecovery(env);
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('succeeds on first try when backup exists', async () => {
    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false },
    };

    const tenant: Tenant = {
      id: 'tn_test123',
      name: 'Test Tenant',
      plan: 'starter',
      status: 'active',
      subdomain: 'test',
      contact_email: 'test@example.com',
      contact_name: 'Test User',
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const resources: TenantResource[] = [
      {
        id: 'res_1',
        tenant_id: 'tn_test123',
        resource_type: 'worker',
        resource_id: 'worker_123',
        config: null,
        created_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      }
      if (query.includes('SELECT * FROM tenants')) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(tenant),
          }),
        } as any;
      }
      if (query.includes('INSERT INTO incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      if (query.includes('UPDATE incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      if (query.includes('SELECT * FROM tenant_resources')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: resources }),
          }),
        } as any;
      }
      if (query.includes('INSERT INTO notifications')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any;
    });

    vi.spyOn(env.STORAGE, 'get').mockResolvedValue({
      text: async () => '# Test SOUL\n\nBackup content',
    } as any);

    vi.spyOn(env.STORAGE, 'head').mockResolvedValue({} as any);

    vi.clearAllMocks();

    await recovery.attemptRecovery('tn_test123', health);

    // Verify incident was resolved
    const updateCalls = (env.DB.prepare as any).mock.calls.filter((call: any[]) =>
      call[0].includes('UPDATE incidents') && call[0].includes('status = ?')
    );
    expect(updateCalls.length).toBeGreaterThan(0);

    // Verify structuredLog was called with success
    expect(structuredLog).toHaveBeenCalledWith('auto_recovery_success', expect.objectContaining({
      tenant_id: 'tn_test123',
      attempts: 1,
    }));
  });

  it('retries up to MAX_RECOVERY_ATTEMPTS before escalating', async () => {
    const existingIncident: Incident = {
      id: 'inc_123',
      tenant_id: 'tn_test123',
      severity: 'P2',
      status: 'open',
      title: 'Test Incident',
      description: '{}',
      auto_recovery_attempts: 2, // Already tried twice
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false },
    };

    const resources: TenantResource[] = [
      {
        id: 'res_1',
        tenant_id: 'tn_test123',
        resource_type: 'worker',
        resource_id: 'worker_123',
        config: null,
        created_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [existingIncident] }),
          }),
        } as any;
      }
      if (query.includes('UPDATE incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      if (query.includes('SELECT * FROM tenant_resources')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: resources }),
          }),
        } as any;
      }
      if (query.includes('INSERT INTO notifications')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any;
    });

    vi.spyOn(env.STORAGE, 'get').mockResolvedValue({
      text: async () => '# Test SOUL\n\nBackup content',
    } as any);

    vi.spyOn(env.STORAGE, 'head').mockResolvedValue({} as any);

    await recovery.attemptRecovery('tn_test123', health);

    // Should attempt recovery (attempt 3)
    const updateCalls = (env.DB.prepare as any).mock.calls.filter((call: any[]) =>
      call[0].includes('UPDATE incidents')
    );
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  it('creates incident after all retries fail', async () => {
    const exhaustedIncident: Incident = {
      id: 'inc_456',
      tenant_id: 'tn_test123',
      severity: 'P2',
      status: 'open',
      title: 'Test Incident',
      description: '{}',
      auto_recovery_attempts: MAX_RECOVERY_ATTEMPTS,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false },
    };

    env = createMockEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' });

    vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [exhaustedIncident] }),
          }),
        } as any;
      }
      if (query.includes('UPDATE incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any;
    });

    recovery = new AutoRecovery(env);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    global.fetch = fetchMock;

    vi.clearAllMocks();

    await recovery.attemptRecovery('tn_test123', health);

    // Verify incident was escalated to P1
    const updateCalls = (env.DB.prepare as any).mock.calls.filter((call: any[]) =>
      call[0].includes('UPDATE incidents') && call[0].includes('severity = ?')
    );
    expect(updateCalls.length).toBeGreaterThan(0);

    // Verify structuredLog was called for escalation
    expect(structuredLog).toHaveBeenCalledWith('incident_escalated', expect.objectContaining({
      tenant_id: 'tn_test123',
      incident_id: 'inc_456',
      attempts: 3,
    }));
  });

  it('calls SlackNotifier.sendEscalation on final failure', async () => {
    const exhaustedIncident: Incident = {
      id: 'inc_789',
      tenant_id: 'tn_test123',
      severity: 'P2',
      status: 'open',
      title: 'Test Incident',
      description: '{}',
      auto_recovery_attempts: MAX_RECOVERY_ATTEMPTS,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false, api_errors: 10 },
    };

    env = createMockEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test-webhook' });
    recovery = new AutoRecovery(env);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    global.fetch = fetchMock;

    vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [exhaustedIncident] }),
          }),
        } as any;
      }
      if (query.includes('UPDATE incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any;
    });

    await recovery.attemptRecovery('tn_test123', health);

    // Verify Slack webhook was called
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.slack.com/test-webhook',
      expect.objectContaining({
        method: 'POST',
      })
    );

    const slackPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(slackPayload.text).toContain('tn_test123');
    expect(slackPayload.text).toContain('자동 복구 실패');
  });

  it('creates new incident when none exists', async () => {
    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false },
    };

    const tenant: Tenant = {
      id: 'tn_test123',
      name: 'Test Tenant',
      plan: 'starter',
      status: 'active',
      subdomain: 'test',
      contact_email: 'test@example.com',
      contact_name: 'Test User',
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const resources: TenantResource[] = [
      {
        id: 'res_1',
        tenant_id: 'tn_test123',
        resource_type: 'worker',
        resource_id: 'worker_123',
        config: null,
        created_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      }
      if (query.includes('SELECT * FROM tenants')) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(tenant),
          }),
        } as any;
      }
      if (query.includes('INSERT INTO incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      if (query.includes('SELECT * FROM tenant_resources')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: resources }),
          }),
        } as any;
      }
      if (query.includes('INSERT INTO notifications')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any;
    });

    // Mock R2 backup exists
    vi.spyOn(env.STORAGE, 'get').mockResolvedValue({
      text: async () => '# Test SOUL\n\nBackup content',
    } as any);

    vi.spyOn(env.STORAGE, 'head').mockResolvedValue({} as any);

    await recovery.attemptRecovery('tn_test123', health);

    // Verify incident was created
    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO incidents')
    );
  });

  it('increments recovery attempt counter on existing incident', async () => {
    const existingIncident: Incident = {
      id: 'inc_123',
      tenant_id: 'tn_test123',
      severity: 'P2',
      status: 'open',
      title: 'Test Incident',
      description: '{}',
      auto_recovery_attempts: 1,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false },
    };

    const resources: TenantResource[] = [
      {
        id: 'res_1',
        tenant_id: 'tn_test123',
        resource_type: 'worker',
        resource_id: 'worker_123',
        config: null,
        created_at: new Date().toISOString(),
      },
    ];

    let updateCalled = false;

    vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [existingIncident] }),
          }),
        } as any;
      }
      if (query.includes('UPDATE incidents')) {
        updateCalled = true;
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      if (query.includes('SELECT * FROM tenant_resources')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: resources }),
          }),
        } as any;
      }
      if (query.includes('INSERT INTO notifications')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any;
    });

    vi.spyOn(env.STORAGE, 'get').mockResolvedValue({
      text: async () => '# Test SOUL\n\nBackup content',
    } as any);

    vi.spyOn(env.STORAGE, 'head').mockResolvedValue({} as any);

    await recovery.attemptRecovery('tn_test123', health);

    expect(updateCalled).toBe(true);
  });

  it('escalates to operator after 3 failed attempts', async () => {
    const exhaustedIncident: Incident = {
      id: 'inc_456',
      tenant_id: 'tn_test123',
      severity: 'P2',
      status: 'open',
      title: 'Test Incident',
      description: '{}',
      auto_recovery_attempts: 3,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false },
    };

    env = createMockEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' });

    vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [exhaustedIncident] }),
          }),
        } as any;
      }
      if (query.includes('UPDATE incidents')) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any;
    });

    recovery = new AutoRecovery(env);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    global.fetch = fetchMock;

    await recovery.attemptRecovery('tn_test123', health);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
      })
    );

    const slackPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(slackPayload.text).toContain('[P1]');
    expect(slackPayload.text).toContain('tn_test123');
    expect(slackPayload.text).toContain('자동 복구 실패');
  });
});

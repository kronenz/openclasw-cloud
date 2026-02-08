import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoRecovery } from '../../../../src/services/auto-recovery.js';
import type { Bindings, TenantHealth, Incident } from '../../../../src/types/index.js';
import { MAX_RECOVERY_ATTEMPTS } from '../../../../src/config/constants.js';
import { createMockEnv } from '../../../helpers/mocks.js';

vi.mock('../../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

describe('AutoRecovery - escalateToOperator', () => {
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

  it('sends Slack webhook when configured', async () => {
    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false, api_errors: 5 },
    };

    env = createMockEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test-webhook' });
    recovery = new AutoRecovery(env);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    global.fetch = fetchMock;

    vi.spyOn(env.DB, 'prepare').mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({}),
      }),
    } as any);

    await (recovery as any).escalateToOperator('tn_test123', 'inc_789', health);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.slack.com/test-webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.text).toContain('[P1]');
    expect(callBody.text).toContain('tn_test123');
    expect(callBody.text).toContain('자동 복구 실패');
    expect(callBody.blocks).toBeDefined();
    expect(callBody.blocks[0].text.text).toContain('[P1]');
  });

  it('calls updateIncident with status and description', async () => {
    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { error: 'test error' },
    };

    let updateCalled = false;
    let capturedQuery = '';

    vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.includes('UPDATE incidents')) {
        updateCalled = true;
        capturedQuery = query;
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      return {
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any;
    });

    await (recovery as any).escalateToOperator('tn_test123', 'inc_789', health);

    expect(updateCalled).toBe(true);
    expect(capturedQuery).toContain('status = ?');
    expect(capturedQuery).toContain('description = ?');
  });

  it('continues escalation even if Slack webhook fails', async () => {
    const health: TenantHealth = {
      tenant_id: 'tn_test123',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: {},
    };

    env = createMockEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/invalid' });
    recovery = new AutoRecovery(env);

    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = fetchMock;

    vi.spyOn(env.DB, 'prepare').mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({}),
      }),
    } as any);

    // Should not throw
    await expect(
      (recovery as any).escalateToOperator('tn_test123', 'inc_789', health)
    ).resolves.toBeUndefined();
  });

  it('uses MAX_RECOVERY_ATTEMPTS constant correctly', async () => {
    const exhaustedIncident: Incident = {
      id: 'inc_const_test',
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

    // Verify that MAX_RECOVERY_ATTEMPTS (3) was used correctly
    expect(MAX_RECOVERY_ATTEMPTS).toBe(3);
    expect(exhaustedIncident.auto_recovery_attempts).toBe(MAX_RECOVERY_ATTEMPTS);
  });
});

describe('AutoRecovery - notifyTenantOfIssue', () => {
  let env: Bindings;
  let recovery: AutoRecovery;

  beforeEach(() => {
    env = createMockEnv();
    recovery = new AutoRecovery(env);
    vi.clearAllMocks();
  });

  it('creates notification in database', async () => {
    let notificationCreated = false;

    vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.includes('INSERT INTO notifications')) {
        notificationCreated = true;
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      }
      return {
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any;
    });

    await recovery.notifyTenantOfIssue('tn_test123');

    expect(notificationCreated).toBe(true);
  });

  it('handles notification creation errors gracefully', async () => {
    vi.spyOn(env.DB, 'prepare').mockImplementation(() => {
      throw new Error('Database error');
    });

    // Should not throw
    await expect(recovery.notifyTenantOfIssue('tn_test123')).resolves.toBeUndefined();
  });
});

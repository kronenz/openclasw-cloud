import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoRecovery } from '../../../src/services/auto-recovery.js';
import type { Bindings, TenantHealth, Incident, Tenant, TenantResource } from '../../../src/types/index.js';

function createMockEnv(slackWebhookUrl?: string): Bindings {
  const env: any = {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    } as any,
    STORAGE: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      head: vi.fn().mockResolvedValue(null),
    } as any,
    CACHE: {} as any,
    SESSIONS: {} as any,
    AI: {} as any,
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'debug',
    AI_GATEWAY_ENDPOINT: 'https://test.ai.cloudflare.com',
    JWT_SECRET: 'test-secret',
  };

  if (slackWebhookUrl) {
    env.SLACK_WEBHOOK_URL = slackWebhookUrl;
  }

  return env;
}

describe('AutoRecovery', () => {
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

  describe('attemptRecovery', () => {
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

      env = createMockEnv('https://hooks.slack.com/test');

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

  describe('performRecovery', () => {
    it('successfully recovers when SOUL.md backup exists', async () => {
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
        if (query.includes('SELECT * FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: resources }),
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
        text: async () => '# Restored SOUL\n\nBackup content',
      } as any);

      vi.spyOn(env.STORAGE, 'head').mockResolvedValue({} as any);

      const result = await (recovery as any).performRecovery('tn_test123', health);

      expect(result.success).toBe(true);
      expect(result.message).toContain('SOUL.md restored from backup');
      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'tenants/tn_test123/SOUL.md',
        '# Restored SOUL\n\nBackup content',
        expect.any(Object)
      );
    });

    it('fails recovery when no backup exists', async () => {
      const health: TenantHealth = {
        tenant_id: 'tn_test123',
        status: 'unhealthy',
        last_checked: new Date().toISOString(),
        details: { soul_exists: false },
      };

      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);

      const result = await (recovery as any).performRecovery('tn_test123', health);

      expect(result.success).toBe(false);
      expect(result.message).toContain('no backup found');
    });

    it('fails recovery when no resources exist', async () => {
      const health: TenantHealth = {
        tenant_id: 'tn_test123',
        status: 'unhealthy',
        last_checked: new Date().toISOString(),
        details: { soul_exists: true },
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
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

      const result = await (recovery as any).performRecovery('tn_test123', health);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No resources found');
    });
  });

  describe('restoreSoulFromBackup', () => {
    it('restores SOUL.md from backup successfully', async () => {
      const backupContent = '# Backup SOUL\n\n## Section 1\nContent here';

      vi.spyOn(env.STORAGE, 'get').mockResolvedValue({
        text: async () => backupContent,
      } as any);

      const result = await recovery.restoreSoulFromBackup('tn_test123');

      expect(result).toBe(true);
      expect(env.STORAGE.get).toHaveBeenCalledWith('backups/tn_test123/SOUL.md');
      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'tenants/tn_test123/SOUL.md',
        backupContent,
        expect.objectContaining({
          httpMetadata: {
            contentType: 'text/markdown',
          },
        })
      );
    });

    it('returns false when backup does not exist', async () => {
      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);

      const result = await recovery.restoreSoulFromBackup('tn_test123');

      expect(result).toBe(false);
      expect(env.STORAGE.put).not.toHaveBeenCalled();
    });

    it('returns false when restore operation fails', async () => {
      vi.spyOn(env.STORAGE, 'get').mockResolvedValue({
        text: async () => 'Backup content',
      } as any);

      vi.spyOn(env.STORAGE, 'put').mockRejectedValue(new Error('R2 write error'));

      const result = await recovery.restoreSoulFromBackup('tn_test123');

      expect(result).toBe(false);
    });
  });

  describe('escalateToOperator', () => {
    it('sends Slack webhook when configured', async () => {
      const health: TenantHealth = {
        tenant_id: 'tn_test123',
        status: 'unhealthy',
        last_checked: new Date().toISOString(),
        details: { soul_exists: false, api_errors: 5 },
      };

      env = createMockEnv('https://hooks.slack.com/test-webhook');
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

      env = createMockEnv('https://hooks.slack.com/invalid');
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
  });

  describe('notifyTenantOfIssue', () => {
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
});

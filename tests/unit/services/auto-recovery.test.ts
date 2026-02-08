import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoRecovery } from '../../../src/services/auto-recovery.js';
import type { Bindings, TenantHealth } from '../../../src/types/index.js';
import { createMockEnv } from '../../helpers/mocks.js';
import { MAX_RECOVERY_ATTEMPTS } from '../../../src/config/constants.js';

describe('AutoRecovery', () => {
  let env: Bindings;
  let recovery: AutoRecovery;

  beforeEach(() => {
    env = createMockEnv();
    recovery = new AutoRecovery(env);
    vi.clearAllMocks();
  });

  const createMockHealth = (overrides?: Partial<TenantHealth>): TenantHealth => ({
    tenant_id: 'tn_test123',
    status: 'degraded',
    last_checked: '2026-02-08T00:00:00Z',
    details: {
      soul_exists: false,
      resources_count: 1,
      open_incidents: 0,
      recent_usage: 5,
    },
    ...overrides,
  });

  describe('attemptRecovery', () => {
    it('creates new incident when none exists', async () => {
      const health = createMockHealth();
      let incidentCreated = false;

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        // listIncidents - no open incidents
        if (query.includes('FROM incidents') && query.includes('WHERE tenant_id')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        }
        // getTenant
        if (query.includes('FROM tenants') && query.includes('WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'tn_test123',
                name: 'Test Tenant',
              }),
            }),
          } as any;
        }
        // createIncident
        if (query.includes('INSERT INTO incidents')) {
          incidentCreated = true;
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        // updateIncident
        if (query.includes('UPDATE incidents')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        // getTenantResources
        if (query.includes('FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [{ id: 'res_1', resource_type: 'worker' }],
              }),
            }),
          } as any;
        }
        // createEmailNotification
        if (query.includes('INSERT INTO email_notifications')) {
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

      // Mock STORAGE for SOUL.md checks
      (env.STORAGE.head as any).mockResolvedValue(null);
      (env.STORAGE.get as any).mockResolvedValue(null);

      await recovery.attemptRecovery('tn_test123', health);

      expect(incidentCreated).toBe(true);
    });

    it('escalates to operator after max attempts', async () => {
      const health = createMockHealth();
      let escalated = false;

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        // listIncidents - return incident with max attempts
        if (query.includes('FROM incidents') && query.includes('WHERE tenant_id')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    id: 'inc_123',
                    tenant_id: 'tn_test123',
                    auto_recovery_attempts: MAX_RECOVERY_ATTEMPTS,
                    status: 'open',
                  },
                ],
              }),
            }),
          } as any;
        }
        // updateIncident (for escalation)
        if (query.includes('UPDATE incidents') && query.includes('SET')) {
          escalated = true;
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

      // Mock Slack notification
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      await recovery.attemptRecovery('tn_test123', health);

      expect(escalated).toBe(true);
      fetchSpy.mockRestore();
    });

    it('increments attempt counter on recovery', async () => {
      const health = createMockHealth();
      let attemptIncremented = false;

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        // listIncidents - return incident with 1 attempt
        if (query.includes('FROM incidents') && query.includes('WHERE tenant_id')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    id: 'inc_123',
                    tenant_id: 'tn_test123',
                    auto_recovery_attempts: 1,
                    status: 'open',
                  },
                ],
              }),
            }),
          } as any;
        }
        // updateIncident
        if (query.includes('UPDATE incidents')) {
          attemptIncremented = true;
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        // getTenantResources
        if (query.includes('FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [{ id: 'res_1', resource_type: 'worker' }],
              }),
            }),
          } as any;
        }
        // createEmailNotification
        if (query.includes('INSERT INTO email_notifications')) {
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

      // Mock STORAGE - SOUL.md exists
      (env.STORAGE.head as any).mockResolvedValue({ key: 'tenants/tn_test123/SOUL.md' });
      (env.STORAGE.get as any).mockResolvedValue(null);

      await recovery.attemptRecovery('tn_test123', health);

      expect(attemptIncremented).toBe(true);
    });

    it('resolves incident on successful recovery', async () => {
      const health = createMockHealth({ details: { soul_exists: true } }); // SOUL already exists
      let incidentResolved = false;
      const mockPrepare = vi.fn();

      // listIncidents
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'inc_123',
                tenant_id: 'tn_test123',
                auto_recovery_attempts: 1,
                status: 'open',
              },
            ],
          }),
        }),
      });

      // updateIncident - increment attempt
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
        }),
      });

      // createEmailNotification - notify tenant
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
        }),
      });

      // getTenantResources
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [{ id: 'res_1', resource_type: 'worker' }],
          }),
        }),
      });

      // updateIncident - resolve (status='resolved', resolved_at=timestamp)
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockImplementation((...args: any[]) => {
          // Check if this update includes status='resolved' and a resolved_at timestamp
          // The bind args are: status, resolved_at, description, incident_id
          if (args[0] === 'resolved' && args[1] !== null) {
            incidentResolved = true;
          }
          return {
            run: vi.fn().mockResolvedValue({}),
          };
        }),
      });

      // createEmailNotification - recovery notification
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
        }),
      });

      (env.DB.prepare as any) = mockPrepare;

      // Mock STORAGE - SOUL.md exists (no need to restore)
      (env.STORAGE.head as any).mockResolvedValue({ key: 'tenants/tn_test123/SOUL.md' });

      await recovery.attemptRecovery('tn_test123', health);

      expect(incidentResolved).toBe(true);
    });

    it('notifies tenant about the issue', async () => {
      const health = createMockHealth();
      let tenantNotified = false;
      const mockPrepare = vi.fn();

      // listIncidents
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'inc_123',
                tenant_id: 'tn_test123',
                auto_recovery_attempts: 0,
                status: 'open',
              },
            ],
          }),
        }),
      });

      // updateIncident
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
        }),
      });

      // createEmailNotification
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockImplementation(() => {
          tenantNotified = true;
          return {
            run: vi.fn().mockResolvedValue({}),
          };
        }),
      });

      // getTenantResources
      mockPrepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [{ id: 'res_1', resource_type: 'worker' }],
          }),
        }),
      });

      (env.DB.prepare as any) = mockPrepare;

      // Mock STORAGE - SOUL.md exists
      (env.STORAGE.head as any).mockResolvedValue({ key: 'tenants/tn_test123/SOUL.md' });

      await recovery.attemptRecovery('tn_test123', health);

      expect(tenantNotified).toBe(true);
    });
  });

  describe('restoreSoulFromBackup', () => {
    it('restores SOUL.md from backup successfully', async () => {
      const backupContent = '# SOUL\n\nTest persona content';
      const mockBackupObj = {
        text: vi.fn().mockResolvedValue(backupContent),
      };

      (env.STORAGE.get as any).mockResolvedValue(mockBackupObj);
      (env.STORAGE.put as any).mockResolvedValue(undefined);

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
      (env.STORAGE.get as any).mockResolvedValue(null);

      const result = await recovery.restoreSoulFromBackup('tn_test123');

      expect(result).toBe(false);
      expect(env.STORAGE.put).not.toHaveBeenCalled();
    });

    it('returns false when restore fails', async () => {
      const mockBackupObj = {
        text: vi.fn().mockRejectedValue(new Error('Read failed')),
      };

      (env.STORAGE.get as any).mockResolvedValue(mockBackupObj);

      const result = await recovery.restoreSoulFromBackup('tn_test123');

      expect(result).toBe(false);
    });
  });

  describe('notifyTenantOfIssue', () => {
    it('creates email notification for tenant', async () => {
      let notificationCreated = false;

      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockImplementation(() => {
          notificationCreated = true;
          return {
            run: vi.fn().mockResolvedValue({}),
          };
        }),
      } as any);

      await recovery.notifyTenantOfIssue('tn_test123');

      expect(notificationCreated).toBe(true);
    });

    it('handles notification creation failure gracefully', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation(() => {
        throw new Error('DB error');
      });

      // Should not throw
      await expect(recovery.notifyTenantOfIssue('tn_test123')).resolves.not.toThrow();
    });
  });

  describe('performRecovery', () => {
    it('restores SOUL.md when missing', async () => {
      const health = createMockHealth({ details: { soul_exists: false } });
      const backupContent = '# SOUL\n\nRestored content';
      const mockBackupObj = {
        text: vi.fn().mockResolvedValue(backupContent),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [{ id: 'res_1', resource_type: 'worker' }],
              }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      });

      (env.STORAGE.get as any).mockResolvedValue(mockBackupObj);
      (env.STORAGE.put as any).mockResolvedValue(undefined);
      (env.STORAGE.head as any).mockResolvedValue({ key: 'tenants/tn_test123/SOUL.md' });

      const result = await (recovery as any).performRecovery('tn_test123', health);

      expect(result.success).toBe(true);
      expect(result.message).toContain('SOUL.md restored from backup');
      expect(result.message).toContain('Resources verified');
      expect(result.message).toContain('SOUL.md verified');
    });

    it('fails when no backup is found', async () => {
      const health = createMockHealth({ details: { soul_exists: false } });

      (env.STORAGE.get as any).mockResolvedValue(null);

      const result = await (recovery as any).performRecovery('tn_test123', health);

      expect(result.success).toBe(false);
      expect(result.message).toContain('no backup found');
    });

    it('fails when no resources exist', async () => {
      const health = createMockHealth({ details: { soul_exists: true } });

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('FROM tenant_resources')) {
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
          }),
        } as any;
      });

      const result = await (recovery as any).performRecovery('tn_test123', health);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No resources found');
    });

    it('fails when SOUL.md still missing after restore', async () => {
      const health = createMockHealth({ details: { soul_exists: false } });
      const backupContent = '# SOUL\n\nContent';
      const mockBackupObj = {
        text: vi.fn().mockResolvedValue(backupContent),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [{ id: 'res_1', resource_type: 'worker' }],
              }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      });

      (env.STORAGE.get as any).mockResolvedValue(mockBackupObj);
      (env.STORAGE.put as any).mockResolvedValue(undefined);
      (env.STORAGE.head as any).mockResolvedValue(null); // Still missing after restore

      const result = await (recovery as any).performRecovery('tn_test123', health);

      expect(result.success).toBe(false);
      expect(result.message).toContain('still missing after restore');
    });

    it('succeeds when SOUL.md exists and resources are present', async () => {
      const health = createMockHealth({ details: { soul_exists: true } });

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [{ id: 'res_1', resource_type: 'worker' }],
              }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      });

      (env.STORAGE.head as any).mockResolvedValue({ key: 'tenants/tn_test123/SOUL.md' });

      const result = await (recovery as any).performRecovery('tn_test123', health);

      expect(result.success).toBe(true);
      expect(result.details?.steps).toContain('Resources verified');
      expect(result.details?.steps).toContain('SOUL.md verified');
    });
  });
});

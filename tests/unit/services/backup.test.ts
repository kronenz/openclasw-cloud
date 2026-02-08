import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService } from '../../../src/services/backup.js';
import type { Bindings, Tenant } from '../../../src/types/index.js';
import { BACKUP_RETENTION_DAYS } from '../../../src/config/constants.js';
import { createMockEnv } from '../../helpers/mocks.js';

describe('BackupService', () => {
  let env: Bindings;
  let backupService: BackupService;

  beforeEach(() => {
    env = createMockEnv();
    backupService = new BackupService(env);
  });

  describe('backupTenant', () => {
    it('successfully backs up tenant with SOUL.md', async () => {
      const mockTenant: Tenant = {
        id: 'tn_test',
        name: 'Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'test',
        contact_email: 'test@test.com',
        contact_name: 'Test User',
        metadata: JSON.stringify({ industry: 'cafe' }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const soulContent = '# SOUL\n\nThis is the tenant persona.';

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
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

      vi.spyOn(env.STORAGE, 'get').mockResolvedValue({
        text: vi.fn().mockResolvedValue(soulContent),
      } as any);

      const result = await backupService.backupTenant('tn_test');

      expect(result.success).toBe(true);
      expect(result.tenant_id).toBe('tn_test');
      expect(result.backup_size).toBe(soulContent.length);
      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'backups/tn_test/SOUL.md',
        soulContent,
        expect.objectContaining({
          httpMetadata: { contentType: 'text/markdown' },
        })
      );
      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'backups/tn_test/config.json',
        expect.any(String),
        expect.objectContaining({
          httpMetadata: { contentType: 'application/json' },
        })
      );
    });

    it('backs up tenant without SOUL.md', async () => {
      const mockTenant: Tenant = {
        id: 'tn_test',
        name: 'Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'test',
        contact_email: 'test@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
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

      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);

      const result = await backupService.backupTenant('tn_test');

      expect(result.success).toBe(true);
      expect(result.backup_size).toBe(0);
      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'backups/tn_test/config.json',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('returns failure when tenant not found', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
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

      const result = await backupService.backupTenant('tn_nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Tenant not found');
    });

    it('handles storage errors gracefully', async () => {
      const mockTenant: Tenant = {
        id: 'tn_test',
        name: 'Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'test',
        contact_email: 'test@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
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

      vi.spyOn(env.STORAGE, 'get').mockRejectedValue(new Error('Storage error'));

      const result = await backupService.backupTenant('tn_test');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Storage error');
    });
  });

  describe('backupAllTenants', () => {
    it('backs up all active tenants', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_1',
          name: 'Corp 1',
          plan: 'starter',
          status: 'active',
          subdomain: 'corp1',
          contact_email: 'corp1@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'tn_2',
          name: 'Corp 2',
          plan: 'growth',
          status: 'active',
          subdomain: 'corp2',
          contact_email: 'corp2@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('WHERE id')) {
          // Single tenant query
          return {
            bind: vi.fn().mockImplementation((tenantId: string) => ({
              first: vi.fn().mockResolvedValue(
                mockTenants.find((t) => t.id === tenantId)
              ),
            })),
          } as any;
        }
        if (query.includes('SELECT * FROM tenants')) {
          // List all tenants
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockTenants }),
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

      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);

      const summary = await backupService.backupAllTenants();

      expect(summary.total).toBe(2);
      expect(summary.succeeded).toBe(2);
      expect(summary.failed).toBe(0);
      expect(summary.results.length).toBe(2);
    });

    it('continues backing up even if one tenant fails', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_1',
          name: 'Corp 1',
          plan: 'starter',
          status: 'active',
          subdomain: 'corp1',
          contact_email: 'corp1@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'tn_2',
          name: 'Corp 2',
          plan: 'growth',
          status: 'active',
          subdomain: 'corp2',
          contact_email: 'corp2@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('WHERE id')) {
          // Single tenant query - tn_2 fails
          return {
            bind: vi.fn().mockImplementation((tenantId: string) => ({
              first: vi.fn().mockResolvedValue(
                tenantId === 'tn_1' ? mockTenants[0] : null
              ),
            })),
          } as any;
        }
        if (query.includes('SELECT * FROM tenants')) {
          // List all tenants
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockTenants }),
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

      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);

      const summary = await backupService.backupAllTenants();

      expect(summary.total).toBe(2);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(1);
    });
  });

  describe('restoreTenant', () => {
    it('successfully restores tenant from backup', async () => {
      const soulContent = '# SOUL\n\nRestored persona.';
      const configContent = JSON.stringify({
        tenant: {
          id: 'tn_test',
          name: 'Test Corp',
          plan: 'starter',
        },
        backup_timestamp: new Date().toISOString(),
        backup_version: '1.0',
      });

      vi.spyOn(env.STORAGE, 'get').mockImplementation((key: string) => {
        if (key === 'backups/tn_test/SOUL.md') {
          return Promise.resolve({
            text: vi.fn().mockResolvedValue(soulContent),
          } as any);
        }
        if (key === 'backups/tn_test/config.json') {
          return Promise.resolve({
            text: vi.fn().mockResolvedValue(configContent),
          } as any);
        }
        return Promise.resolve(null);
      });

      const result = await backupService.restoreTenant('tn_test');

      expect(result.success).toBe(true);
      expect(result.message).toContain('restored successfully');
      expect(result.config).toBeDefined();
      expect(result.config?.id).toBe('tn_test');
      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'tenants/tn_test/SOUL.md',
        soulContent,
        expect.any(Object)
      );
    });

    it('returns failure when no backup found', async () => {
      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);

      const result = await backupService.restoreTenant('tn_nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No SOUL.md backup found');
    });

    it('handles restore errors gracefully', async () => {
      vi.spyOn(env.STORAGE, 'get').mockRejectedValue(new Error('Storage error'));

      const result = await backupService.restoreTenant('tn_test');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Storage error');
    });
  });

  describe('cleanupOldBackups', () => {
    it('deletes backups older than retention period', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 35 * 86400000); // 35 days ago
      const recentDate = new Date(now.getTime() - 5 * 86400000); // 5 days ago

      const mockObjects = [
        {
          key: 'backups/tn_old/SOUL.md',
          uploaded: oldDate.toISOString(),
        },
        {
          key: 'backups/tn_recent/SOUL.md',
          uploaded: recentDate.toISOString(),
        },
      ];

      vi.spyOn(env.STORAGE, 'list').mockResolvedValue({
        objects: mockObjects,
        truncated: false,
      } as any);

      const result = await backupService.cleanupOldBackups(30);

      expect(result.deleted).toBe(1);
      expect(result.errors).toBe(0);
      expect(env.STORAGE.delete).toHaveBeenCalledWith('backups/tn_old/SOUL.md');
      expect(env.STORAGE.delete).not.toHaveBeenCalledWith('backups/tn_recent/SOUL.md');
    });

    it('handles deletion errors gracefully', async () => {
      const oldDate = new Date(Date.now() - 35 * 86400000);

      const mockObjects = [
        {
          key: 'backups/tn_old/SOUL.md',
          uploaded: oldDate.toISOString(),
        },
      ];

      vi.spyOn(env.STORAGE, 'list').mockResolvedValue({
        objects: mockObjects,
        truncated: false,
      } as any);

      vi.spyOn(env.STORAGE, 'delete').mockRejectedValue(new Error('Delete failed'));

      const result = await backupService.cleanupOldBackups(30);

      expect(result.deleted).toBe(0);
      expect(result.errors).toBe(1);
    });

    it('warns when results are truncated', async () => {
      vi.spyOn(env.STORAGE, 'list').mockResolvedValue({
        objects: [],
        truncated: true,
      } as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await backupService.cleanupOldBackups(30);

      expect(result.deleted).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('cleanup_truncated')
      );
      consoleSpy.mockRestore();
    });

    it('handles list errors gracefully', async () => {
      vi.spyOn(env.STORAGE, 'list').mockRejectedValue(new Error('List failed'));

      const result = await backupService.cleanupOldBackups(30);

      expect(result.deleted).toBe(0);
      expect(result.errors).toBe(1);
    });

    it('uses BACKUP_RETENTION_DAYS constant as default', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - (BACKUP_RETENTION_DAYS + 5) * 86400000); // older than retention
      const recentDate = new Date(now.getTime() - (BACKUP_RETENTION_DAYS - 5) * 86400000); // within retention

      const mockObjects = [
        {
          key: 'backups/tn_old/SOUL.md',
          uploaded: oldDate.toISOString(),
        },
        {
          key: 'backups/tn_recent/SOUL.md',
          uploaded: recentDate.toISOString(),
        },
      ];

      vi.spyOn(env.STORAGE, 'list').mockResolvedValue({
        objects: mockObjects,
        truncated: false,
      } as any);

      // Call without explicit retention days - should use BACKUP_RETENTION_DAYS
      const result = await backupService.cleanupOldBackups();

      expect(result.deleted).toBe(1);
      expect(env.STORAGE.delete).toHaveBeenCalledWith('backups/tn_old/SOUL.md');
      expect(env.STORAGE.delete).not.toHaveBeenCalledWith('backups/tn_recent/SOUL.md');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoRecovery } from '../../../../src/services/auto-recovery.js';
import type { Bindings, TenantHealth, Tenant, TenantResource } from '../../../../src/types/index.js';
import { structuredLog, structuredError } from '../../../../src/utils/log.js';
import { createMockEnv } from '../../../helpers/mocks.js';

vi.mock('../../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

describe('AutoRecovery - restoreSoulFromBackup', () => {
  let env: Bindings;
  let recovery: AutoRecovery;

  beforeEach(() => {
    env = createMockEnv();
    recovery = new AutoRecovery(env);
    vi.clearAllMocks();
  });

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

  it('calls structuredLog for soul_restored event', async () => {
    const backupContent = '# Backup SOUL\n\nTest content for logging';

    vi.spyOn(env.STORAGE, 'get').mockResolvedValue({
      text: async () => backupContent,
    } as any);

    vi.clearAllMocks();

    const result = await recovery.restoreSoulFromBackup('tn_log_test');

    expect(result).toBe(true);
    expect(structuredLog).toHaveBeenCalledWith('soul_restored', {
      tenant_id: 'tn_log_test',
      backup_size: backupContent.length,
    });
  });

  it('calls structuredError on recovery error', async () => {
    const health: TenantHealth = {
      tenant_id: 'tn_error_test',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false },
    };

    vi.spyOn(env.DB, 'prepare').mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    vi.clearAllMocks();

    await recovery.attemptRecovery('tn_error_test', health);

    // Verify structuredError was called
    expect(structuredError).toHaveBeenCalledWith(
      'auto_recovery_error',
      expect.any(Error),
      { tenant_id: 'tn_error_test' }
    );
  });

  it('calls structuredLog with auto_recovery_start event', async () => {
    const health: TenantHealth = {
      tenant_id: 'tn_log_test',
      status: 'unhealthy',
      last_checked: new Date().toISOString(),
      details: { soul_exists: false },
    };

    const tenant: Tenant = {
      id: 'tn_log_test',
      name: 'Log Test Tenant',
      plan: 'starter',
      status: 'active',
      subdomain: 'logtest',
      contact_email: 'test@example.com',
      contact_name: 'Test User',
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const resources: TenantResource[] = [
      {
        id: 'res_1',
        tenant_id: 'tn_log_test',
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

    await recovery.attemptRecovery('tn_log_test', health);

    // Verify structuredLog was called with auto_recovery_start
    expect(structuredLog).toHaveBeenCalledWith('auto_recovery_start', {
      tenant_id: 'tn_log_test',
      health_status: 'unhealthy',
    });

    // Verify structuredLog was called with incident_created
    expect(structuredLog).toHaveBeenCalledWith('incident_created', expect.objectContaining({
      tenant_id: 'tn_log_test',
    }));
  });
});

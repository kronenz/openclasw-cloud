import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoRecovery } from '../../../../src/services/auto-recovery.js';
import type { Bindings, TenantHealth, TenantResource } from '../../../../src/types/index.js';
import { createMockEnv } from '../../../helpers/mocks.js';

vi.mock('../../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

describe('AutoRecovery - performRecovery', () => {
  let env: Bindings;
  let recovery: AutoRecovery;

  beforeEach(() => {
    env = createMockEnv();
    recovery = new AutoRecovery(env);
    vi.clearAllMocks();
  });

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

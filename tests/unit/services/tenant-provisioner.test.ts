import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantProvisioner } from '../../../src/services/tenant-provisioner.js';
import type { Bindings, CreateTenantInput, Tenant, TenantResource } from '../../../src/types/index.js';
import { createMockEnv } from '../../helpers/mocks.js';

describe('TenantProvisioner', () => {
  let env: Bindings;
  let provisioner: TenantProvisioner;

  beforeEach(() => {
    env = createMockEnv();
    provisioner = new TenantProvisioner(env);
    vi.clearAllMocks();
  });

  describe('plan', () => {
    it('generates valid plan with tenantId and subdomain', async () => {
      const input: CreateTenantInput = {
        name: 'Test Corp',
        plan: 'starter',
        contact_email: 'test@example.com',
      };

      const plan = await provisioner.plan(input);

      expect(plan.tenantId).toMatch(/^tn_[a-z0-9-]+$/); // UUID format with hyphens
      expect(plan.subdomain).toBeTruthy();
      expect(plan.plan).toBe('starter');
      expect(plan.industry).toBe('general');
      expect(plan.resources).toEqual({
        worker: true,
        d1: true,
        kv: true,
        r2: true,
      });
    });

    it('uses provided subdomain when given', async () => {
      const input: CreateTenantInput = {
        name: 'Test Corp',
        plan: 'growth',
        contact_email: 'test@example.com',
        subdomain: 'custom-subdomain',
      };

      const plan = await provisioner.plan(input);

      expect(plan.subdomain).toBe('custom-subdomain');
    });

    it('uses provided industry when given', async () => {
      const input: CreateTenantInput = {
        name: 'Cafe Shop',
        plan: 'starter',
        contact_email: 'cafe@example.com',
        industry: 'cafe',
      };

      const plan = await provisioner.plan(input);

      expect(plan.industry).toBe('cafe');
    });
  });

  describe('createResources', () => {
    it('creates 4 resource types for tenant', async () => {
      const plan = {
        tenantId: 'tn_test123',
        subdomain: 'test',
        plan: 'starter' as const,
        industry: 'general',
        resources: { worker: true, d1: true, kv: true, r2: true },
      };

      const runMock = vi.fn().mockResolvedValue({});
      const bindMock = vi.fn().mockReturnValue({
        run: runMock,
      });
      const prepareMock = vi.fn().mockReturnValue({
        bind: bindMock,
      });

      vi.spyOn(env.DB, 'prepare').mockImplementation(prepareMock);

      await provisioner.createResources(plan);

      // Should create 4 resources (worker, d1, kv, r2)
      expect(prepareMock).toHaveBeenCalledTimes(4);
      expect(runMock).toHaveBeenCalledTimes(4);
    });

    it('stores resource with correct tenant_id', async () => {
      const plan = {
        tenantId: 'tn_test123',
        subdomain: 'test',
        plan: 'starter' as const,
        industry: 'general',
        resources: { worker: true, d1: false, kv: false, r2: false },
      };

      const bindMock = vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({}),
      });
      const prepareMock = vi.fn().mockReturnValue({
        bind: bindMock,
      });

      vi.spyOn(env.DB, 'prepare').mockImplementation(prepareMock);

      await provisioner.createResources(plan);

      // Check that bind was called with tenant_id
      expect(bindMock).toHaveBeenCalled();
      const bindCall = bindMock.mock.calls[0];
      expect(bindCall[1]).toBe('tn_test123'); // tenant_id is second parameter
    });
  });

  describe('initializeOpenClaw', () => {
    it('stores SOUL.md in R2 with correct path', async () => {
      const plan = {
        tenantId: 'tn_test123',
        subdomain: 'test',
        plan: 'starter' as const,
        industry: 'cafe',
        resources: { worker: true, d1: true, kv: true, r2: true },
      };

      await provisioner.initializeOpenClaw('tn_test123', plan);

      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'tenants/tn_test123/SOUL.md',
        expect.stringContaining('test')
      );
      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'tenants/tn_test123/SOUL.md',
        expect.stringContaining('cafe')
      );
    });
  });

  describe('setupAuth', () => {
    it('returns apiKey, jwt, and webhookSecret', async () => {
      const auth = await provisioner.setupAuth('tn_test123');

      expect(auth.apiKey).toMatch(/^[a-f0-9]{64}$/); // 32 bytes = 64 hex chars
      expect(auth.jwt).toBeTruthy();
      expect(auth.webhookSecret).toMatch(/^[a-f0-9]{64}$/); // 32 bytes = 64 hex chars
    });

    it('stores apiKey in KV cache', async () => {
      const auth = await provisioner.setupAuth('tn_test123');

      expect(env.CACHE.put).toHaveBeenCalledWith(
        `apikey:${auth.apiKey}`,
        'tn_test123',
        { expirationTtl: 86400 * 365 }
      );
    });

    it('creates valid JWT token', async () => {
      const auth = await provisioner.setupAuth('tn_test123');

      // JWT should have 3 parts separated by dots
      expect(auth.jwt.split('.')).toHaveLength(3);
    });
  });

  describe('verify', () => {
    it('returns true when tenant and resources exist', async () => {
      const mockTenant: Tenant = {
        id: 'tn_test123',
        name: 'Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'test',
        contact_email: 'test@example.com',
        contact_name: null,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockResources: TenantResource[] = [
        {
          id: 'res_1',
          tenant_id: 'tn_test123',
          resource_type: 'worker',
          resource_id: 'worker-tn_test123',
          config: null,
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockResources }),
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

      const result = await provisioner.verify('tn_test123');

      expect(result).toBe(true);
    });

    it('returns false when tenant does not exist', async () => {
      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      } as any);

      const result = await provisioner.verify('tn_nonexistent');

      expect(result).toBe(false);
    });

    it('returns false when tenant exists but has no resources', async () => {
      const mockTenant: Tenant = {
        id: 'tn_test123',
        name: 'Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'test',
        contact_email: 'test@example.com',
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
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      });

      const result = await provisioner.verify('tn_test123');

      expect(result).toBe(false);
    });
  });

  describe('notifyCustomer', () => {
    it('logs notification event', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const auth = {
        apiKey: 'test_api_key',
        jwt: 'test.jwt.token',
        webhookSecret: 'webhook_secret',
      };

      await provisioner.notifyCustomer('tn_test123', auth);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('tenant_provisioned')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('tn_test123')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('provision', () => {
    it('completes full provisioning flow successfully', async () => {
      const input: CreateTenantInput = {
        name: 'Test Corp',
        plan: 'starter',
        contact_email: 'test@example.com',
        contact_name: 'Test User',
      };

      const mockTenant: Tenant = {
        id: 'tn_test123',
        name: 'Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'test-corp',
        contact_email: 'test@example.com',
        contact_name: 'Test User',
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockResources: TenantResource[] = [
        {
          id: 'res_1',
          tenant_id: 'tn_test123',
          resource_type: 'worker',
          resource_id: 'worker-tn_test123',
          config: null,
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('INSERT INTO tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO provisioning_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('UPDATE provisioning_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('UPDATE tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockResources }),
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

      const result = await provisioner.provision(input);

      expect(result.tenant.id).toMatch(/^tn_/);
      expect(result.tenant.status).toBe('active');
      expect(result.auth.apiKey).toBeTruthy();
      expect(result.auth.jwt).toBeTruthy();
      expect(result.auth.webhookSecret).toBeTruthy();
      expect(result.subdomain).toBeTruthy();
    });

    it('marks tenant as suspended on provisioning failure', async () => {
      const input: CreateTenantInput = {
        name: 'Test Corp',
        plan: 'starter',
        contact_email: 'test@example.com',
      };

      let createResourcesCalled = false;

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('INSERT INTO tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO tenant_resources')) {
          createResourcesCalled = true;
          // Simulate failure during resource creation
          throw new Error('Resource creation failed');
        }
        if (query.includes('INSERT INTO provisioning_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('UPDATE provisioning_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('UPDATE tenants')) {
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

      await expect(provisioner.provision(input)).rejects.toThrow(
        /Provisioning failed at step 'create_resources'/
      );

      expect(createResourcesCalled).toBe(true);
    });

    it('logs all 6 provisioning steps', async () => {
      const input: CreateTenantInput = {
        name: 'Test Corp',
        plan: 'starter',
        contact_email: 'test@example.com',
      };

      const mockTenant: Tenant = {
        id: 'tn_test123',
        name: 'Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'test-corp',
        contact_email: 'test@example.com',
        contact_name: null,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockResources: TenantResource[] = [
        {
          id: 'res_1',
          tenant_id: 'tn_test123',
          resource_type: 'worker',
          resource_id: 'worker-tn_test123',
          config: null,
          created_at: new Date().toISOString(),
        },
      ];

      const logSteps: string[] = [];

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('INSERT INTO provisioning_logs')) {
          return {
            bind: vi.fn().mockImplementation((...args: any[]) => {
              logSteps.push(args[2]); // step is 3rd parameter
              return {
                run: vi.fn().mockResolvedValue({}),
              };
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenant_resources')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockResources }),
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

      await provisioner.provision(input);

      expect(logSteps).toEqual([
        'plan',
        'create_resources',
        'init_openclaw',
        'setup_auth',
        'verify',
        'notify',
      ]);
    });
  });
});

import type { Bindings, CreateTenantInput, ProvisioningPlan, Tenant } from '../types/index.js';
import {
  createTenant,
  updateTenant,
  createTenantResource,
  createProvisioningLog,
  updateProvisioningLog,
  getTenant,
  getTenantResources
} from '../db/queries.js';
import { generateTenantId, generateResourceId, generateSubdomain, nowISO } from '../utils/id.js';
import { soulR2Key } from '../config/constants.js';
import { createJWT, generateApiKey } from '../utils/crypto.js';
import { structuredLog, structuredError, formatErrorMessage } from '../utils/log.js';

interface AuthConfig {
  apiKey: string;
  jwt: string;
  webhookSecret: string;
}

interface ProvisionResult {
  tenant: Tenant;
  auth: AuthConfig;
  subdomain: string;
}

export class TenantProvisioner {
  constructor(private readonly env: Bindings) {}

  // Step 1: Plan - generate tenant ID, subdomain, determine resources
  async plan(input: CreateTenantInput): Promise<ProvisioningPlan> {
    const tenantId = generateTenantId();
    const subdomain = input.subdomain || generateSubdomain(input.name);
    return {
      tenantId,
      subdomain,
      plan: input.plan,
      industry: input.industry || 'general',
      resources: { worker: true, d1: true, kv: true, r2: true },
    };
  }

  // Step 2: Create CF resources - record resource IDs
  // In Phase 1, we simulate resource creation (store placeholder IDs)
  // Real CF API calls will be added in Phase 2
  async createResources(plan: ProvisioningPlan): Promise<void> {
    const resourceTypes = ['worker', 'd1', 'kv', 'r2'] as const;
    for (const type of resourceTypes) {
      if (plan.resources[type]) {
        await createTenantResource(this.env.DB, {
          id: generateResourceId(),
          tenant_id: plan.tenantId,
          resource_type: type,
          resource_id: `${type}-${plan.tenantId}`,  // placeholder
          config: JSON.stringify({ plan: plan.plan, subdomain: plan.subdomain }),
        });
      }
    }
  }

  // Step 3: Initialize OpenClaw - store SOUL template in R2
  async initializeOpenClaw(tenantId: string, plan: ProvisioningPlan): Promise<void> {
    // Store a basic SOUL.md in R2 for this tenant
    const soulContent = `# ${plan.subdomain} AI 비서\n\n업종: ${plan.industry}\n플랜: ${plan.plan}`;
    await this.env.STORAGE.put(soulR2Key(tenantId), soulContent);
  }

  // Step 4: Setup auth - generate API key and JWT
  async setupAuth(tenantId: string): Promise<AuthConfig> {
    const apiKey = generateApiKey();
    const jwt = await createJWT({ sub: tenantId, role: 'admin' }, this.env.JWT_SECRET, 86400 * 365);
    const webhookSecret = generateApiKey();

    // Store API key hash in KV for fast lookup
    await this.env.CACHE.put(`apikey:${apiKey}`, tenantId, { expirationTtl: 86400 * 365 });

    return { apiKey, jwt, webhookSecret };
  }

  // Step 5: Verify - check tenant is accessible
  async verify(tenantId: string): Promise<boolean> {
    // Basic verification: check tenant exists in DB and resources are stored
    const tenant = await getTenant(this.env.DB, tenantId);
    if (!tenant) return false;

    const resources = await getTenantResources(this.env.DB, tenantId);
    return resources.length > 0;
  }

  // Step 6: Notify - placeholder for email notification
  async notifyCustomer(tenantId: string, _auth: AuthConfig): Promise<void> {
    // Phase 1: Log notification (email integration in Phase 2)
    structuredLog('tenant_provisioned', { tenant_id: tenantId });
  }

  // Orchestrator - runs all 6 steps with logging and rollback
  async provision(input: CreateTenantInput): Promise<ProvisionResult> {
    const steps = ['plan', 'create_resources', 'init_openclaw', 'setup_auth', 'verify', 'notify'] as const;
    let plan: ProvisioningPlan | null = null;
    let auth: AuthConfig | null = null;

    // Log each step in provisioning_logs table
    for (const step of steps) {
      const logId = crypto.randomUUID();
      await createProvisioningLog(this.env.DB, {
        id: logId,
        tenant_id: plan?.tenantId || 'pending',
        step,
        status: 'running',
        details: null,
        started_at: nowISO(),
        completed_at: null,
        error_message: null,
      });

      try {
        switch (step) {
          case 'plan':
            plan = await this.plan(input);
            // Create tenant record in DB
            await createTenant(this.env.DB, {
              id: plan.tenantId,
              name: input.name,
              plan: input.plan,
              status: 'provisioning',
              subdomain: plan.subdomain,
              contact_email: input.contact_email,
              contact_name: input.contact_name || null,
              metadata: input.metadata ? JSON.stringify(input.metadata) : null,
            });
            break;
          default:
            // All subsequent steps require plan (set in 'plan' step)
            if (!plan) throw new Error('Plan step must complete before other steps');
            switch (step) {
              case 'create_resources':
                await this.createResources(plan);
                break;
              case 'init_openclaw':
                await this.initializeOpenClaw(plan.tenantId, plan);
                break;
              case 'setup_auth':
                auth = await this.setupAuth(plan.tenantId);
                break;
              case 'verify': {
                const ok = await this.verify(plan.tenantId);
                if (!ok) throw new Error('Verification failed');
                break;
              }
              case 'notify':
                if (!auth) throw new Error('Auth step must complete before notify');
                await this.notifyCustomer(plan.tenantId, auth);
                // Mark tenant as active
                await updateTenant(this.env.DB, plan.tenantId, { status: 'active' });
                break;
            }
        }

        await updateProvisioningLog(this.env.DB, logId, {
          tenant_id: plan?.tenantId,
          status: 'completed',
          completed_at: nowISO(),
        });
      } catch (error) {
        const errorMsg = formatErrorMessage(error);
        await updateProvisioningLog(this.env.DB, logId, {
          tenant_id: plan?.tenantId,
          status: 'failed',
          error_message: errorMsg,
          completed_at: nowISO(),
        });

        // Rollback: mark tenant as suspended if it was created
        if (plan?.tenantId) {
          const tenantId = plan.tenantId;
          await updateTenant(this.env.DB, tenantId, { status: 'suspended' }).catch((rollbackError) => {
            structuredError('provisioning_rollback_failed', rollbackError, {
              tenant_id: tenantId,
              step,
            });
          });
        }

        throw new Error(`Provisioning failed at step '${step}': ${errorMsg}`);
      }
    }

    if (!plan || !auth) {
      throw new Error('Provisioning incomplete: missing plan or auth');
    }

    const tenant = await getTenant(this.env.DB, plan.tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${plan.tenantId} not found after provisioning`);
    }

    return {
      tenant,
      auth,
      subdomain: plan.subdomain,
    };
  }
}

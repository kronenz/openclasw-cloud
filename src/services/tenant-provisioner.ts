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
import { soulR2Key, API_KEY_EXPIRY_SECONDS } from '../config/constants.js';
import { createJWT, generateApiKey } from '../utils/crypto.js';
import { structuredLog, structuredError, formatErrorMessage } from '../utils/log.js';
import { CloudflareApi } from './cf-api.js';

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
    const tenantId = input.existingTenantId || generateTenantId();
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
  // Uses CloudflareApi for real resource creation (falls back to simulated IDs when CF_API_TOKEN is not configured)
  async createResources(plan: ProvisioningPlan): Promise<void> {
    const cfApi = new CloudflareApi(this.env);
    const resources = await cfApi.provisionTenantResources(plan.tenantId, plan.subdomain);

    const resourceMap = [
      { type: 'worker', result: resources.worker },
      { type: 'd1', result: resources.d1 },
      { type: 'kv', result: resources.kv },
      { type: 'r2', result: resources.r2 },
    ] as const;

    for (const { type, result } of resourceMap) {
      if (plan.resources[type]) {
        await createTenantResource(this.env.DB, {
          id: generateResourceId(),
          tenant_id: plan.tenantId,
          resource_type: type,
          resource_id: result.id,
          config: JSON.stringify({
            plan: plan.plan,
            subdomain: plan.subdomain,
            name: result.name,
          }),
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
    const jwt = await createJWT({ sub: tenantId, role: 'admin' }, this.env.JWT_SECRET, API_KEY_EXPIRY_SECONDS);
    const webhookSecret = generateApiKey();

    // Store API key hash in KV for fast lookup
    await this.env.CACHE.put(`apikey:${apiKey}`, tenantId, { expirationTtl: API_KEY_EXPIRY_SECONDS });

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
    // Log notification (email integration handled by EmailSender service)
    structuredLog('tenant_provisioned', { tenant_id: tenantId });
  }

  // Orchestrator - runs all 6 steps with logging and rollback
  async provision(input: CreateTenantInput): Promise<ProvisionResult> {
    const steps = ['plan', 'create_resources', 'init_openclaw', 'setup_auth', 'verify', 'notify'] as const;
    let plan: ProvisioningPlan | null = null;
    let auth: AuthConfig | null = null;

    for (const step of steps) {
      const logId = crypto.randomUUID();

      // For 'plan' step, execute first to get tenantId, then log
      if (step === 'plan') {
        try {
          plan = await this.plan(input);
          if (!input.existingTenantId) {
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
          }
          // Now we have a valid tenantId, log success
          await createProvisioningLog(this.env.DB, {
            id: logId,
            tenant_id: plan.tenantId,
            step,
            status: 'completed',
            details: null,
            started_at: nowISO(),
            completed_at: nowISO(),
            error_message: null,
          });
        } catch (error) {
          const errorMsg = formatErrorMessage(error);
          // Can't log to DB if we don't have a valid tenantId
          if (plan?.tenantId) {
            await createProvisioningLog(this.env.DB, {
              id: logId,
              tenant_id: plan.tenantId,
              step,
              status: 'failed',
              details: null,
              started_at: nowISO(),
              completed_at: nowISO(),
              error_message: errorMsg,
            });
          }
          throw new Error(`Provisioning failed at step '${step}': ${errorMsg}`);
        }
        continue;
      }

      // All other steps: plan is guaranteed to exist
      await createProvisioningLog(this.env.DB, {
        id: logId,
        tenant_id: plan!.tenantId,
        step,
        status: 'running',
        details: null,
        started_at: nowISO(),
        completed_at: null,
        error_message: null,
      });

      try {
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
            await updateTenant(this.env.DB, plan.tenantId, { status: 'active' });
            break;
        }

        await updateProvisioningLog(this.env.DB, logId, {
          tenant_id: plan.tenantId,
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

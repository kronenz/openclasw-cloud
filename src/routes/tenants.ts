import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, ApiResponse, Tenant } from '../types/index.js';
import {
  createTenant,
  getTenant,
  listTenants,
  updateTenant,
  getTenantUsageSummary,
  getTenantResources,
  createIncident,
} from '../db/queries.js';
import { generateTenantId, generateSubdomain, toDateString } from '../utils/id.js';
import { TenantProvisioner } from '../services/tenant-provisioner.js';
import { RESERVED_SUBDOMAINS, MAX_METADATA_SIZE_BYTES } from '../config/constants.js';
import { structuredLog, structuredWarn, structuredError, formatErrorMessage } from '../utils/log.js';
import { withErrorHandler, validationError } from '../utils/error-handler.js';
import { tenantScope } from '../middleware/tenant-scope.js';

const tenants = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  plan: z.enum(['starter', 'growth', 'enterprise']).optional().default('starter'),
  contact_email: z.string().email(),
  contact_name: z.string().max(100).optional(),
  subdomain: z.string().max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Subdomain must be lowercase alphanumeric with hyphens')
    .refine((val) => !RESERVED_SUBDOMAINS.has(val), { message: 'This subdomain is reserved' })
    .optional(),
  metadata: z.record(z.unknown()).optional().refine(
    (val) => !val || JSON.stringify(val).length <= MAX_METADATA_SIZE_BYTES,
    { message: 'Metadata must be 10KB or less' }
  ),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  plan: z.enum(['starter', 'growth', 'enterprise']).optional(),
  status: z.enum(['provisioning', 'active', 'suspended', 'deleted']).optional(),
  contact_email: z.string().email().optional(),
  subdomain: z.string().max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Subdomain must be lowercase alphanumeric with hyphens')
    .refine((val) => !RESERVED_SUBDOMAINS.has(val), { message: 'This subdomain is reserved' })
    .optional(),
  metadata: z.record(z.unknown()).optional().refine(
    (val) => !val || JSON.stringify(val).length <= MAX_METADATA_SIZE_BYTES,
    { message: 'Metadata must be 10KB or less' }
  ),
});

const listTenantsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['provisioning', 'active', 'suspended', 'deleted']).optional(),
});

const usageQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

// POST / - create tenant
tenants.post('/', withErrorHandler('tenant_create_failed', async (c) => {
  const body = await c.req.json();
  const parsed = createTenantSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Validation failed', parsed.error.errors);
  }

  const data = parsed.data;
  const tenantId = generateTenantId();
  const subdomain = data.subdomain || generateSubdomain(data.name);

  const tenant = await createTenant(c.env.DB, {
    id: tenantId,
    name: data.name,
    plan: data.plan,
    status: 'provisioning',
    subdomain,
    contact_email: data.contact_email,
    contact_name: data.contact_name || null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
  });

  // Trigger async provisioning pipeline in background
  const provisioner = new TenantProvisioner(c.env);
  try {
    c.executionCtx.waitUntil(
      provisioner.provision({
        name: data.name,
        plan: data.plan,
        subdomain,
        contact_email: data.contact_email,
        contact_name: data.contact_name,
        metadata: data.metadata,
      }).catch(async (error) => {
        structuredError('provisioning_failed', error, { tenantId });
        // Create incident for failed provisioning so operators are notified
        try {
          await createIncident(c.env.DB, {
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            severity: 'P1',
            status: 'open',
            title: `Provisioning failed for tenant ${tenantId}`,
            description: formatErrorMessage(error),
            auto_recovery_attempts: 0,
            resolved_at: null,
          });
        } catch (incidentError) {
          structuredError('incident_creation_failed', incidentError);
        }
      })
    );
  } catch (e) {
    // In test environment, executionCtx is not available
    // Provisioning will be handled separately or mocked
    structuredWarn('provisioning_no_execution_context');
  }

  return c.json<ApiResponse<Tenant>>({
    success: true,
    data: tenant,
  }, 201);
}));

// GET / - list tenants
tenants.get('/', withErrorHandler('tenants_list_failed', async (c) => {
  const queryParams = {
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    status: c.req.query('status'),
  };

  const parsed = listTenantsQuerySchema.safeParse(queryParams);

  if (!parsed.success) {
    return validationError(c, parsed.error.message);
  }

  const { limit, offset, status } = parsed.data;

  const tenantList = await listTenants(c.env.DB, {
    status: status || undefined,
    limit,
    offset,
  });

  return c.json<ApiResponse<Tenant[]>>({
    success: true,
    data: tenantList,
  });
}));

// GET /:id - get tenant by ID
tenants.get('/:id', tenantScope, withErrorHandler('tenant_get_failed', async (c) => {
  const id = c.req.param('id');
  const tenant = await getTenant(c.env.DB, id);

  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: 'TENANT_NOT_FOUND',
    }, 404);
  }

  return c.json<ApiResponse<Tenant>>({
    success: true,
    data: tenant,
  });
}));

// PUT /:id - update tenant
tenants.put('/:id', tenantScope, withErrorHandler('tenant_update_failed', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateTenantSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Validation failed', parsed.error.errors);
  }

  const data = parsed.data;
  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.plan !== undefined) updates.plan = data.plan;
  if (data.status !== undefined) updates.status = data.status;
  if (data.contact_email !== undefined) updates.contact_email = data.contact_email;
  if (data.subdomain !== undefined) updates.subdomain = data.subdomain;
  if (data.metadata !== undefined) updates.metadata = JSON.stringify(data.metadata);

  const tenant = await updateTenant(c.env.DB, id, updates);

  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: 'TENANT_NOT_FOUND',
    }, 404);
  }

  return c.json<ApiResponse<Tenant>>({
    success: true,
    data: tenant,
  });
}));

// DELETE /:id - soft delete tenant
tenants.delete('/:id', tenantScope, withErrorHandler('tenant_delete_failed', async (c) => {
  const id = c.req.param('id');
  const tenant = await updateTenant(c.env.DB, id, { status: 'deleted' });

  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: 'TENANT_NOT_FOUND',
    }, 404);
  }

  return c.json<ApiResponse<Tenant>>({
    success: true,
    data: tenant,
  });
}));

// GET /:id/usage - get usage for tenant
tenants.get('/:id/usage', tenantScope, withErrorHandler('tenant_usage_get_failed', async (c) => {
  const id = c.req.param('id');
  const queryParams = {
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
  };

  const parsed = usageQuerySchema.safeParse(queryParams);

  if (!parsed.success) {
    return validationError(c, parsed.error.message);
  }

  const startDate = parsed.data.start_date || toDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const endDate = parsed.data.end_date || toDateString();

  const usage = await getTenantUsageSummary(c.env.DB, id, startDate, endDate);

  return c.json<ApiResponse>({
    success: true,
    data: {
      tenant_id: id,
      start_date: startDate,
      end_date: endDate,
      usage,
    },
  });
}));

// GET /:id/health - tenant health check
tenants.get('/:id/health', tenantScope, withErrorHandler('tenant_health_check_failed', async (c) => {
  const id = c.req.param('id');
  const tenant = await getTenant(c.env.DB, id);

  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: 'TENANT_NOT_FOUND',
    }, 404);
  }

  const resources = await getTenantResources(c.env.DB, id);

  // Basic health check based on tenant status and resources
  const status = tenant.status === 'active' && resources.length > 0 ? 'healthy' : 'degraded';

  return c.json<ApiResponse>({
    success: true,
    data: {
      tenant_id: id,
      status,
      tenant_status: tenant.status,
      resources_count: resources.length,
      last_checked: new Date().toISOString(),
    },
  });
}));

export { tenants };

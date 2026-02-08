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
import { structuredLog, structuredWarn, structuredError } from '../utils/log.js';

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

// POST / - create tenant
tenants.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createTenantSchema.safeParse(body);

    if (!parsed.success) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.errors,
      }, 400);
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
              description: error instanceof Error ? error.message : String(error),
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
  } catch (e) {
    structuredError('tenant_create_failed', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to create tenant',
      code: 'TENANT_CREATE_FAILED',
    }, 500);
  }
});

// GET / - list tenants
tenants.get('/', async (c) => {
  try {
    const status = c.req.query('status');
    const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') || '50', 10), 100));
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));

    const tenantList = await listTenants(c.env.DB, {
      status: status || undefined,
      limit,
      offset,
    });

    return c.json<ApiResponse<Tenant[]>>({
      success: true,
      data: tenantList,
    });
  } catch (e) {
    structuredError('tenant_list_failed', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to list tenants',
      code: 'TENANT_LIST_FAILED',
    }, 500);
  }
});

// GET /:id - get tenant by ID
tenants.get('/:id', async (c) => {
  try {
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
  } catch (e) {
    structuredError('tenant_get_failed', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get tenant',
      code: 'TENANT_GET_FAILED',
    }, 500);
  }
});

// PUT /:id - update tenant
tenants.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = updateTenantSchema.safeParse(body);

    if (!parsed.success) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.errors,
      }, 400);
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
  } catch (e) {
    structuredError('tenant_update_failed', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to update tenant',
      code: 'TENANT_UPDATE_FAILED',
    }, 500);
  }
});

// DELETE /:id - soft delete tenant
tenants.delete('/:id', async (c) => {
  try {
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
  } catch (e) {
    structuredError('tenant_delete_failed', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to delete tenant',
      code: 'TENANT_DELETE_FAILED',
    }, 500);
  }
});

// GET /:id/usage - get usage for tenant
tenants.get('/:id/usage', async (c) => {
  try {
    const id = c.req.param('id');
    const startDateParam = c.req.query('start_date');
    const endDateParam = c.req.query('end_date');

    // Validate date format
    if (startDateParam && !/^\d{4}-\d{2}-\d{2}$/.test(startDateParam)) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
        code: 'VALIDATION_ERROR',
      }, 400);
    }

    if (endDateParam && !/^\d{4}-\d{2}-\d{2}$/.test(endDateParam)) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
        code: 'VALIDATION_ERROR',
      }, 400);
    }

    const startDate = startDateParam || toDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endDate = endDateParam || toDateString();

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
  } catch (e) {
    structuredError('tenant_usage_get_failed', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get tenant usage',
      code: 'USAGE_GET_FAILED',
    }, 500);
  }
});

// GET /:id/health - tenant health check
tenants.get('/:id/health', async (c) => {
  try {
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
  } catch (e) {
    structuredError('tenant_health_check_failed', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to check tenant health',
      code: 'HEALTH_CHECK_FAILED',
    }, 500);
  }
});

export { tenants };

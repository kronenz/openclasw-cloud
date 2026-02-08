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
} from '../db/queries.js';
import { generateTenantId, generateSubdomain } from '../utils/id.js';
import { TenantProvisioner } from '../services/tenant-provisioner.js';

const tenants = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  plan: z.enum(['starter', 'growth', 'enterprise']).optional().default('starter'),
  contact_email: z.string().email(),
  contact_name: z.string().optional(),
  subdomain: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  plan: z.enum(['starter', 'growth', 'enterprise']).optional(),
  status: z.enum(['provisioning', 'active', 'suspended', 'deleted']).optional(),
  contact_email: z.string().email().optional(),
  subdomain: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
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
    c.executionCtx.waitUntil(
      provisioner.provision({
        name: data.name,
        plan: data.plan,
        subdomain,
        contact_email: data.contact_email,
        contact_name: data.contact_name,
        metadata: data.metadata,
      }).catch((error) => {
        console.error(`Provisioning failed for tenant ${tenantId}:`, error);
      })
    );

    return c.json<ApiResponse<Tenant>>({
      success: true,
      data: tenant,
    }, 201);
  } catch (e) {
    console.error('Failed to create tenant:', e);
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
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const tenantList = await listTenants(c.env.DB, {
      status: status || undefined,
      limit: Math.min(limit, 100),
      offset,
    });

    return c.json<ApiResponse<Tenant[]>>({
      success: true,
      data: tenantList,
    });
  } catch (e) {
    console.error('Failed to list tenants:', e);
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
    console.error('Failed to get tenant:', e);
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
    console.error('Failed to update tenant:', e);
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
    console.error('Failed to delete tenant:', e);
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
    const startDate = c.req.query('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = c.req.query('end_date') || new Date().toISOString().split('T')[0];

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
    console.error('Failed to get tenant usage:', e);
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
    console.error('Failed to check tenant health:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to check tenant health',
      code: 'HEALTH_CHECK_FAILED',
    }, 500);
  }
});

export { tenants };

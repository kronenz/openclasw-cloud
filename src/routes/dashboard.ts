import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, Variables, ApiResponse } from '../types/index.js';
import { getTenant, getDailyUsage, getSubscription, getTenantUsageSummary } from '../db/queries.js';
import { listNotifications } from '../db/queries-v2.js';
import { generateApiKey } from '../utils/crypto.js';
import { toDateString } from '../utils/id.js';
import { withErrorHandler, validationError } from '../utils/error-handler.js';
import { API_KEY_EXPIRY_SECONDS, MS_PER_DAY } from '../config/constants.js';

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Validation schemas
const chartsPeriodSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});

// Helper to get tenant ID from JWT
function getTenantIdFromJWT(c: { get: (k: string) => Record<string, unknown> | undefined }): string {
  const payload = c.get('jwtPayload');
  return (payload?.sub as string) || '';
}

// GET /summary - Dashboard summary for the authenticated tenant
dashboard.get('/summary', withErrorHandler('dashboard_summary_failed', async (c) => {
  const tenantId = getTenantIdFromJWT(c);

  if (!tenantId) {
    return validationError(c, 'tenant_id is required');
  }

  // Fetch tenant info
  const tenant = await getTenant(c.env.DB, tenantId);

  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: 'TENANT_NOT_FOUND',
    }, 404);
  }

  // Fetch today's usage
  const today = toDateString();
  const usageToday = await getDailyUsage(c.env.DB, tenantId, today);

  // Fetch active subscription
  const subscription = await getSubscription(c.env.DB, tenantId);

  // Fetch recent notifications (last 5)
  const notifications = await listNotifications(c.env.DB, {
    tenantId,
    limit: 5,
  });

  // Service health status (basic check based on tenant status)
  const healthStatus = tenant.status === 'active' ? 'healthy' : 'degraded';

  return c.json<ApiResponse>({
    success: true,
    data: {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
        subdomain: tenant.subdomain,
      },
      usage_today: {
        tokens: usageToday?.total_tokens || 0,
        requests: usageToday?.total_requests || 0,
        cost: usageToday?.total_cost || 0,
      },
      subscription: subscription ? {
        plan: subscription.plan_id,
        status: subscription.status,
        period_end: subscription.current_period_end,
      } : null,
      notifications,
      health_status: healthStatus,
    },
  });
}));

// GET /charts - Chart data for the tenant
dashboard.get('/charts', withErrorHandler('dashboard_charts_failed', async (c) => {
  const tenantId = getTenantIdFromJWT(c);

  if (!tenantId) {
    return validationError(c, 'tenant_id is required');
  }

  const queryParams = c.req.query();
  const parsed = chartsPeriodSchema.safeParse(queryParams);

  if (!parsed.success) {
    return validationError(c, 'Invalid query parameters', parsed.error.errors);
  }

  const { period } = parsed.data;

  // Calculate date range based on period
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const endDate = toDateString();
  const startDate = toDateString(new Date(Date.now() - periodDays * MS_PER_DAY));

  // Fetch usage data for the period
  const usage = await getTenantUsageSummary(c.env.DB, tenantId, startDate, endDate);

  // Transform data for chart format
  const chartData = usage.map(day => ({
    date: day.date,
    total_tokens: day.total_tokens,
    total_requests: day.total_requests,
    total_cost: day.total_cost,
  }));

  return c.json<ApiResponse>({
    success: true,
    data: {
      period,
      data: chartData,
    },
  });
}));

// POST /api-key/regenerate - Regenerate API key
dashboard.post('/api-key/regenerate', withErrorHandler('dashboard_apikey_regenerate_failed', async (c) => {
  const tenantId = getTenantIdFromJWT(c);

  if (!tenantId) {
    return validationError(c, 'tenant_id is required');
  }

  // Verify tenant exists
  const tenant = await getTenant(c.env.DB, tenantId);

  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: 'TENANT_NOT_FOUND',
    }, 404);
  }

  // Generate new API key
  const newApiKey = generateApiKey();

  // Store new key in KV (CACHE binding)
  // Format: apikey:{key} -> tenantId
  await c.env.CACHE.put(`apikey:${newApiKey}`, tenantId, {
    expirationTtl: API_KEY_EXPIRY_SECONDS,
  });

  return c.json<ApiResponse>({
    success: true,
    data: {
      api_key: newApiKey,
      expires_in: '365 days',
    },
  });
}));

export { dashboard };

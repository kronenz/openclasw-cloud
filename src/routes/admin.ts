import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, Variables, ApiResponse, PaginatedApiResponse, Tenant, Incident } from '../types/index.js';
import { getTenant, updateTenant, listIncidents } from '../db/queries.js';
import { ADMIN_TENANT_STATUSES, INCIDENT_STATUSES, TENANT_SEGMENTS, ERROR_CODES } from '../config/constants.js';
import { safeJsonParse } from '../utils/json.js';
import { structuredLog } from '../utils/log.js';
import { withErrorHandler, validationError } from '../utils/error-handler.js';
import { nowISO } from '../utils/id.js';

// D1 query result types
interface StatusCount { status: string; count: number }
interface RevenueRow { mrr: number; active_subscriptions: number }
interface CriticalCountRow { critical_incidents: number }
interface TenantDetailRow { resources: string; subscription: string; segment: string; monthly_cost: number }
interface PlatformMetricsRow {
  active_tenants: number; total_tenants: number;
  monthly_tokens: number; monthly_cost: number; monthly_requests: number;
  avg_daily_cost: number; open_incidents: number; critical_incidents: number;
}
interface ModelBreakdownRow { model: string; total_tokens: number; total_cost: number; request_count: number }
interface SegmentRow { segment: string; count: number; avg_score: number }
interface BillingSummaryRow { mrr: number; paying_customers: number; arpu: number }
interface ChurnRow { churned: number }
interface TransactionRow {
  id: string; tenant_id: string; tenant_name: string; plan_name: string;
  amount: number; status: string; current_period_start: string;
  current_period_end: string; payment_method: string; updated_at: string;
}
interface AdminTenantRow extends Tenant {
  plan_name: string | null;
  monthly_price: number | null;
  subscription_status: string | null;
  segment: string | null;
  segment_score: number | null;
}

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Validation schemas
const listTenantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([...ADMIN_TENANT_STATUSES]).optional(),
  search: z.string().max(200).optional(),
});

const suspendTenantBodySchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

const listIncidentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([...INCIDENT_STATUSES]).optional(),
});

const listSegmentsQuerySchema = z.object({
  segment: z.enum([...TENANT_SEGMENTS]).optional(),
});

// GET / - Platform dashboard summary
admin.get('/', withErrorHandler('dashboard_summary_failed', async (c) => {
  // Get tenant count by status
  const tenantCountStmt = c.env.DB.prepare(`
    SELECT status, COUNT(*) as count
    FROM tenants
    GROUP BY status
  `);
  const tenantCounts = await tenantCountStmt.all<StatusCount>();

  // Get total revenue (MRR)
  const revenueStmt = c.env.DB.prepare(`
    SELECT
      SUM(bp.monthly_price) as mrr,
      COUNT(bs.id) as active_subscriptions
    FROM billing_subscriptions bs
    JOIN billing_plans bp ON bs.plan_id = bp.id
    WHERE bs.status = 'active'
  `);
  const revenue = await revenueStmt.first<RevenueRow>();

  // Get incident count by status
  const incidentStmt = c.env.DB.prepare(`
    SELECT status, COUNT(*) as count
    FROM incidents
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY status
  `);
  const incidents = await incidentStmt.all<StatusCount>();

  // Calculate uptime (based on P0/P1 incidents)
  const uptimeStmt = c.env.DB.prepare(`
    SELECT COUNT(*) as critical_incidents
    FROM incidents
    WHERE severity IN ('P0', 'P1')
    AND created_at >= datetime('now', '-30 days')
  `);
  const uptimeData = await uptimeStmt.first<CriticalCountRow>();
  const criticalCount = Number(uptimeData?.critical_incidents) || 0;
  const uptime = Math.max(0, 100 - (criticalCount * 0.1));

  const mrr = Number(revenue?.mrr) || 0;

  return c.json<ApiResponse>({
    success: true,
    data: {
      tenants: tenantCounts.results || [],
      revenue: {
        mrr,
        arr: mrr * 12,
        active_subscriptions: revenue?.active_subscriptions || 0,
      },
      incidents: incidents.results || [],
      uptime: uptime.toFixed(2),
      timestamp: nowISO(),
    },
  });
}));

// GET /tenants - All tenants with full details
admin.get('/tenants', withErrorHandler('admin_tenants_list_failed', async (c) => {
  const queryParams = {
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    status: c.req.query('status'),
    search: c.req.query('search'),
  };

  const parsed = listTenantsQuerySchema.safeParse(queryParams);

  if (!parsed.success) {
    return validationError(c, parsed.error.message);
  }

  const { page, limit, status, search } = parsed.data;
  const offset = (page - 1) * limit;

  // Get tenants with subscription and segment info
  let query = `
    SELECT
      t.*,
      bp.name as plan_name,
      bp.monthly_price,
      bs.status as subscription_status,
      ts.segment,
      ts.score as segment_score
    FROM tenants t
    LEFT JOIN billing_subscriptions bs ON t.id = bs.tenant_id AND bs.status = 'active'
    LEFT JOIN billing_plans bp ON bs.plan_id = bp.id
    LEFT JOIN tenant_segments ts ON t.id = ts.tenant_id
  `;
  const bindings: (string | number)[] = [];

  if (status) {
    query += ` WHERE t.status = ?`;
    bindings.push(status);
  }

  if (search) {
    query += status ? ` AND` : ` WHERE`;
    query += ` (t.name LIKE ? OR t.id LIKE ?)`;
    bindings.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
  bindings.push(limit, offset);

  const stmt = c.env.DB.prepare(query).bind(...bindings);
  const result = await stmt.all<AdminTenantRow>();

  return c.json<PaginatedApiResponse<AdminTenantRow>>({
    success: true,
    data: result.results || [],
    meta: {
      page,
      limit,
      offset,
      count: result.results?.length || 0,
    },
  });
}));

// GET /tenants/:id - Single tenant full detail
admin.get('/tenants/:id', withErrorHandler('admin_tenant_details_failed', async (c) => {
  const id = c.req.param('id');
  const tenant = await getTenant(c.env.DB, id);

  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  // Get additional details
  const detailsStmt = c.env.DB.prepare(`
    SELECT
      (SELECT json_group_array(json_object(
        'id', id,
        'resource_type', resource_type,
        'resource_id', resource_id,
        'created_at', created_at
      ))
      FROM tenant_resources WHERE tenant_id = ?) as resources,

      (SELECT json_object(
        'status', status,
        'plan_id', plan_id,
        'current_period_start', current_period_start,
        'current_period_end', current_period_end
      )
      FROM billing_subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1) as subscription,

      (SELECT json_object(
        'segment', segment,
        'score', score,
        'last_active_at', last_active_at
      )
      FROM tenant_segments WHERE tenant_id = ?) as segment,

      (SELECT SUM(total_cost)
      FROM daily_usage
      WHERE tenant_id = ?
      AND date >= date('now', '-30 days')) as monthly_cost
  `).bind(id, id, id, id);

  const details = await detailsStmt.first<TenantDetailRow>();

  return c.json<ApiResponse>({
    success: true,
    data: {
      ...tenant,
      resources: safeJsonParse(details?.resources, []),
      subscription: safeJsonParse(details?.subscription, null),
      segment: safeJsonParse(details?.segment, null),
      monthly_cost: details?.monthly_cost || 0,
    },
  });
}));

// POST /tenants/:id/suspend - Suspend a tenant
admin.post('/tenants/:id/suspend', withErrorHandler('admin_tenant_suspend_failed', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = suspendTenantBodySchema.safeParse(body || {});

  if (!parsed.success) {
    return validationError(c, parsed.error.message);
  }

  const tenant = await updateTenant(c.env.DB, id, { status: 'suspended' });

  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  // Log the action
  structuredLog('tenant_suspended', {
    tenant_id: id,
    admin: c.get('jwtPayload'),
    reason: parsed.data.reason,
  });

  return c.json<ApiResponse<Tenant>>({
    success: true,
    data: tenant,
  });
}));

// POST /tenants/:id/activate - Activate a tenant
admin.post('/tenants/:id/activate', withErrorHandler('admin_tenant_activate_failed', async (c) => {
  const id = c.req.param('id');
  const tenant = await updateTenant(c.env.DB, id, { status: 'active' });

  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  // Log the action
  structuredLog('tenant_activated', {
    tenant_id: id,
    admin: c.get('jwtPayload'),
  });

  return c.json<ApiResponse<Tenant>>({
    success: true,
    data: tenant,
  });
}));

// GET /metrics - Platform-wide metrics
admin.get('/metrics', withErrorHandler('admin_metrics_failed', async (c) => {
  const metricsStmt = c.env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tenants WHERE status = 'active') as active_tenants,
      (SELECT COUNT(*) FROM tenants) as total_tenants,
      (SELECT SUM(total_tokens) FROM daily_usage WHERE date >= date('now', '-30 days')) as monthly_tokens,
      (SELECT SUM(total_cost) FROM daily_usage WHERE date >= date('now', '-30 days')) as monthly_cost,
      (SELECT SUM(total_requests) FROM daily_usage WHERE date >= date('now', '-30 days')) as monthly_requests,
      (SELECT AVG(total_cost) FROM daily_usage WHERE date >= date('now', '-30 days')) as avg_daily_cost,
      (SELECT COUNT(*) FROM incidents WHERE status = 'open') as open_incidents,
      (SELECT COUNT(*) FROM incidents WHERE severity IN ('P0', 'P1') AND status = 'open') as critical_incidents
  `);

  const metrics = await metricsStmt.first<PlatformMetricsRow>();

  // Get model breakdown
  const modelBreakdownStmt = c.env.DB.prepare(`
    SELECT model,
           SUM(input_tokens + output_tokens) as total_tokens,
           SUM(cost_usd) as total_cost,
           COUNT(*) as request_count
    FROM usage_logs
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY model
    ORDER BY total_cost DESC
  `);
  const modelBreakdown = await modelBreakdownStmt.all<ModelBreakdownRow>();

  return c.json<ApiResponse>({
    success: true,
    data: {
      overview: metrics,
      model_breakdown: modelBreakdown.results || [],
      timestamp: nowISO(),
    },
  });
}));

// GET /incidents - All incidents with filtering
admin.get('/incidents', withErrorHandler('admin_incidents_list_failed', async (c) => {
  const queryParams = {
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    status: c.req.query('status'),
  };

  const parsed = listIncidentsQuerySchema.safeParse(queryParams);

  if (!parsed.success) {
    return validationError(c, parsed.error.message);
  }

  const { status } = parsed.data;
  const severity = c.req.query('severity');
  const tenantId = c.req.query('tenant_id');

  const incidents = await listIncidents(c.env.DB, {
    status: status || undefined,
    severity: severity || undefined,
    tenantId: tenantId || undefined,
  });

  return c.json<ApiResponse<Incident[]>>({
    success: true,
    data: incidents,
  });
}));

// GET /segments - Tenant segment distribution
admin.get('/segments', withErrorHandler('admin_segments_failed', async (c) => {
  const queryParams = {
    segment: c.req.query('segment'),
  };

  const parsed = listSegmentsQuerySchema.safeParse(queryParams);

  if (!parsed.success) {
    return validationError(c, parsed.error.message);
  }

  const { segment } = parsed.data;

  let query = `
    SELECT
      segment,
      COUNT(*) as count,
      AVG(score) as avg_score
    FROM tenant_segments
  `;
  const bindings: string[] = [];

  if (segment) {
    query += ` WHERE segment = ?`;
    bindings.push(segment);
  }

  query += ` GROUP BY segment ORDER BY count DESC`;

  const stmt = c.env.DB.prepare(query).bind(...bindings);
  const segments = await stmt.all<SegmentRow>();

  return c.json<ApiResponse>({
    success: true,
    data: segments.results || [],
  });
}));

// GET /billing/summary - Revenue summary
admin.get('/billing/summary', withErrorHandler('admin_billing_summary_failed', async (c) => {
  const summaryStmt = c.env.DB.prepare(`
    SELECT
      SUM(bp.monthly_price) as mrr,
      COUNT(DISTINCT bs.tenant_id) as paying_customers,
      AVG(bp.monthly_price) as arpu
    FROM billing_subscriptions bs
    JOIN billing_plans bp ON bs.plan_id = bp.id
    WHERE bs.status = 'active'
  `);
  const summary = await summaryStmt.first<BillingSummaryRow>();

  // Calculate churn (tenants that canceled in last 30 days)
  const churnStmt = c.env.DB.prepare(`
    SELECT COUNT(*) as churned
    FROM billing_subscriptions
    WHERE status = 'canceled'
    AND updated_at >= datetime('now', '-30 days')
  `);
  const churnData = await churnStmt.first<ChurnRow>();

  const totalCustomers = Number(summary?.paying_customers) || 0;
  const churnRate = totalCustomers > 0
    ? ((Number(churnData?.churned) || 0) / totalCustomers * 100).toFixed(2)
    : '0.00';

  return c.json<ApiResponse>({
    success: true,
    data: {
      mrr: summary?.mrr || 0,
      arr: (Number(summary?.mrr) || 0) * 12,
      paying_customers: totalCustomers,
      arpu: summary?.arpu || 0,
      churn_rate: churnRate,
      timestamp: nowISO(),
    },
  });
}));

// GET /billing/transactions - Recent billing transactions
admin.get('/billing/transactions', withErrorHandler('admin_billing_transactions_failed', async (c) => {
  const queryParams = {
    page: c.req.query('page'),
    limit: c.req.query('limit') || '50',
  };

  const parsed = listTenantsQuerySchema.pick({ page: true, limit: true }).safeParse(queryParams);

  if (!parsed.success) {
    return validationError(c, parsed.error.message);
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const transactionsStmt = c.env.DB.prepare(`
    SELECT
      bs.id,
      bs.tenant_id,
      t.name as tenant_name,
      bp.display_name as plan_name,
      bp.monthly_price as amount,
      bs.status,
      bs.current_period_start,
      bs.current_period_end,
      bs.payment_method,
      bs.updated_at
    FROM billing_subscriptions bs
    JOIN tenants t ON bs.tenant_id = t.id
    JOIN billing_plans bp ON bs.plan_id = bp.id
    ORDER BY bs.updated_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset);

  const transactions = await transactionsStmt.all<TransactionRow>();

  return c.json<PaginatedApiResponse<TransactionRow>>({
    success: true,
    data: transactions.results || [],
    meta: {
      page,
      limit,
      offset,
      count: transactions.results?.length || 0,
    },
  });
}));

export { admin };

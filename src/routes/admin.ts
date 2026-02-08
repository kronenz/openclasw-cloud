import { Hono } from 'hono';
import type { Bindings, Variables, ApiResponse, Tenant, Incident } from '../types/index.js';
import { getTenant, updateTenant, listIncidents } from '../db/queries.js';
import { safeJsonParse } from '../utils/json.js';

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET / - Platform dashboard summary
admin.get('/', async (c) => {
  try {
    // Get tenant count by status
    const tenantCountStmt = c.env.DB.prepare(`
      SELECT status, COUNT(*) as count
      FROM tenants
      GROUP BY status
    `);
    const tenantCounts = await tenantCountStmt.all();

    // Get total revenue (MRR)
    const revenueStmt = c.env.DB.prepare(`
      SELECT
        SUM(bp.monthly_price) as mrr,
        COUNT(bs.id) as active_subscriptions
      FROM billing_subscriptions bs
      JOIN billing_plans bp ON bs.plan_id = bp.id
      WHERE bs.status = 'active'
    `);
    const revenue = await revenueStmt.first();

    // Get incident count by status
    const incidentStmt = c.env.DB.prepare(`
      SELECT status, COUNT(*) as count
      FROM incidents
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY status
    `);
    const incidents = await incidentStmt.all();

    // Calculate uptime (based on P0/P1 incidents)
    const uptimeStmt = c.env.DB.prepare(`
      SELECT COUNT(*) as critical_incidents
      FROM incidents
      WHERE severity IN ('P0', 'P1')
      AND created_at >= datetime('now', '-30 days')
    `);
    const uptimeData = await uptimeStmt.first();
    const criticalCount = (uptimeData?.critical_incidents as number) || 0;
    const uptime = Math.max(0, 100 - (criticalCount * 0.1));

    const mrr = (revenue?.mrr as number) || 0;

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
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to get dashboard summary:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get dashboard summary',
      code: 'DASHBOARD_FAILED',
    }, 500);
  }
});

// GET /tenants - All tenants with full details
admin.get('/tenants', async (c) => {
  try {
    const status = c.req.query('status');
    const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') || '100', 10), 500));
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));

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

    query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const stmt = c.env.DB.prepare(query).bind(...bindings);
    const result = await stmt.all();

    return c.json({
      success: true,
      data: result.results || [],
      meta: {
        limit,
        offset,
        count: result.results?.length || 0,
      },
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

// GET /tenants/:id - Single tenant full detail
admin.get('/tenants/:id', async (c) => {
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

    const details = await detailsStmt.first();

    return c.json<ApiResponse>({
      success: true,
      data: {
        ...tenant,
        resources: safeJsonParse(details?.resources as string | undefined, []),
        subscription: safeJsonParse(details?.subscription as string | undefined, null),
        segment: safeJsonParse(details?.segment as string | undefined, null),
        monthly_cost: details?.monthly_cost || 0,
      },
    });
  } catch (e) {
    console.error('Failed to get tenant details:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get tenant details',
      code: 'TENANT_GET_FAILED',
    }, 500);
  }
});

// POST /tenants/:id/suspend - Suspend a tenant
admin.post('/tenants/:id/suspend', async (c) => {
  try {
    const id = c.req.param('id');
    const tenant = await updateTenant(c.env.DB, id, { status: 'suspended' });

    if (!tenant) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      }, 404);
    }

    // Log the action
    console.log(JSON.stringify({
      action: 'tenant_suspended',
      tenant_id: id,
      admin: c.get('jwtPayload'),
      timestamp: new Date().toISOString(),
    }));

    return c.json<ApiResponse<Tenant>>({
      success: true,
      data: tenant,
    });
  } catch (e) {
    console.error('Failed to suspend tenant:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to suspend tenant',
      code: 'TENANT_SUSPEND_FAILED',
    }, 500);
  }
});

// POST /tenants/:id/activate - Activate a tenant
admin.post('/tenants/:id/activate', async (c) => {
  try {
    const id = c.req.param('id');
    const tenant = await updateTenant(c.env.DB, id, { status: 'active' });

    if (!tenant) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      }, 404);
    }

    // Log the action
    console.log(JSON.stringify({
      action: 'tenant_activated',
      tenant_id: id,
      admin: c.get('jwtPayload'),
      timestamp: new Date().toISOString(),
    }));

    return c.json<ApiResponse<Tenant>>({
      success: true,
      data: tenant,
    });
  } catch (e) {
    console.error('Failed to activate tenant:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to activate tenant',
      code: 'TENANT_ACTIVATE_FAILED',
    }, 500);
  }
});

// GET /metrics - Platform-wide metrics
admin.get('/metrics', async (c) => {
  try {
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

    const metrics = await metricsStmt.first();

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
    const modelBreakdown = await modelBreakdownStmt.all();

    return c.json<ApiResponse>({
      success: true,
      data: {
        overview: metrics,
        model_breakdown: modelBreakdown.results || [],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to get metrics:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get metrics',
      code: 'METRICS_FAILED',
    }, 500);
  }
});

// GET /incidents - All incidents with filtering
admin.get('/incidents', async (c) => {
  try {
    const status = c.req.query('status');
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
  } catch (e) {
    console.error('Failed to list incidents:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to list incidents',
      code: 'INCIDENTS_LIST_FAILED',
    }, 500);
  }
});

// GET /segments - Tenant segment distribution
admin.get('/segments', async (c) => {
  try {
    const segmentStmt = c.env.DB.prepare(`
      SELECT
        segment,
        COUNT(*) as count,
        AVG(score) as avg_score
      FROM tenant_segments
      GROUP BY segment
      ORDER BY count DESC
    `);
    const segments = await segmentStmt.all();

    return c.json<ApiResponse>({
      success: true,
      data: segments.results || [],
    });
  } catch (e) {
    console.error('Failed to get segments:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get segments',
      code: 'SEGMENTS_FAILED',
    }, 500);
  }
});

// GET /billing/summary - Revenue summary
admin.get('/billing/summary', async (c) => {
  try {
    const summaryStmt = c.env.DB.prepare(`
      SELECT
        SUM(bp.monthly_price) as mrr,
        COUNT(DISTINCT bs.tenant_id) as paying_customers,
        AVG(bp.monthly_price) as arpu
      FROM billing_subscriptions bs
      JOIN billing_plans bp ON bs.plan_id = bp.id
      WHERE bs.status = 'active'
    `);
    const summary = await summaryStmt.first();

    // Calculate churn (tenants that canceled in last 30 days)
    const churnStmt = c.env.DB.prepare(`
      SELECT COUNT(*) as churned
      FROM billing_subscriptions
      WHERE status = 'canceled'
      AND updated_at >= datetime('now', '-30 days')
    `);
    const churnData = await churnStmt.first();

    const totalCustomers = summary?.paying_customers as number || 0;
    const churnRate = totalCustomers > 0
      ? ((churnData?.churned as number || 0) / totalCustomers * 100).toFixed(2)
      : '0.00';

    return c.json<ApiResponse>({
      success: true,
      data: {
        mrr: summary?.mrr || 0,
        arr: (summary?.mrr as number || 0) * 12,
        paying_customers: totalCustomers,
        arpu: summary?.arpu || 0,
        churn_rate: churnRate,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to get billing summary:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get billing summary',
      code: 'BILLING_SUMMARY_FAILED',
    }, 500);
  }
});

// GET /billing/transactions - Recent billing transactions
admin.get('/billing/transactions', async (c) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') || '50', 10), 500));
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));

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

    const transactions = await transactionsStmt.all();

    return c.json({
      success: true,
      data: transactions.results || [],
      meta: {
        limit,
        offset,
        count: transactions.results?.length || 0,
      },
    } as const);
  } catch (e) {
    console.error('Failed to get billing transactions:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get billing transactions',
      code: 'BILLING_TRANSACTIONS_FAILED',
    }, 500);
  }
});

export { admin };

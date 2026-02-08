// OpenClasw Cloud D1 Query Helpers
import type {
  Tenant,
  TenantResource,
  UsageLog,
  DailyUsage,
  BillingPlan,
  BillingSubscription,
  Incident,
  ProvisioningLog,
} from '../types/index.js';

// Tenant CRUD
export async function createTenant(
  db: D1Database,
  tenant: Omit<Tenant, 'created_at' | 'updated_at'>
): Promise<Tenant> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, contact_name, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      tenant.id,
      tenant.name,
      tenant.plan,
      tenant.status,
      tenant.subdomain,
      tenant.contact_email,
      tenant.contact_name,
      tenant.metadata,
      now,
      now
    );

  await stmt.run();

  return {
    ...tenant,
    created_at: now,
    updated_at: now,
  };
}

export async function getTenant(db: D1Database, id: string): Promise<Tenant | null> {
  const stmt = db.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(id);
  const result = await stmt.first<Tenant>();
  return result || null;
}

export async function listTenants(
  db: D1Database,
  opts?: { status?: string; limit?: number; offset?: number }
): Promise<Tenant[]> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  let query = `SELECT * FROM tenants`;
  const bindings: (string | number)[] = [];

  if (opts?.status) {
    query += ` WHERE status = ?`;
    bindings.push(opts.status);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  bindings.push(limit, offset);

  const stmt = db.prepare(query).bind(...bindings);
  const result = await stmt.all<Tenant>();
  return result.results || [];
}

export async function updateTenant(
  db: D1Database,
  id: string,
  updates: Partial<Pick<Tenant, 'name' | 'plan' | 'status' | 'subdomain' | 'contact_email' | 'metadata'>>
): Promise<Tenant | null> {
  const setClauses: string[] = [];
  const bindings: (string | null)[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    bindings.push(updates.name);
  }
  if (updates.plan !== undefined) {
    setClauses.push('plan = ?');
    bindings.push(updates.plan);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    bindings.push(updates.status);
  }
  if (updates.subdomain !== undefined) {
    setClauses.push('subdomain = ?');
    bindings.push(updates.subdomain);
  }
  if (updates.contact_email !== undefined) {
    setClauses.push('contact_email = ?');
    bindings.push(updates.contact_email);
  }
  if (updates.metadata !== undefined) {
    setClauses.push('metadata = ?');
    bindings.push(updates.metadata);
  }

  if (setClauses.length === 0) {
    return getTenant(db, id);
  }

  setClauses.push('updated_at = ?');
  bindings.push(new Date().toISOString());
  bindings.push(id);

  const query = `UPDATE tenants SET ${setClauses.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query).bind(...bindings);
  await stmt.run();

  return getTenant(db, id);
}

// Tenant Resources
export async function createTenantResource(
  db: D1Database,
  resource: Omit<TenantResource, 'created_at'>
): Promise<TenantResource> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO tenant_resources (id, tenant_id, resource_type, resource_id, config, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      resource.id,
      resource.tenant_id,
      resource.resource_type,
      resource.resource_id,
      resource.config,
      now
    );

  await stmt.run();

  return {
    ...resource,
    created_at: now,
  };
}

export async function getTenantResources(
  db: D1Database,
  tenantId: string
): Promise<TenantResource[]> {
  const stmt = db
    .prepare(`SELECT * FROM tenant_resources WHERE tenant_id = ? ORDER BY created_at ASC`)
    .bind(tenantId);
  const result = await stmt.all<TenantResource>();
  return result.results || [];
}

// Usage
export async function logUsage(db: D1Database, log: Omit<UsageLog, 'created_at'>): Promise<void> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO usage_logs (id, tenant_id, model, input_tokens, output_tokens, cost_usd, endpoint, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      log.id,
      log.tenant_id,
      log.model,
      log.input_tokens,
      log.output_tokens,
      log.cost_usd,
      log.endpoint,
      now
    );

  await stmt.run();
}

export async function getDailyUsage(
  db: D1Database,
  tenantId: string,
  date: string
): Promise<DailyUsage | null> {
  const stmt = db
    .prepare(`SELECT * FROM daily_usage WHERE tenant_id = ? AND date = ?`)
    .bind(tenantId, date);
  const result = await stmt.first<DailyUsage>();
  return result || null;
}

export async function getTenantUsageSummary(
  db: D1Database,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<DailyUsage[]> {
  const stmt = db
    .prepare(
      `SELECT * FROM daily_usage
       WHERE tenant_id = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`
    )
    .bind(tenantId, startDate, endDate);
  const result = await stmt.all<DailyUsage>();
  return result.results || [];
}

// Billing
export async function listBillingPlans(db: D1Database): Promise<BillingPlan[]> {
  const stmt = db.prepare(`SELECT * FROM billing_plans ORDER BY monthly_price ASC`);
  const result = await stmt.all<BillingPlan>();
  return result.results || [];
}

export async function getSubscription(
  db: D1Database,
  tenantId: string
): Promise<BillingSubscription | null> {
  const stmt = db
    .prepare(`SELECT * FROM billing_subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(tenantId);
  const result = await stmt.first<BillingSubscription>();
  return result || null;
}

// Provisioning
export async function createProvisioningLog(
  db: D1Database,
  log: Omit<ProvisioningLog, 'created_at'>
): Promise<ProvisioningLog> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO provisioning_logs (id, tenant_id, step, status, details, started_at, completed_at, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      log.id,
      log.tenant_id,
      log.step,
      log.status,
      log.details,
      log.started_at,
      log.completed_at,
      log.error_message,
      now
    );

  await stmt.run();

  return {
    ...log,
    created_at: now,
  };
}

export async function updateProvisioningLog(
  db: D1Database,
  id: string,
  updates: Partial<ProvisioningLog>
): Promise<void> {
  const setClauses: string[] = [];
  const bindings: (string | number | null)[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    bindings.push(updates.status);
  }
  if (updates.details !== undefined) {
    setClauses.push('details = ?');
    bindings.push(updates.details);
  }
  if (updates.started_at !== undefined) {
    setClauses.push('started_at = ?');
    bindings.push(updates.started_at);
  }
  if (updates.completed_at !== undefined) {
    setClauses.push('completed_at = ?');
    bindings.push(updates.completed_at);
  }
  if (updates.error_message !== undefined) {
    setClauses.push('error_message = ?');
    bindings.push(updates.error_message);
  }

  if (setClauses.length === 0) {
    return;
  }

  bindings.push(id);

  const query = `UPDATE provisioning_logs SET ${setClauses.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query).bind(...bindings);
  await stmt.run();
}

export async function getProvisioningLogs(
  db: D1Database,
  tenantId: string
): Promise<ProvisioningLog[]> {
  const stmt = db
    .prepare(`SELECT * FROM provisioning_logs WHERE tenant_id = ? ORDER BY created_at ASC`)
    .bind(tenantId);
  const result = await stmt.all<ProvisioningLog>();
  return result.results || [];
}

// Incidents
export async function createIncident(
  db: D1Database,
  incident: Omit<Incident, 'created_at' | 'updated_at'>
): Promise<Incident> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO incidents (id, tenant_id, severity, status, title, description, auto_recovery_attempts, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      incident.id,
      incident.tenant_id,
      incident.severity,
      incident.status,
      incident.title,
      incident.description,
      incident.auto_recovery_attempts,
      incident.resolved_at,
      now,
      now
    );

  await stmt.run();

  return {
    ...incident,
    created_at: now,
    updated_at: now,
  };
}

export async function updateIncident(
  db: D1Database,
  id: string,
  updates: Partial<Incident>
): Promise<void> {
  const setClauses: string[] = [];
  const bindings: (string | number | null)[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    bindings.push(updates.status);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    bindings.push(updates.description);
  }
  if (updates.auto_recovery_attempts !== undefined) {
    setClauses.push('auto_recovery_attempts = ?');
    bindings.push(updates.auto_recovery_attempts);
  }
  if (updates.resolved_at !== undefined) {
    setClauses.push('resolved_at = ?');
    bindings.push(updates.resolved_at);
  }

  if (setClauses.length === 0) {
    return;
  }

  setClauses.push('updated_at = ?');
  bindings.push(new Date().toISOString());
  bindings.push(id);

  const query = `UPDATE incidents SET ${setClauses.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query).bind(...bindings);
  await stmt.run();
}

export async function listIncidents(
  db: D1Database,
  opts?: { status?: string; severity?: string; tenantId?: string }
): Promise<Incident[]> {
  let query = `SELECT * FROM incidents WHERE 1=1`;
  const bindings: string[] = [];

  if (opts?.status) {
    query += ` AND status = ?`;
    bindings.push(opts.status);
  }
  if (opts?.severity) {
    query += ` AND severity = ?`;
    bindings.push(opts.severity);
  }
  if (opts?.tenantId) {
    query += ` AND tenant_id = ?`;
    bindings.push(opts.tenantId);
  }

  query += ` ORDER BY created_at DESC LIMIT 100`;

  const stmt = db.prepare(query).bind(...bindings);
  const result = await stmt.all<Incident>();
  return result.results || [];
}

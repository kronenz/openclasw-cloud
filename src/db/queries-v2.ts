// OpenClasw Cloud D1 Query Helpers - Phase 2
import type {
  OnboardingSurvey,
  TenantSegment,
  Notification,
  SoulVersion,
  CronLog,
  BillingSubscription,
} from '../types/index.js';

// Onboarding Surveys
export async function createSurvey(
  db: D1Database,
  survey: Omit<OnboardingSurvey, 'created_at'>
): Promise<OnboardingSurvey> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO onboarding_surveys (id, tenant_id, industry, business_description, preferred_tone, preferred_language, target_services, custom_instructions, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      survey.id,
      survey.tenant_id,
      survey.industry,
      survey.business_description,
      survey.preferred_tone,
      survey.preferred_language,
      survey.target_services,
      survey.custom_instructions,
      survey.completed_at,
      now
    );

  await stmt.run();

  return {
    ...survey,
    created_at: now,
  };
}

export async function getSurvey(
  db: D1Database,
  tenantId: string
): Promise<OnboardingSurvey | null> {
  const stmt = db
    .prepare(`SELECT * FROM onboarding_surveys WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(tenantId);
  const result = await stmt.first<OnboardingSurvey>();
  return result || null;
}

export async function updateSurvey(
  db: D1Database,
  id: string,
  updates: Partial<OnboardingSurvey>
): Promise<void> {
  const setClauses: string[] = [];
  const bindings: (string | null)[] = [];

  if (updates.industry !== undefined) {
    setClauses.push('industry = ?');
    bindings.push(updates.industry);
  }
  if (updates.business_description !== undefined) {
    setClauses.push('business_description = ?');
    bindings.push(updates.business_description);
  }
  if (updates.preferred_tone !== undefined) {
    setClauses.push('preferred_tone = ?');
    bindings.push(updates.preferred_tone);
  }
  if (updates.preferred_language !== undefined) {
    setClauses.push('preferred_language = ?');
    bindings.push(updates.preferred_language);
  }
  if (updates.target_services !== undefined) {
    setClauses.push('target_services = ?');
    bindings.push(updates.target_services);
  }
  if (updates.custom_instructions !== undefined) {
    setClauses.push('custom_instructions = ?');
    bindings.push(updates.custom_instructions);
  }
  if (updates.completed_at !== undefined) {
    setClauses.push('completed_at = ?');
    bindings.push(updates.completed_at);
  }

  if (setClauses.length === 0) {
    return;
  }

  bindings.push(id);

  const query = `UPDATE onboarding_surveys SET ${setClauses.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query).bind(...bindings);
  await stmt.run();
}

// Tenant Segments
export async function upsertTenantSegment(
  db: D1Database,
  segment: TenantSegment
): Promise<void> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO tenant_segments (tenant_id, segment, score, last_active_at, risk_factors, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET
         segment = excluded.segment,
         score = excluded.score,
         last_active_at = excluded.last_active_at,
         risk_factors = excluded.risk_factors,
         updated_at = excluded.updated_at`
    )
    .bind(
      segment.tenant_id,
      segment.segment,
      segment.score,
      segment.last_active_at,
      segment.risk_factors,
      now
    );

  await stmt.run();
}

export async function getTenantSegment(
  db: D1Database,
  tenantId: string
): Promise<TenantSegment | null> {
  const stmt = db
    .prepare(`SELECT * FROM tenant_segments WHERE tenant_id = ?`)
    .bind(tenantId);
  const result = await stmt.first<TenantSegment>();
  return result || null;
}

export async function listTenantsBySegment(
  db: D1Database,
  segment: string
): Promise<TenantSegment[]> {
  const stmt = db
    .prepare(`SELECT * FROM tenant_segments WHERE segment = ? ORDER BY score DESC`)
    .bind(segment);
  const result = await stmt.all<TenantSegment>();
  return result.results || [];
}

// Notifications
export async function createNotification(
  db: D1Database,
  notification: Omit<Notification, 'created_at'>
): Promise<Notification> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO notifications (id, tenant_id, channel, type, status, content, sent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      notification.id,
      notification.tenant_id,
      notification.channel,
      notification.type,
      notification.status,
      notification.content,
      notification.sent_at,
      now
    );

  await stmt.run();

  return {
    ...notification,
    created_at: now,
  };
}

export async function updateNotification(
  db: D1Database,
  id: string,
  updates: Partial<Notification>
): Promise<void> {
  const setClauses: string[] = [];
  const bindings: (string | null)[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    bindings.push(updates.status);
  }
  if (updates.content !== undefined) {
    setClauses.push('content = ?');
    bindings.push(updates.content);
  }
  if (updates.sent_at !== undefined) {
    setClauses.push('sent_at = ?');
    bindings.push(updates.sent_at);
  }

  if (setClauses.length === 0) {
    return;
  }

  bindings.push(id);

  const query = `UPDATE notifications SET ${setClauses.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query).bind(...bindings);
  await stmt.run();
}

export async function listNotifications(
  db: D1Database,
  opts?: { tenantId?: string; status?: string; type?: string; limit?: number }
): Promise<Notification[]> {
  const limit = opts?.limit ?? 50;
  let query = `SELECT * FROM notifications WHERE 1=1`;
  const bindings: (string | number)[] = [];

  if (opts?.tenantId) {
    query += ` AND tenant_id = ?`;
    bindings.push(opts.tenantId);
  }
  if (opts?.status) {
    query += ` AND status = ?`;
    bindings.push(opts.status);
  }
  if (opts?.type) {
    query += ` AND type = ?`;
    bindings.push(opts.type);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  bindings.push(limit);

  const stmt = db.prepare(query).bind(...bindings);
  const result = await stmt.all<Notification>();
  return result.results || [];
}

// Soul Versions
export async function createSoulVersion(
  db: D1Database,
  version: Omit<SoulVersion, 'created_at'>
): Promise<SoulVersion> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO soul_versions (id, tenant_id, version, content, generated_by, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      version.id,
      version.tenant_id,
      version.version,
      version.content,
      version.generated_by,
      version.is_active,
      now
    );

  await stmt.run();

  return {
    ...version,
    created_at: now,
  };
}

export async function getActiveSoul(
  db: D1Database,
  tenantId: string
): Promise<SoulVersion | null> {
  const stmt = db
    .prepare(`SELECT * FROM soul_versions WHERE tenant_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1`)
    .bind(tenantId);
  const result = await stmt.first<SoulVersion>();
  return result || null;
}

export async function listSoulVersions(
  db: D1Database,
  tenantId: string
): Promise<SoulVersion[]> {
  const stmt = db
    .prepare(`SELECT * FROM soul_versions WHERE tenant_id = ? ORDER BY version DESC`)
    .bind(tenantId);
  const result = await stmt.all<SoulVersion>();
  return result.results || [];
}

// Cron Logs
export async function createCronLog(
  db: D1Database,
  log: Omit<CronLog, 'completed_at' | 'error_message'>
): Promise<CronLog> {
  const stmt = db
    .prepare(
      `INSERT INTO cron_logs (id, job_name, status, tenants_processed, details, started_at, completed_at, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      log.id,
      log.job_name,
      log.status,
      log.tenants_processed,
      log.details,
      log.started_at,
      null,
      null
    );

  await stmt.run();

  return {
    ...log,
    completed_at: null,
    error_message: null,
  };
}

export async function updateCronLog(
  db: D1Database,
  id: string,
  updates: Partial<CronLog>
): Promise<void> {
  const setClauses: string[] = [];
  const bindings: (string | number | null)[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    bindings.push(updates.status);
  }
  if (updates.tenants_processed !== undefined) {
    setClauses.push('tenants_processed = ?');
    bindings.push(updates.tenants_processed);
  }
  if (updates.details !== undefined) {
    setClauses.push('details = ?');
    bindings.push(updates.details);
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

  const query = `UPDATE cron_logs SET ${setClauses.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query).bind(...bindings);
  await stmt.run();
}

// Billing Subscription (additional helpers)
export async function createBillingSubscription(
  db: D1Database,
  sub: Omit<BillingSubscription, 'created_at' | 'updated_at'>
): Promise<BillingSubscription> {
  const now = new Date().toISOString();
  const stmt = db
    .prepare(
      `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      sub.id,
      sub.tenant_id,
      sub.plan_id,
      sub.status,
      sub.current_period_start,
      sub.current_period_end,
      sub.payment_method,
      now,
      now
    );

  await stmt.run();

  return {
    ...sub,
    created_at: now,
    updated_at: now,
  };
}

export async function updateBillingSubscription(
  db: D1Database,
  id: string,
  updates: Partial<BillingSubscription>
): Promise<void> {
  const setClauses: string[] = [];
  const bindings: (string | null)[] = [];

  if (updates.plan_id !== undefined) {
    setClauses.push('plan_id = ?');
    bindings.push(updates.plan_id);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    bindings.push(updates.status);
  }
  if (updates.current_period_start !== undefined) {
    setClauses.push('current_period_start = ?');
    bindings.push(updates.current_period_start);
  }
  if (updates.current_period_end !== undefined) {
    setClauses.push('current_period_end = ?');
    bindings.push(updates.current_period_end);
  }
  if (updates.payment_method !== undefined) {
    setClauses.push('payment_method = ?');
    bindings.push(updates.payment_method);
  }

  if (setClauses.length === 0) {
    return;
  }

  setClauses.push('updated_at = ?');
  bindings.push(new Date().toISOString());
  bindings.push(id);

  const query = `UPDATE billing_subscriptions SET ${setClauses.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query).bind(...bindings);
  await stmt.run();
}

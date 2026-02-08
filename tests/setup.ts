import { env } from 'cloudflare:test';

// Seed the test database with schema
export async function setupTestDb() {
  const schema = `
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'starter',
      status TEXT NOT NULL DEFAULT 'provisioning',
      subdomain TEXT UNIQUE,
      contact_email TEXT,
      contact_name TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tenant_resources (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      config TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0.0,
      endpoint TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_usage (
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      date TEXT NOT NULL,
      total_requests INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0.0,
      model_breakdown TEXT,
      PRIMARY KEY (tenant_id, date)
    );

    CREATE TABLE IF NOT EXISTS billing_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      monthly_price INTEGER NOT NULL,
      daily_token_limit INTEGER NOT NULL,
      monthly_token_limit INTEGER NOT NULL,
      models_allowed TEXT NOT NULL,
      features TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      plan_id TEXT NOT NULL REFERENCES billing_plans(id),
      status TEXT NOT NULL DEFAULT 'active',
      current_period_start TEXT NOT NULL,
      current_period_end TEXT NOT NULL,
      payment_method TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT REFERENCES tenants(id),
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      title TEXT NOT NULL,
      description TEXT,
      auto_recovery_attempts INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS provisioning_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      step TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      details TEXT,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO billing_plans (id, name, display_name, monthly_price, daily_token_limit, monthly_token_limit, models_allowed, features) VALUES
      ('plan_starter', 'starter', 'Starter', 49000, 100000, 2000000, '["haiku","flash"]', '{"support":"email","sla":"best-effort"}'),
      ('plan_growth', 'growth', 'Growth', 149000, 500000, 10000000, '["haiku","sonnet","flash"]', '{"support":"priority-email","sla":"8h-response","custom_skills":true}'),
      ('plan_enterprise', 'enterprise', 'Enterprise', 490000, 2000000, 50000000, '["haiku","sonnet","opus","flash"]', '{"support":"dedicated-slack","sla":"1h-response","custom_skills":true,"dedicated_resources":true}');
  `;

  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => env.DB.prepare(s));

  await env.DB.batch(statements);
}

// Create a test tenant
export async function createTestTenant(overrides?: Partial<{
  id: string;
  name: string;
  plan: string;
  status: string;
  subdomain: string;
  contact_email: string;
}>) {
  const tenant = {
    id: overrides?.id || 'tn_test-tenant-1',
    name: overrides?.name || 'Test Corp',
    plan: overrides?.plan || 'starter',
    status: overrides?.status || 'active',
    subdomain: overrides?.subdomain || 'test-corp',
    contact_email: overrides?.contact_email || 'test@example.com',
  };

  await env.DB.prepare(
    `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(tenant.id, tenant.name, tenant.plan, tenant.status, tenant.subdomain, tenant.contact_email).run();

  return tenant;
}

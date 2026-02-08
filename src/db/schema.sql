-- OpenClasw Cloud D1 Schema
-- Enable WAL mode and foreign keys
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- tenants (고객사)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter',  -- starter, growth, enterprise
  status TEXT NOT NULL DEFAULT 'provisioning',  -- provisioning, active, suspended, deleted
  subdomain TEXT UNIQUE,
  contact_email TEXT,
  contact_name TEXT,
  metadata TEXT,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);

-- tenant_resources (CF 리소스 ID 매핑)
CREATE TABLE IF NOT EXISTS tenant_resources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  resource_type TEXT NOT NULL,  -- worker, d1, kv, r2
  resource_id TEXT NOT NULL,
  config TEXT,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_resources_tenant_id ON tenant_resources(tenant_id);

-- usage_logs (사용량 추적)
CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  model TEXT NOT NULL,  -- opus, sonnet, haiku, flash
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0.0,
  endpoint TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_id_created_at ON usage_logs(tenant_id, created_at);

-- daily_usage (일일 사용량 집계)
CREATE TABLE IF NOT EXISTS daily_usage (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  date TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0.0,
  model_breakdown TEXT,  -- JSON: { "opus": { tokens: N, cost: N }, ... }
  PRIMARY KEY (tenant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage(date);

-- billing_plans (요금제)
CREATE TABLE IF NOT EXISTS billing_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  monthly_price INTEGER NOT NULL,  -- KRW
  daily_token_limit INTEGER NOT NULL,
  monthly_token_limit INTEGER NOT NULL,
  models_allowed TEXT NOT NULL,  -- JSON array
  features TEXT,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- billing_subscriptions (구독)
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  plan_id TEXT NOT NULL REFERENCES billing_plans(id),
  status TEXT NOT NULL DEFAULT 'active',  -- active, past_due, canceled, trialing
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  payment_method TEXT,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_tenant_id ON billing_subscriptions(tenant_id);

-- incidents (인시던트)
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id),  -- NULL for global incidents
  severity TEXT NOT NULL,  -- P0, P1, P2, P3
  status TEXT NOT NULL DEFAULT 'open',  -- open, investigating, mitigated, resolved
  title TEXT NOT NULL,
  description TEXT,
  auto_recovery_attempts INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

-- provisioning_logs (프로비저닝 로그)
CREATE TABLE IF NOT EXISTS provisioning_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  step TEXT NOT NULL,  -- plan, create_resources, init_openclaw, setup_auth, verify, notify
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, rolled_back
  details TEXT,  -- JSON
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provisioning_logs_tenant_id ON provisioning_logs(tenant_id);

-- Seed data for billing_plans
INSERT OR IGNORE INTO billing_plans (id, name, display_name, monthly_price, daily_token_limit, monthly_token_limit, models_allowed, features) VALUES
  ('plan_starter', 'starter', 'Starter', 49000, 100000, 2000000, '["haiku","flash"]', '{"support":"email","sla":"best-effort"}'),
  ('plan_growth', 'growth', 'Growth', 149000, 500000, 10000000, '["haiku","sonnet","flash"]', '{"support":"priority-email","sla":"8h-response","custom_skills":true}'),
  ('plan_enterprise', 'enterprise', 'Enterprise', 490000, 2000000, 50000000, '["haiku","sonnet","opus","flash"]', '{"support":"dedicated-slack","sla":"1h-response","custom_skills":true,"dedicated_resources":true}');

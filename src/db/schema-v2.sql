-- Phase 2 Schema Extension
PRAGMA foreign_keys=ON;

-- 고객 설문 (SOUL.md 자동생성용)
CREATE TABLE IF NOT EXISTS onboarding_surveys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  industry TEXT NOT NULL,
  business_description TEXT,
  preferred_tone TEXT DEFAULT 'polite',
  preferred_language TEXT DEFAULT 'ko',
  target_services TEXT,
  custom_instructions TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_onboarding_surveys_tenant_id ON onboarding_surveys(tenant_id);

-- 고객 세그먼트 (Customer Success)
CREATE TABLE IF NOT EXISTS tenant_segments (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  segment TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  last_active_at TEXT,
  risk_factors TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 알림 로그
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  channel TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  content TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- SOUL.md 버전 관리
CREATE TABLE IF NOT EXISTS soul_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  generated_by TEXT DEFAULT 'template',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_soul_versions_tenant_id ON soul_versions(tenant_id);

-- Cron Job 실행 로그
CREATE TABLE IF NOT EXISTS cron_logs (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  tenants_processed INTEGER DEFAULT 0,
  details TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_job_name ON cron_logs(job_name);

-- Additional indexes for query performance
CREATE INDEX IF NOT EXISTS idx_cron_logs_status ON cron_logs(status);
CREATE INDEX IF NOT EXISTS idx_soul_versions_tenant_active ON soul_versions(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_tenant_segments_segment ON tenant_segments(segment);

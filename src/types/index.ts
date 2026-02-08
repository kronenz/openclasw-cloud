// Cloudflare AI model identifier type
export type AiModelId = Parameters<Ai['run']>[0];

// Cloudflare bindings
export interface Bindings {
  DB: D1Database;
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  AI: Ai;
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  AI_GATEWAY_ENDPOINT: string;
  JWT_SECRET: string;
  SLACK_WEBHOOK_URL?: string;
  PORTONE_WEBHOOK_SECRET?: string;
  PORTONE_API_KEY?: string;
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  RESEND_API_KEY?: string;
}

// Cloudflare AI text generation response
export interface AiTextResponse {
  response: string;
}

// Hono app context variables
export interface Variables {
  tenantId?: string;
  jwtPayload?: Record<string, unknown>;
  requestId?: string;
}

// Tenant
export interface Tenant {
  id: string;
  name: string;
  plan: 'starter' | 'growth' | 'enterprise';
  status: 'provisioning' | 'active' | 'suspended' | 'deleted';
  subdomain: string | null;
  contact_email: string | null;
  contact_name: string | null;
  metadata: string | null;  // JSON string
  created_at: string;
  updated_at: string;
}

export interface CreateTenantInput {
  name: string;
  plan: 'starter' | 'growth' | 'enterprise';
  subdomain?: string;
  contact_email: string;
  contact_name?: string;
  industry?: 'cafe' | 'office' | 'shopping' | 'general';
  metadata?: Record<string, unknown>;
}

// Tenant Resources
export interface TenantResource {
  id: string;
  tenant_id: string;
  resource_type: 'worker' | 'd1' | 'kv' | 'r2';
  resource_id: string;
  config: string | null;
  created_at: string;
}

// Usage
export interface UsageLog {
  id: string;
  tenant_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  endpoint: string | null;
  created_at: string;
}

export interface DailyUsage {
  tenant_id: string;
  date: string;
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  model_breakdown: string | null;
}

// Parsed model_breakdown JSON structure
export type ModelBreakdownData = Record<string, { tokens?: number; cost?: number; requests?: number }>;

// Billing
export interface BillingPlan {
  id: string;
  name: string;
  display_name: string;
  monthly_price: number;
  daily_token_limit: number;
  monthly_token_limit: number;
  models_allowed: string;
  features: string | null;
  created_at: string;
}

export interface BillingSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
}

// Incidents
export interface Incident {
  id: string;
  tenant_id: string | null;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  title: string;
  description: string | null;
  auto_recovery_attempts: number;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Provisioning
export interface ProvisioningLog {
  id: string;
  tenant_id: string;
  step: 'plan' | 'create_resources' | 'init_openclaw' | 'setup_auth' | 'verify' | 'notify';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  details: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ProvisioningPlan {
  tenantId: string;
  subdomain: string;
  plan: 'starter' | 'growth' | 'enterprise';
  industry: string;
  resources: {
    worker: boolean;
    d1: boolean;
    kv: boolean;
    r2: boolean;
  };
}

// Health
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks?: Record<string, { status: string; latency_ms?: number; error?: string }>;
}

export interface TenantHealth {
  tenant_id: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_checked: string;
  details: Record<string, unknown>;
}

// Cost control
export interface ModelRecommendation {
  current_model: string;
  recommended_model: string;
  reason: string;
  usage_percent: number;
}

export interface Alert {
  type: 'cost_limit' | 'anomaly' | 'health' | 'incident';
  severity: 'info' | 'warning' | 'critical';
  tenant_id?: string;
  message: string;
  data?: Record<string, unknown>;
}

// API responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedApiResponse<T = unknown> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    offset: number;
    count: number;
  };
}

// Phase 2 Types

// Onboarding Survey
export interface OnboardingSurvey {
  id: string;
  tenant_id: string;
  industry: string;
  business_description: string | null;
  preferred_tone: string;
  preferred_language: string;
  target_services: string | null; // JSON array
  custom_instructions: string | null;
  completed_at: string | null;
  created_at: string;
}

// Tenant Segment
export interface TenantSegment {
  tenant_id: string;
  segment: 'champion' | 'at_risk' | 'potential_upsell' | 'need_attention' | 'happy_inactive' | 'new';
  score: number;
  last_active_at: string | null;
  risk_factors: string | null; // JSON
  updated_at: string;
}

// Notification
export interface Notification {
  id: string;
  tenant_id: string;
  channel: 'email' | 'slack' | 'telegram' | 'sms';
  type: 'welcome' | 'payment_failed' | 're_engagement' | 'upsell' | 'report' | 'cancellation' | 'downgrade';
  status: 'pending' | 'sent' | 'failed' | 'opened';
  content: string | null; // JSON: { subject, body }
  sent_at: string | null;
  created_at: string;
}

// Soul Version
export interface SoulVersion {
  id: string;
  tenant_id: string;
  version: number;
  content: string;
  generated_by: 'template' | 'survey' | 'manual';
  is_active: number; // 0 or 1 (SQLite boolean)
  created_at: string;
}

// Cron Log
export interface CronLog {
  id: string;
  job_name: string;
  status: 'running' | 'completed' | 'failed';
  tenants_processed: number;
  details: string | null; // JSON
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}


import type { AiModelId } from '../types/index.js';

// App version
export const APP_VERSION = '0.1.0';

// AI model
export const DEFAULT_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct' as AiModelId;

// Rate limiting
export const RATE_LIMIT_MAX_REQUESTS = 100;
export const RATE_LIMIT_WINDOW_MS = 60_000;

// Cron job timeout (milliseconds)
export const CRON_JOB_TIMEOUT_MS = 300_000; // 5 minutes

// Time constants
export const MS_PER_DAY = 86_400_000;

// Subscription
export const GRACE_PERIOD_DAYS = 7;
export const MAX_RECOVERY_ATTEMPTS = 3;

// Token limits (defaults)
export const DEFAULT_DAILY_TOKEN_LIMIT = 100_000;
export const DEFAULT_MONTHLY_TOKEN_LIMIT = 3_000_000;

// Backup
export const BACKUP_RETENTION_DAYS = 30;

// Input limits
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_METADATA_SIZE_BYTES = 10240;
export const MAX_SOUL_CONTENT_LENGTH = 50000;

// Reserved subdomains that cannot be used by tenants
export const RESERVED_SUBDOMAINS = new Set([
  'admin', 'api', 'app', 'www', 'mail', 'smtp', 'ftp',
  'dashboard', 'static', 'cdn', 'assets', 'media',
  'auth', 'login', 'signup', 'register',
  'billing', 'payment', 'payments',
  'support', 'help', 'docs', 'documentation',
  'status', 'health', 'monitor', 'monitoring',
  'internal', 'system', 'root', 'operator',
  'test', 'staging', 'dev', 'development', 'production',
  'openclaw', 'openclasw',
]);

// AI model settings
export const AI_MAX_TOKENS_DEFAULT = 1000;
export const AI_MAX_TOKENS_SOUL = 2000;
export const DEFAULT_AI_SYSTEM_PROMPT = '당신은 친절한 AI 비서입니다. 한국어로 응답하세요.';

// R2 storage path helpers
export function soulR2Key(tenantId: string): string {
  return `tenants/${tenantId}/SOUL.md`;
}

// Cache TTL (seconds)
export const CACHE_TTL_SOUL_MD = 3600;  // 1 hour
export const CACHE_TTL_HEALTH_STATUS = 300;  // 5 minutes

// JWT defaults (seconds)
export const JWT_DEFAULT_EXPIRY_SECONDS = 3600;  // 1 hour
export const API_KEY_EXPIRY_SECONDS = 86_400 * 365;  // 1 year

// HSTS max-age (seconds)
export const HSTS_MAX_AGE_SECONDS = 31536000;  // 1 year

// Input length limits
export const MAX_BUSINESS_DESCRIPTION_LENGTH = 2000;
export const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 5000;

// External API timeouts (milliseconds)
export const API_TIMEOUT_STANDARD = 15_000;  // Most external APIs
export const API_TIMEOUT_LONG = 30_000;      // Infrastructure APIs (Cloudflare)

// Customer analytics thresholds
export const INDUSTRY_BENCHMARKS: Record<string, { avg_tokens: number; avg_cost: number }> = {
  cafe: { avg_tokens: 50_000, avg_cost: 2.5 },
  office: { avg_tokens: 80_000, avg_cost: 4.0 },
  shopping: { avg_tokens: 60_000, avg_cost: 3.0 },
  general: { avg_tokens: 45_000, avg_cost: 2.0 },
};

// Domain & URL Configuration
export const OPENCLAW_DOMAIN = 'openclaw.ai';
export const DOCS_BASE_URL = 'https://docs.openclaw.ai';
export const SLACK_API_BASE = 'https://slack.com/api';

// External API base URLs
export const RESEND_API_URL = 'https://api.resend.com/emails';
export const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
export const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';
export const PORTONE_API_BASE = 'https://api.portone.io/v2';

// Enum constants for Zod schemas
export const TENANT_PLANS = ['starter', 'growth', 'enterprise'] as const;
export const TENANT_STATUSES = ['provisioning', 'active', 'suspended', 'deleted'] as const;
export const BILLING_PLAN_IDS = ['plan_starter', 'plan_growth', 'plan_enterprise'] as const;
export const INCIDENT_STATUSES = ['open', 'investigating', 'resolved', 'closed'] as const;
export const TENANT_SEGMENTS = ['champion', 'at_risk', 'potential_upsell', 'need_attention', 'happy_inactive', 'new'] as const;
export const ADMIN_TENANT_STATUSES = ['active', 'provisioning', 'suspended', 'deactivated'] as const;

// Analytics & Engagement Thresholds
export const USAGE_HIGH_THRESHOLD_PERCENT = 80;       // Trigger upsell/downgrade recommendation
export const USAGE_LOW_THRESHOLD_PERCENT = 30;        // Underutilization warning
export const USAGE_DROP_THRESHOLD = 0.5;              // 50% drop = at-risk
export const TREND_INCREASE_MULTIPLIER = 1.2;         // 20% increase = trending up
export const TREND_DECREASE_MULTIPLIER = 0.8;         // 20% decrease = trending down

// List/Pagination Limits
export const LIST_TENANTS_LIMIT = 1000;

// Token Thresholds
export const MIN_ACTIVE_TOKENS = 1000;                // Minimum tokens to consider tenant "active"

// Error Codes
export const ERROR_CODES = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  // Resources
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SURVEY_NOT_FOUND: 'SURVEY_NOT_FOUND',
  SOUL_NOT_FOUND: 'SOUL_NOT_FOUND',
  NOT_FOUND: 'NOT_FOUND',
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_TENANT_ID: 'MISSING_TENANT_ID',
  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // Billing
  TENANT_INACTIVE: 'TENANT_INACTIVE',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

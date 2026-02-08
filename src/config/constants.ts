// Rate limiting
export const RATE_LIMIT_MAX_REQUESTS = 100;
export const RATE_LIMIT_WINDOW_MS = 60_000;

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

// Cache TTL (seconds)
export const CACHE_TTL_SOUL_MD = 3600;  // 1 hour

// JWT defaults (seconds)
export const JWT_DEFAULT_EXPIRY_SECONDS = 3600;  // 1 hour

// HSTS max-age (seconds)
export const HSTS_MAX_AGE_SECONDS = 31536000;  // 1 year

// Input length limits
export const MAX_BUSINESS_DESCRIPTION_LENGTH = 2000;
export const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 5000;

// External API limits
export const R2_LIST_LIMIT = 1000;
export const DB_QUERY_LIMIT = 1000;

// Customer analytics thresholds
export const LOW_USAGE_THRESHOLD = 1000;
export const INDUSTRY_BENCHMARKS: Record<string, number> = {
  cafe: 50_000,
  office: 80_000,
  shopping: 60_000,
  default: 45_000,
};

// External API base URLs
export const RESEND_API_URL = 'https://api.resend.com/emails';
export const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
export const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';
export const PORTONE_API_BASE = 'https://api.portone.io/v2';

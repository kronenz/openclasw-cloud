// Rate limiting
export const RATE_LIMIT_MAX_REQUESTS = 100;
export const RATE_LIMIT_WINDOW_MS = 60_000;

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

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './types/index.js';
import { health } from './routes/health.js';
import { tenants } from './routes/tenants.js';
import { billing } from './routes/billing.js';
import { webhooks } from './routes/webhooks.js';
import { onboarding } from './routes/onboarding.js';
import { admin } from './routes/admin.js';
import { authMiddleware } from './middleware/auth.js';
import { adminAuth } from './middleware/admin-auth.js';
import { loggerMiddleware } from './middleware/logger.js';
import { securityMiddleware } from './middleware/security.js';
import { rateLimiterMiddleware } from './middleware/rate-limiter.js';
import { envValidatorMiddleware } from './middleware/env-validator.js';
import { HealthChecker } from './services/health-checker.js';
import { CostController } from './services/cost-controller.js';
import { BackupService } from './services/backup.js';
import { CustomerEngagement } from './services/customer-engagement.js';
import { CustomerAnalytics } from './services/customer-analytics.js';
import { ReportGenerator } from './services/report-generator.js';
import { createCronLog, updateCronLog } from './db/queries-v2.js';
import { structuredError, structuredWarn, formatErrorMessage } from './utils/log.js';
import { CRON_JOB_TIMEOUT_MS, OPENCLAW_DOMAIN } from './config/constants.js';
import { nowISO } from './utils/id.js';

const app = new Hono<{ Bindings: Bindings }>();

// Global middleware
app.use('*', envValidatorMiddleware);
app.use('*', cors({
  origin: (origin) => {
    // Allow requests with no origin (non-browser, like curl/Postman)
    if (!origin) return origin;
    // In development, allow localhost
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;
    // Allow openclaw.ai subdomains
    if (origin.endsWith(`.${OPENCLAW_DOMAIN}`) || origin === `https://${OPENCLAW_DOMAIN}`) return origin;
    // Deny all other origins
    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Platform-Type'],
}));
app.use('*', securityMiddleware);
app.use('*', loggerMiddleware);
app.use('/api/*', authMiddleware);
app.use('/api/*', rateLimiterMiddleware);

// Admin routes (with admin auth)
app.use('/api/admin/*', adminAuth);

// Routes
app.route('/health', health);
app.route('/api/tenants', tenants);
app.route('/api/billing', billing);
app.route('/api/webhooks', webhooks);
app.route('/api/tenants', onboarding);
app.route('/api/admin', admin);

// Global error handler
app.onError((err, c) => {
  structuredError('unhandled_error', err, {
    path: c.req.path,
  });

  return c.json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not found',
    code: 'NOT_FOUND',
  }, 404);
});

// Export app for testing
export { app };

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    const cron = event.cron;

    async function runCronJob(jobName: string, fn: () => Promise<unknown>): Promise<void> {
      const logId = crypto.randomUUID();
      try {
        await createCronLog(env.DB, {
          id: logId,
          job_name: jobName,
          status: 'running',
          tenants_processed: 0,
          details: null,
          started_at: nowISO(),
        });
      } catch (logError) {
        structuredWarn('cron_log_write_failed', { jobName, error: logError });
      }

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Cron job '${jobName}' timed out after ${CRON_JOB_TIMEOUT_MS}ms`)), CRON_JOB_TIMEOUT_MS)
        );
        await Promise.race([fn(), timeoutPromise]);
        try {
          await updateCronLog(env.DB, logId, {
            status: 'completed',
            completed_at: nowISO(),
          });
        } catch (logError) {
          structuredWarn('cron_log_write_failed', { jobName, error: logError });
        }
      } catch (error) {
        structuredError('cron_job_failed', error, { jobName });
        try {
          await updateCronLog(env.DB, logId, {
            status: 'failed',
            completed_at: nowISO(),
            error_message: formatErrorMessage(error),
          });
        } catch (logError) {
          structuredWarn('cron_log_write_failed', { jobName, error: logError });
        }
      }
    }

    switch (cron) {
      case '*/5 * * * *': {
        const checker = new HealthChecker(env);
        ctx.waitUntil(runCronJob('health_check', () => checker.checkAllTenants()));
        break;
      }
      case '0 * * * *': {
        const controller = new CostController(env);
        ctx.waitUntil(runCronJob('usage_aggregation', () => controller.aggregateDailyUsage()));
        break;
      }
      case '0 0 * * *': {
        const backup = new BackupService(env);
        const engagement = new CustomerEngagement(env);
        ctx.waitUntil(runCronJob('daily_backup', () => backup.backupAllTenants()));
        ctx.waitUntil(runCronJob('engagement_check', () => engagement.checkAndEngageAll()));
        break;
      }
      case '0 0 * * 1': {
        const analytics = new CustomerAnalytics(env);
        const reports = new ReportGenerator(env);
        ctx.waitUntil(runCronJob('weekly_segmentation', () => analytics.segmentTenants()));
        ctx.waitUntil(runCronJob('weekly_reports', () => reports.sendWeeklyReports()));
        break;
      }
      case '0 0 1 * *': {
        const reports = new ReportGenerator(env);
        ctx.waitUntil(runCronJob('monthly_reports', () => reports.sendMonthlyReports()));
        break;
      }
      default:
        structuredWarn('unknown_cron_trigger', { cron });
    }
  },
};

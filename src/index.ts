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
import { HealthChecker } from './services/health-checker.js';
import { CostController } from './services/cost-controller.js';
import { BackupService } from './services/backup.js';
import { CustomerEngagement } from './services/customer-engagement.js';
import { CustomerAnalytics } from './services/customer-analytics.js';
import { ReportGenerator } from './services/report-generator.js';
import { createCronLog, updateCronLog } from './db/queries-v2.js';

const app = new Hono<{ Bindings: Bindings }>();

// Global middleware
app.use('*', cors());
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
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    path: c.req.path,
  }));

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
          started_at: new Date().toISOString(),
        });
      } catch {
        // If logging fails, still run the job
      }

      try {
        await fn();
        try {
          await updateCronLog(env.DB, logId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
          });
        } catch {
          // Logging failure is not critical
        }
      } catch (error) {
        console.error(`Cron job ${jobName} failed:`, error);
        try {
          await updateCronLog(env.DB, logId, {
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : String(error),
          });
        } catch {
          // Logging failure is not critical
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
    }
  },
};

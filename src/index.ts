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

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    const cron = event.cron;

    switch (cron) {
      case '*/5 * * * *': {
        // Health check every 5 minutes
        const checker = new HealthChecker(env);
        ctx.waitUntil(checker.checkAllTenants());
        break;
      }
      case '0 * * * *': {
        // Hourly: usage aggregation
        const controller = new CostController(env);
        ctx.waitUntil(controller.aggregateDailyUsage());
        break;
      }
      case '0 0 * * *': {
        // Daily: backup + engagement check
        const backup = new BackupService(env);
        ctx.waitUntil(backup.backupAllTenants());
        const engagement = new CustomerEngagement(env);
        ctx.waitUntil(engagement.checkAndEngageAll());
        break;
      }
      case '0 0 * * 1': {
        // Weekly Monday: analytics + weekly reports
        const analytics = new CustomerAnalytics(env);
        ctx.waitUntil(analytics.segmentTenants());
        const reports = new ReportGenerator(env);
        ctx.waitUntil(reports.sendWeeklyReports());
        break;
      }
      case '0 0 1 * *': {
        // Monthly 1st: monthly reports
        const reports = new ReportGenerator(env);
        ctx.waitUntil(reports.sendMonthlyReports());
        break;
      }
    }
  },
};

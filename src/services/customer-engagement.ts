import type { Bindings, Tenant } from '../types/index.js';
import { listTenants, getSubscription, getTenantUsageSummary, listBillingPlans } from '../db/queries.js';
import { createNotification } from '../db/queries-v2.js';
import { EmailSender } from './email-sender.js';
import { HealthChecker } from './health-checker.js';
import { toDateString } from '../utils/id.js';
import { structuredLog, structuredError } from '../utils/log.js';
import { MS_PER_DAY } from '../config/constants.js';

interface EngagementResult {
  tenant_id: string;
  tenant_name: string;
  actions_taken: string[];
  status: 'success' | 'failed' | 'skipped';
}

interface EngagementSummary {
  total_tenants: number;
  re_engagement_sent: number;
  upsell_notifications: number;
  at_risk_alerts: number;
  results: EngagementResult[];
}

export class CustomerEngagement {
  private emailSender: EmailSender;
  private healthChecker: HealthChecker;

  constructor(private env: Bindings) {
    this.emailSender = new EmailSender(env);
    this.healthChecker = new HealthChecker(env);
  }

  // Main entry point for cron job - check and engage all tenants
  async checkAndEngageAll(): Promise<EngagementSummary> {
    const tenants = await listTenants(this.env.DB, { status: 'active' });
    const results: EngagementResult[] = [];

    let reEngagementCount = 0;
    let upsellCount = 0;
    let atRiskCount = 0;

    for (const tenant of tenants) {
      const actions: string[] = [];
      let status: 'success' | 'failed' | 'skipped' = 'skipped';

      try {
        // Check 1: Re-engagement (7-day inactivity)
        const reEngaged = await this.checkReEngagement(tenant);
        if (reEngaged) {
          actions.push('re_engagement_email');
          reEngagementCount++;
          status = 'success';
        }

        // Check 2: Upsell opportunity (80% usage)
        const upsell = await this.checkUpsellOpportunity(tenant);
        if (upsell) {
          actions.push('upsell_notification');
          upsellCount++;
          status = 'success';
        }

        // Check 3: Usage drop (50% decrease)
        const atRisk = await this.checkUsageDrop(tenant);
        if (atRisk) {
          actions.push('at_risk_alert');
          atRiskCount++;
          status = 'success';
        }

        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          actions_taken: actions,
          status,
        });
      } catch (error) {
        structuredError('engagement_check_failed', error, { tenantId: tenant.id });
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          actions_taken: actions,
          status: 'failed',
        });
      }
    }

    structuredLog('customer_engagement_completed', {
      total: tenants.length,
      re_engagement: reEngagementCount,
      upsell: upsellCount,
      at_risk: atRiskCount,
    });

    return {
      total_tenants: tenants.length,
      re_engagement_sent: reEngagementCount,
      upsell_notifications: upsellCount,
      at_risk_alerts: atRiskCount,
      results,
    };
  }

  // Check if tenant has been inactive for 7 days and send re-engagement email
  async checkReEngagement(tenant: Tenant): Promise<boolean> {
    const endDate = toDateString();
    const startDate = toDateString(new Date(Date.now() - 7 * MS_PER_DAY));

    const usage = await getTenantUsageSummary(this.env.DB, tenant.id, startDate, endDate);
    const hasRecentActivity = usage.some(day => day.total_requests > 0);

    if (!hasRecentActivity && tenant.contact_email) {
      // Check if we already sent a re-engagement email in the last 7 days
      const recentNotifications = await this.env.DB.prepare(`
        SELECT COUNT(*) as count FROM notifications
        WHERE tenant_id = ? AND type = 're_engagement' AND created_at > datetime('now', '-7 days')
      `).bind(tenant.id).first<{ count: number }>();

      if (recentNotifications && recentNotifications.count > 0) {
        return false; // Already sent recently
      }

      // Send re-engagement email
      const sent = await this.emailSender.sendReEngagementEmail({
        contactEmail: tenant.contact_email,
        contactName: tenant.contact_name || 'Customer',
        tenantName: tenant.name,
        inactiveDays: 7,
      });

      if (sent) {
        await createNotification(this.env.DB, {
          id: crypto.randomUUID(),
          tenant_id: tenant.id,
          channel: 'email',
          type: 're_engagement',
          status: 'sent',
          content: JSON.stringify({
            subject: `${tenant.name} AI 비서가 기다리고 있어요`,
            inactive_days: 7,
          }),
          sent_at: new Date().toISOString(),
        });

        structuredLog('re_engagement_email_sent', {
          tenant_id: tenant.id,
          tenant_name: tenant.name,
        });

        return true;
      }
    }

    return false;
  }

  // Check if tenant is approaching plan limits and create upsell notification
  async checkUpsellOpportunity(tenant: Tenant): Promise<boolean> {
    const subscription = await getSubscription(this.env.DB, tenant.id);
    if (!subscription) return false;

    const plans = await listBillingPlans(this.env.DB);
    const currentPlan = plans.find(p => p.id === subscription.plan_id);
    if (!currentPlan) return false;

    // Check last 7 days usage
    const endDate = toDateString();
    const startDate = toDateString(new Date(Date.now() - 7 * MS_PER_DAY));
    const usage = await getTenantUsageSummary(this.env.DB, tenant.id, startDate, endDate);

    const avgDailyTokens = usage.length > 0
      ? usage.reduce((sum, day) => sum + day.total_tokens, 0) / usage.length
      : 0;

    const usagePercent = (avgDailyTokens / currentPlan.daily_token_limit) * 100;

    if (usagePercent > 80) {
      // Check if already notified recently
      const recentNotifications = await this.env.DB.prepare(`
        SELECT COUNT(*) as count FROM notifications
        WHERE tenant_id = ? AND type = 'upsell' AND created_at > datetime('now', '-14 days')
      `).bind(tenant.id).first<{ count: number }>();

      if (recentNotifications && recentNotifications.count > 0) {
        return false; // Already notified
      }

      // Find next plan
      const nextPlan = plans.find(p =>
        p.monthly_price > currentPlan.monthly_price &&
        p.daily_token_limit > currentPlan.daily_token_limit
      );

      if (nextPlan) {
        await createNotification(this.env.DB, {
          id: crypto.randomUUID(),
          tenant_id: tenant.id,
          channel: 'email',
          type: 'upsell',
          status: 'pending',
          content: JSON.stringify({
            current_plan: currentPlan.display_name,
            next_plan: nextPlan.display_name,
            usage_percent: Math.round(usagePercent),
            avg_daily_tokens: Math.round(avgDailyTokens),
            daily_limit: currentPlan.daily_token_limit,
          }),
          sent_at: null,
        });

        structuredLog('upsell_opportunity_detected', {
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          usage_percent: usagePercent,
          current_plan: currentPlan.name,
          next_plan: nextPlan.name,
        });

        return true;
      }
    }

    return false;
  }

  // Detect 50% usage drop and send at-risk alert to operator
  async checkUsageDrop(tenant: Tenant): Promise<boolean> {
    const endDate = toDateString();
    const startDate = toDateString(new Date(Date.now() - 14 * MS_PER_DAY));
    const usage = await getTenantUsageSummary(this.env.DB, tenant.id, startDate, endDate);

    if (usage.length < 14) return false;

    // Compare this week (last 7 days) to previous week (8-14 days ago)
    const thisWeek = usage.slice(-7).reduce((sum, day) => sum + day.total_tokens, 0);
    const prevWeek = usage.slice(-14, -7).reduce((sum, day) => sum + day.total_tokens, 0);

    if (prevWeek > 0 && thisWeek < prevWeek * 0.5) {
      const dropPercent = ((prevWeek - thisWeek) / prevWeek) * 100;

      // Send alert to operator
      await this.healthChecker.sendAlert({
        type: 'health',
        severity: 'warning',
        tenant_id: tenant.id,
        message: `${tenant.name} 사용량 급감 감지: ${dropPercent.toFixed(0)}% 감소 (${prevWeek.toLocaleString()} → ${thisWeek.toLocaleString()} 토큰)`,
        data: {
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          prev_week_tokens: prevWeek,
          this_week_tokens: thisWeek,
          drop_percent: dropPercent,
        },
      });

      // Create notification record
      await createNotification(this.env.DB, {
        id: crypto.randomUUID(),
        tenant_id: tenant.id,
        channel: 'slack',
        type: 're_engagement',
        status: 'sent',
        content: JSON.stringify({
          type: 'usage_drop',
          drop_percent: dropPercent,
          prev_week_tokens: prevWeek,
          this_week_tokens: thisWeek,
        }),
        sent_at: new Date().toISOString(),
      });

      structuredLog('usage_drop_detected', {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        drop_percent: dropPercent,
      });

      return true;
    }

    return false;
  }
}

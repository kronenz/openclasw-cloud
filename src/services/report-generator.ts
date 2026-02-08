import type { Bindings, DailyUsage } from '../types/index.js';
import { listTenants, getSubscription, getTenantUsageSummary, listBillingPlans } from '../db/queries.js';
import { createNotification, createCronLog, updateCronLog, listTenantsBySegment } from '../db/queries-v2.js';
import { safeJsonParse } from '../utils/json.js';
import { structuredLog, structuredError, formatErrorMessage } from '../utils/log.js';
import { toDateString } from '../utils/id.js';
import { MS_PER_DAY, USAGE_HIGH_THRESHOLD_PERCENT, USAGE_LOW_THRESHOLD_PERCENT } from '../config/constants.js';
import { calculateUsageTrend } from '../utils/analytics.js';

interface WeeklyReport {
  tenant_id: string;
  period: { start: string; end: string };
  total_tokens: number;
  total_cost: number;
  total_requests: number;
  avg_daily_tokens: number;
  top_models: { model: string; tokens: number; cost: number }[];
  trend: 'increasing' | 'decreasing' | 'stable';
  daily_breakdown: DailyUsage[];
}

interface MonthlyReport extends WeeklyReport {
  weekly_breakdown: { week: number; tokens: number; cost: number; requests: number }[];
  cost_projection: number;
  recommendations: string[];
}

interface PlatformReport {
  timestamp: string;
  period: { start: string; end: string };
  tenants: { total: number; active: number; suspended: number; new: number };
  revenue: { total_cost: number; avg_per_tenant: number };
  usage: { total_tokens: number; total_requests: number };
  segments: Record<string, number>;
  top_tenants: { id: string; name: string; tokens: number; cost: number }[];
  bottom_tenants: { id: string; name: string; tokens: number; cost: number }[];
}

export class ReportGenerator {
  constructor(private env: Bindings) {}

  async generateWeeklyReport(tenantId: string): Promise<WeeklyReport> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
    const startDate = toDateString(weekAgo);
    const endDate = toDateString(now);

    const usage = await getTenantUsageSummary(this.env.DB, tenantId, startDate, endDate);

    const totalTokens = usage.reduce((sum, d) => sum + d.total_tokens, 0);
    const totalCost = usage.reduce((sum, d) => sum + d.total_cost, 0);
    const totalRequests = usage.reduce((sum, d) => sum + d.total_requests, 0);
    const activeDays = usage.filter(d => d.total_tokens > 0).length;

    // Extract top models from model_breakdown
    const modelTotals: Record<string, { tokens: number; cost: number }> = {};
    for (const day of usage) {
      if (day.model_breakdown) {
        const breakdown = safeJsonParse<Record<string, { tokens?: number; cost?: number }>>(day.model_breakdown, {});
        for (const [model, data] of Object.entries(breakdown)) {
          const d = data as { tokens?: number; cost?: number };
          if (!modelTotals[model]) modelTotals[model] = { tokens: 0, cost: 0 };
          modelTotals[model].tokens += d.tokens || 0;
          modelTotals[model].cost += d.cost || 0;
        }
      }
    }
    const topModels = Object.entries(modelTotals)
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    // Determine trend using shared utility
    const tokenValues = usage.map(d => d.total_tokens);
    const trend = calculateUsageTrend(tokenValues);

    return {
      tenant_id: tenantId,
      period: { start: startDate, end: endDate },
      total_tokens: totalTokens,
      total_cost: totalCost,
      total_requests: totalRequests,
      avg_daily_tokens: activeDays > 0 ? Math.round(totalTokens / activeDays) : 0,
      top_models: topModels,
      trend,
      daily_breakdown: usage,
    };
  }

  async generateMonthlyReport(tenantId: string): Promise<MonthlyReport> {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * MS_PER_DAY);
    const startDate = toDateString(monthAgo);
    const endDate = toDateString(now);

    const usage = await getTenantUsageSummary(this.env.DB, tenantId, startDate, endDate);

    const totalTokens = usage.reduce((sum, d) => sum + d.total_tokens, 0);
    const totalCost = usage.reduce((sum, d) => sum + d.total_cost, 0);
    const totalRequests = usage.reduce((sum, d) => sum + d.total_requests, 0);
    const activeDays = usage.filter(d => d.total_tokens > 0).length;

    // Model breakdown
    const modelTotals: Record<string, { tokens: number; cost: number }> = {};
    for (const day of usage) {
      if (day.model_breakdown) {
        const breakdown = safeJsonParse<Record<string, { tokens?: number; cost?: number }>>(day.model_breakdown, {});
        for (const [model, data] of Object.entries(breakdown)) {
          const d = data as { tokens?: number; cost?: number };
          if (!modelTotals[model]) modelTotals[model] = { tokens: 0, cost: 0 };
          modelTotals[model].tokens += d.tokens || 0;
          modelTotals[model].cost += d.cost || 0;
        }
      }
    }
    const topModels = Object.entries(modelTotals)
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    // Weekly breakdown
    const weeklyBreakdown: { week: number; tokens: number; cost: number; requests: number }[] = [];
    for (let w = 0; w < 4; w++) {
      const weekSlice = usage.slice(w * 7, (w + 1) * 7);
      weeklyBreakdown.push({
        week: w + 1,
        tokens: weekSlice.reduce((s, d) => s + d.total_tokens, 0),
        cost: weekSlice.reduce((s, d) => s + d.total_cost, 0),
        requests: weekSlice.reduce((s, d) => s + d.total_requests, 0),
      });
    }

    // Trend using shared utility
    const tokenValues = usage.map(d => d.total_tokens);
    const trend = calculateUsageTrend(tokenValues);

    // Cost projection (next 30 days based on current trend)
    const costProjection = trend === 'increasing' ? totalCost * 1.3
      : trend === 'decreasing' ? totalCost * 0.7
      : totalCost;

    // Recommendations
    const recommendations: string[] = [];
    const subscription = await getSubscription(this.env.DB, tenantId);
    if (subscription) {
      const plans = await listBillingPlans(this.env.DB);
      const currentPlan = plans.find(p => p.id === subscription.plan_id);
      if (currentPlan) {
        const monthlyUsagePercent = (totalTokens / currentPlan.monthly_token_limit) * 100;
        if (monthlyUsagePercent > USAGE_HIGH_THRESHOLD_PERCENT) {
          const nextPlan = plans.find(p => p.monthly_price > currentPlan.monthly_price);
          if (nextPlan) {
            recommendations.push(`월간 사용량이 ${monthlyUsagePercent.toFixed(0)}%에 도달했습니다. ${nextPlan.display_name} 플랜 업그레이드를 고려해 주세요.`);
          }
        }
        if (monthlyUsagePercent < USAGE_LOW_THRESHOLD_PERCENT && currentPlan.monthly_price > 0) {
          const lowerPlan = plans.find(p => p.monthly_price < currentPlan.monthly_price && p.monthly_price > 0);
          if (lowerPlan) {
            recommendations.push(`현재 플랜의 ${monthlyUsagePercent.toFixed(0)}%만 사용 중입니다. ${lowerPlan.display_name} 플랜으로 비용을 절약할 수 있습니다.`);
          }
        }
      }
    }
    if (trend === 'decreasing') {
      recommendations.push('사용량이 감소 추세입니다. AI 비서 활용도를 높일 수 있는 새로운 기능을 확인해 보세요.');
    }
    if (activeDays < 15) {
      recommendations.push(`30일 중 ${activeDays}일만 사용하셨습니다. 매일 활용하면 더 큰 효과를 볼 수 있습니다.`);
    }

    return {
      tenant_id: tenantId,
      period: { start: startDate, end: endDate },
      total_tokens: totalTokens,
      total_cost: totalCost,
      total_requests: totalRequests,
      avg_daily_tokens: activeDays > 0 ? Math.round(totalTokens / activeDays) : 0,
      top_models: topModels,
      trend,
      daily_breakdown: usage,
      weekly_breakdown: weeklyBreakdown,
      cost_projection: costProjection,
      recommendations,
    };
  }

  async generatePlatformReport(): Promise<PlatformReport> {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * MS_PER_DAY);
    const startDate = toDateString(monthAgo);
    const endDate = toDateString(now);
    const twoWeeksAgo = new Date(now.getTime() - 14 * MS_PER_DAY).toISOString();

    const allTenants = await listTenants(this.env.DB, { limit: 1000 });
    const activeTenants = allTenants.filter(t => t.status === 'active');
    const suspendedTenants = allTenants.filter(t => t.status === 'suspended');
    const newTenants = allTenants.filter(t => t.created_at >= twoWeeksAgo);

    // Per-tenant usage
    const tenantUsage: { id: string; name: string; tokens: number; cost: number }[] = [];
    let totalCost = 0;
    let totalTokens = 0;
    let totalRequests = 0;

    for (const tenant of activeTenants) {
      const usage = await getTenantUsageSummary(this.env.DB, tenant.id, startDate, endDate);
      const tokens = usage.reduce((s, d) => s + d.total_tokens, 0);
      const cost = usage.reduce((s, d) => s + d.total_cost, 0);
      const requests = usage.reduce((s, d) => s + d.total_requests, 0);

      totalCost += cost;
      totalTokens += tokens;
      totalRequests += requests;

      tenantUsage.push({ id: tenant.id, name: tenant.name, tokens, cost });
    }

    tenantUsage.sort((a, b) => b.tokens - a.tokens);

    // Segment counts
    const segmentNames = ['champion', 'at_risk', 'potential_upsell', 'need_attention', 'happy_inactive', 'new'];
    const segments: Record<string, number> = {};
    for (const seg of segmentNames) {
      const list = await listTenantsBySegment(this.env.DB, seg);
      segments[seg] = list.length;
    }

    return {
      timestamp: now.toISOString(),
      period: { start: startDate, end: endDate },
      tenants: {
        total: allTenants.length,
        active: activeTenants.length,
        suspended: suspendedTenants.length,
        new: newTenants.length,
      },
      revenue: {
        total_cost: totalCost,
        avg_per_tenant: activeTenants.length > 0 ? totalCost / activeTenants.length : 0,
      },
      usage: { total_tokens: totalTokens, total_requests: totalRequests },
      segments,
      top_tenants: tenantUsage.slice(0, 5),
      bottom_tenants: tenantUsage.slice(-5).reverse(),
    };
  }

  async sendWeeklyReports(): Promise<{ sent: number; failed: number }> {
    const cronLog = await createCronLog(this.env.DB, {
      id: crypto.randomUUID(),
      job_name: 'weekly_reports',
      status: 'running',
      tenants_processed: 0,
      details: null,
      started_at: new Date().toISOString(),
    });

    let sent = 0;
    let failed = 0;

    try {
      const tenants = await listTenants(this.env.DB, { status: 'active' });

      for (const tenant of tenants) {
        try {
          const report = await this.generateWeeklyReport(tenant.id);

          await createNotification(this.env.DB, {
            id: crypto.randomUUID(),
            tenant_id: tenant.id,
            channel: 'email',
            type: 'report',
            status: 'pending',
            content: JSON.stringify({
              subject: `[OpenClaw] ${tenant.name} 주간 리포트`,
              report_type: 'weekly',
              data: report,
            }),
            sent_at: null,
          });

          sent++;
        } catch (error) {
          structuredError('weekly_report_failed', error, {
            tenant_id: tenant.id,
          });
          failed++;
        }
      }

      await updateCronLog(this.env.DB, cronLog.id, {
        status: 'completed',
        tenants_processed: sent,
        details: JSON.stringify({ sent, failed }),
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      await updateCronLog(this.env.DB, cronLog.id, {
        status: 'failed',
        error_message: formatErrorMessage(error),
        completed_at: new Date().toISOString(),
      });
    }

    return { sent, failed };
  }

  async sendMonthlyReports(): Promise<{ sent: number; failed: number }> {
    const cronLog = await createCronLog(this.env.DB, {
      id: crypto.randomUUID(),
      job_name: 'monthly_reports',
      status: 'running',
      tenants_processed: 0,
      details: null,
      started_at: new Date().toISOString(),
    });

    let sent = 0;
    let failed = 0;

    try {
      const tenants = await listTenants(this.env.DB, { status: 'active' });

      for (const tenant of tenants) {
        try {
          const report = await this.generateMonthlyReport(tenant.id);

          await createNotification(this.env.DB, {
            id: crypto.randomUUID(),
            tenant_id: tenant.id,
            channel: 'email',
            type: 'report',
            status: 'pending',
            content: JSON.stringify({
              subject: `[OpenClaw] ${tenant.name} 월간 리포트`,
              report_type: 'monthly',
              data: report,
            }),
            sent_at: null,
          });

          sent++;
        } catch (error) {
          structuredError('monthly_report_failed', error, {
            tenant_id: tenant.id,
          });
          failed++;
        }
      }

      // Also generate platform report
      try {
        const platformReport = await this.generatePlatformReport();
        structuredLog('platform_monthly_report', {
          ...platformReport,
        });
      } catch (error) {
        structuredError('platform_report_failed', error);
      }

      await updateCronLog(this.env.DB, cronLog.id, {
        status: 'completed',
        tenants_processed: sent,
        details: JSON.stringify({ sent, failed }),
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      await updateCronLog(this.env.DB, cronLog.id, {
        status: 'failed',
        error_message: formatErrorMessage(error),
        completed_at: new Date().toISOString(),
      });
    }

    return { sent, failed };
  }
}

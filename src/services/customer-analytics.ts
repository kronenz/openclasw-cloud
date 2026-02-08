import type { Bindings, BillingSubscription, DailyUsage, Tenant } from '../types/index.js';
import { listTenants, getTenant, getSubscription, getTenantUsageSummary, listBillingPlans } from '../db/queries.js';
import { upsertTenantSegment, getTenantSegment } from '../db/queries-v2.js';
import { safeJsonParse } from '../utils/json.js';
import { toDateString, nowISO } from '../utils/id.js';
import { MS_PER_DAY, USAGE_HIGH_THRESHOLD_PERCENT, USAGE_DROP_THRESHOLD, MIN_ACTIVE_TOKENS } from '../config/constants.js';
import { structuredLog } from '../utils/log.js';
import { calculateUsageTrend, aggregateTokenUsage } from '../utils/analytics.js';

interface TenantAnalysis {
  tenant_id: string;
  avg_daily_tokens: number;
  total_cost_30d: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  days_active: number;
  usage_data: DailyUsage[];
}

interface SegmentSummary {
  champion: number;
  at_risk: number;
  potential_upsell: number;
  need_attention: number;
  happy_inactive: number;
  new: number;
  total: number;
}

interface TenantInsight {
  tenant_id: string;
  tenant_name: string;
  segment: string;
  insights: string[];
  recommendations: string[];
  benchmarks: {
    industry_avg_tokens: number;
    industry_avg_cost: number;
    your_tokens: number;
    your_cost: number;
  };
}

export class CustomerAnalytics {
  constructor(private readonly env: Bindings) {}

  // Analyze a single tenant's usage patterns
  async analyzeTenant(tenantId: string): Promise<TenantAnalysis> {
    const endDate = toDateString();
    const startDate = toDateString(new Date(Date.now() - 30 * MS_PER_DAY));

    const usageData = await getTenantUsageSummary(this.env.DB, tenantId, startDate, endDate);

    if (usageData.length === 0) {
      return {
        tenant_id: tenantId,
        avg_daily_tokens: 0,
        total_cost_30d: 0,
        trend: 'stable',
        days_active: 0,
        usage_data: [],
      };
    }

    const totalTokens = usageData.reduce((sum, day) => sum + day.total_tokens, 0);
    const totalCost = usageData.reduce((sum, day) => sum + day.total_cost, 0);
    const daysActive = usageData.filter(day => day.total_requests > 0).length;
    const avgDailyTokens = daysActive > 0 ? totalTokens / daysActive : 0;

    // Calculate trend using shared utility
    const tokenValues = usageData.map(day => day.total_tokens);
    const trend = calculateUsageTrend(tokenValues);

    return {
      tenant_id: tenantId,
      avg_daily_tokens: avgDailyTokens,
      total_cost_30d: totalCost,
      trend,
      days_active: daysActive,
      usage_data: usageData,
    };
  }

  // Segment all active tenants based on usage patterns and health
  async segmentTenants(): Promise<SegmentSummary> {
    const tenants = await listTenants(this.env.DB, { status: 'active' });
    const summary: SegmentSummary = {
      champion: 0,
      at_risk: 0,
      potential_upsell: 0,
      need_attention: 0,
      happy_inactive: 0,
      new: 0,
      total: tenants.length,
    };

    for (const tenant of tenants) {
      const segment = await this.classifyTenant(tenant);
      await upsertTenantSegment(this.env.DB, segment);
      summary[segment.segment]++;
    }

    structuredLog('tenant_segmentation_completed', { summary });

    return summary;
  }

  // Calculate activity score based on recency (0-30 range contribution)
  private calculateActivityScore(daysSinceLastActive: number): number {
    if (daysSinceLastActive <= 7) {
      return 20;
    } else if (daysSinceLastActive > 7 && daysSinceLastActive <= 14) {
      return -10;
    } else {
      return -30;
    }
  }

  // Calculate usage score based on usage relative to plan limit (0-40 range contribution)
  private calculateUsageScore(avgDailyTokens: number, planLimit: number | null): number {
    // No plan or no usage
    if (!planLimit || avgDailyTokens === 0) {
      return 0;
    }

    const usagePercent = (avgDailyTokens / planLimit) * 100;

    // Heavy usage relative to plan
    if (usagePercent > USAGE_HIGH_THRESHOLD_PERCENT) {
      return 10;
    } else if (usagePercent > 50) {
      return 5;
    } else {
      return 0;
    }
  }

  // Identify risk factors based on tenant analysis
  private identifyRiskFactors(
    analysis: TenantAnalysis,
    _subscription: BillingSubscription | null,
    daysSinceLastActive: number
  ): string[] {
    const riskFactors: string[] = [];

    // Inactivity risk
    if (daysSinceLastActive > 7 && daysSinceLastActive <= 14) {
      riskFactors.push('inactive_7d');
    } else if (daysSinceLastActive > 14) {
      riskFactors.push('inactive_14d');
    }

    // Low activity risk
    if (analysis.days_active < 5) {
      riskFactors.push('low_activity');
    }

    // Declining usage risk
    if (analysis.trend === 'decreasing') {
      riskFactors.push('usage_declining');
    }

    // Check for usage drop (comparing last 7 days to previous 7 days)
    if (analysis.usage_data.length >= 14) {
      const lastWeek = aggregateTokenUsage(analysis.usage_data, 0, 7);
      const prevWeek = aggregateTokenUsage(analysis.usage_data, 7, 7);
      if (prevWeek > 0 && lastWeek < prevWeek * USAGE_DROP_THRESHOLD) {
        riskFactors.push('usage_dropped_50pct');
      }
    }

    return riskFactors;
  }

  // Classify a tenant into a segment
  private async classifyTenant(tenant: Tenant) {
    const analysis = await this.analyzeTenant(tenant.id);
    const subscription = await getSubscription(this.env.DB, tenant.id);
    const plans = await listBillingPlans(this.env.DB);
    const plan = plans.find(p => p.id === subscription?.plan_id);

    // Check creation date (new tenant?)
    const createdAt = new Date(tenant.created_at);
    const daysSinceCreation = (Date.now() - createdAt.getTime()) / MS_PER_DAY;
    const isNew = daysSinceCreation <= 14;

    if (isNew) {
      return {
        tenant_id: tenant.id,
        segment: 'new' as const,
        score: 60,
        last_active_at: analysis.usage_data.length > 0 ? analysis.usage_data[analysis.usage_data.length - 1].date : null,
        risk_factors: JSON.stringify(['new_tenant']),
        updated_at: nowISO(),
      };
    }

    // Check last activity
    const lastActiveDate = analysis.usage_data.length > 0
      ? new Date(analysis.usage_data[analysis.usage_data.length - 1].date)
      : null;
    const daysSinceLastActive = lastActiveDate
      ? (Date.now() - lastActiveDate.getTime()) / MS_PER_DAY
      : 999;

    // Calculate health score (0-100) using sub-methods
    let score = 50; // Base score
    score += this.calculateActivityScore(daysSinceLastActive);

    // High usage (>14 active days in 30)? +20
    if (analysis.days_active > 14) {
      score += 20;
    } else if (analysis.days_active < 5) {
      score -= 15;
    }

    // Trend bonus
    if (analysis.trend === 'increasing') {
      score += 10;
    } else if (analysis.trend === 'decreasing') {
      score -= 10;
    }

    // Usage score contribution
    score += this.calculateUsageScore(analysis.avg_daily_tokens, plan?.daily_token_limit || null);

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(analysis, subscription, daysSinceLastActive);

    // Check usage vs plan limits for upsell opportunity
    const usageVsPlanLimit = plan
      ? (analysis.avg_daily_tokens / plan.daily_token_limit) * 100
      : 0;

    if (usageVsPlanLimit > USAGE_HIGH_THRESHOLD_PERCENT) {
      riskFactors.push('approaching_limit');
    }

    // Determine segment
    let segment: 'champion' | 'at_risk' | 'potential_upsell' | 'need_attention' | 'happy_inactive' = 'need_attention';

    if (score >= 80 && daysSinceLastActive <= 7 && analysis.avg_daily_tokens > 0) {
      segment = 'champion';
    } else if (analysis.days_active > 14 && daysSinceLastActive > 7) {
      segment = 'at_risk';
    } else if (usageVsPlanLimit > USAGE_HIGH_THRESHOLD_PERCENT && daysSinceLastActive <= 7) {
      segment = 'potential_upsell';
    } else if (score < 40 && analysis.days_active > 0) {
      segment = 'need_attention';
    } else if (subscription?.status === 'active' && analysis.avg_daily_tokens < MIN_ACTIVE_TOKENS) {
      segment = 'happy_inactive';
    }

    // Override segment if critical risk factor detected
    if (riskFactors.includes('usage_dropped_50pct')) {
      segment = 'at_risk';
    }

    return {
      tenant_id: tenant.id,
      segment,
      score: Math.max(0, Math.min(100, score)),
      last_active_at: lastActiveDate?.toISOString() || null,
      risk_factors: riskFactors.length > 0 ? JSON.stringify(riskFactors) : null,
      updated_at: nowISO(),
    };
  }

  // Generate insights and recommendations for a tenant
  async generateInsights(tenantId: string): Promise<TenantInsight> {
    const tenant = await getTenant(this.env.DB, tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const analysis = await this.analyzeTenant(tenantId);
    const segment = await getTenantSegment(this.env.DB, tenantId);
    const subscription = await getSubscription(this.env.DB, tenantId);
    const plans = await listBillingPlans(this.env.DB);
    const plan = plans.find(p => p.id === subscription?.plan_id);

    const insights: string[] = [];
    const recommendations: string[] = [];

    // Industry benchmarks (hardcoded for now)
    const INDUSTRY_BENCHMARKS = {
      cafe: { avg_tokens: 50000, avg_cost: 2.5 },
      office: { avg_tokens: 80000, avg_cost: 4.0 },
      shopping: { avg_tokens: 60000, avg_cost: 3.0 },
      general: { avg_tokens: 45000, avg_cost: 2.0 },
    };

    const metadata = safeJsonParse<{ industry?: string }>(tenant.metadata, {});
    const industry = metadata.industry || 'general';
    const benchmark = INDUSTRY_BENCHMARKS[industry as keyof typeof INDUSTRY_BENCHMARKS] || INDUSTRY_BENCHMARKS.general;

    // Generate insights
    if (analysis.avg_daily_tokens > benchmark.avg_tokens) {
      insights.push(`동종 업계 평균(${benchmark.avg_tokens.toLocaleString()} 토큰)보다 ${((analysis.avg_daily_tokens / benchmark.avg_tokens - 1) * 100).toFixed(0)}% 더 활발히 사용 중`);
    } else if (analysis.avg_daily_tokens < benchmark.avg_tokens * USAGE_DROP_THRESHOLD) {
      insights.push(`동종 업계 평균(${benchmark.avg_tokens.toLocaleString()} 토큰)의 절반 이하로 사용 중`);
      recommendations.push('AI 비서 활용도를 높이기 위해 추가 기능을 설정해 보세요');
    }

    if (analysis.trend === 'increasing') {
      insights.push('사용량이 증가 추세입니다');
    } else if (analysis.trend === 'decreasing') {
      insights.push('사용량이 감소 추세입니다');
      recommendations.push('사용 감소 원인을 파악하고 개선이 필요합니다');
    }

    if (analysis.days_active < 10) {
      insights.push(`최근 30일 중 ${analysis.days_active}일만 활동`);
      recommendations.push('정기적인 활용을 위해 자동화 파이프라인 설정을 권장합니다');
    }

    if (plan && analysis.avg_daily_tokens > plan.daily_token_limit * (USAGE_HIGH_THRESHOLD_PERCENT / 100)) {
      insights.push('일일 한도의 80% 이상 사용 중');
      const nextPlan = plans.find(p => p.monthly_price > plan.monthly_price && p.daily_token_limit > plan.daily_token_limit);
      if (nextPlan) {
        recommendations.push(`${nextPlan.display_name} 플랜으로 업그레이드를 고려해 보세요`);
      }
    }

    if (segment?.risk_factors) {
      const riskFactors = safeJsonParse<string[]>(segment.risk_factors, []);
      if (riskFactors.includes('inactive_7d')) {
        recommendations.push('최근 활동이 없습니다. 대시보드에서 상태를 확인해 주세요');
      }
      if (riskFactors.includes('usage_dropped_50pct')) {
        recommendations.push('사용량이 급격히 감소했습니다. 문제가 있는지 점검이 필요합니다');
      }
    }

    return {
      tenant_id: tenantId,
      tenant_name: tenant.name,
      segment: segment?.segment || 'unknown',
      insights,
      recommendations,
      benchmarks: {
        industry_avg_tokens: benchmark.avg_tokens,
        industry_avg_cost: benchmark.avg_cost,
        your_tokens: Math.round(analysis.avg_daily_tokens),
        your_cost: parseFloat(analysis.total_cost_30d.toFixed(2)),
      },
    };
  }
}

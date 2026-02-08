import type { Bindings, ModelRecommendation, Alert } from '../types/index.js';
import { logUsage, getDailyUsage, getSubscription, listBillingPlans } from '../db/queries.js';
import { safeJsonParse } from '../utils/json.js';
import { toDateString } from '../utils/id.js';

// Model cost per 1K tokens (USD)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'opus': { input: 0.015, output: 0.075 },
  'sonnet': { input: 0.003, output: 0.015 },
  'haiku': { input: 0.00025, output: 0.00125 },
  'flash': { input: 0.0001, output: 0.0005 },
};

// Downgrade chain
const MODEL_DOWNGRADE_CHAIN = ['opus', 'sonnet', 'haiku', 'flash'];

export class CostController {
  constructor(private env: Bindings) {}

  // Calculate cost for a usage record
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs = MODEL_COSTS[model] || MODEL_COSTS['haiku'];
    return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
  }

  // Record usage with auto-calculated cost
  async recordUsage(tenantId: string, model: string, inputTokens: number, outputTokens: number, endpoint?: string): Promise<void> {
    const cost = this.calculateCost(model, inputTokens, outputTokens);
    await logUsage(this.env.DB, {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
      endpoint: endpoint || null,
    });
  }

  // Check if tenant has exceeded daily limits, recommend model downgrade
  async checkLimits(tenantId: string): Promise<ModelRecommendation | null> {
    const today = toDateString();
    const usage = await getDailyUsage(this.env.DB, tenantId, today);

    if (!usage) return null;  // No usage today

    const subscription = await getSubscription(this.env.DB, tenantId);
    if (!subscription) return null;

    const plans = await listBillingPlans(this.env.DB);
    const plan = plans.find(p => p.id === subscription.plan_id);
    if (!plan) return null;

    const usagePercent = (usage.total_tokens / plan.daily_token_limit) * 100;

    // At 80% usage, recommend downgrade
    if (usagePercent >= 80) {
      const breakdown = safeJsonParse<Record<string, unknown>>(usage.model_breakdown, {});
      // Find the most expensive model being used
      const currentModel = Object.keys(breakdown).sort((a, b) => {
        const costA = MODEL_COSTS[a]?.output || 0;
        const costB = MODEL_COSTS[b]?.output || 0;
        return costB - costA;
      })[0] || 'sonnet';

      const recommended = this.getDowngradeModel(currentModel);
      if (recommended !== currentModel) {
        return {
          current_model: currentModel,
          recommended_model: recommended,
          reason: `일일 토큰 사용량 ${usagePercent.toFixed(1)}% 도달 (${usage.total_tokens}/${plan.daily_token_limit})`,
          usage_percent: usagePercent,
        };
      }
    }

    return null;
  }

  // Get the next model in the downgrade chain
  getDowngradeModel(currentModel: string): string {
    const idx = MODEL_DOWNGRADE_CHAIN.indexOf(currentModel);
    if (idx === -1 || idx >= MODEL_DOWNGRADE_CHAIN.length - 1) {
      return MODEL_DOWNGRADE_CHAIN[MODEL_DOWNGRADE_CHAIN.length - 1]; // flash
    }
    return MODEL_DOWNGRADE_CHAIN[idx + 1];
  }

  // Aggregate daily usage from usage_logs (for Cron Trigger)
  async aggregateDailyUsage(): Promise<number> {
    const today = toDateString();

    // Aggregate from usage_logs for today
    const result = await this.env.DB.prepare(`
      SELECT
        tenant_id,
        COUNT(*) as total_requests,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        json_group_object(model, json_object(
          'tokens', SUM(input_tokens + output_tokens),
          'cost', SUM(cost_usd),
          'requests', COUNT(*)
        )) as model_breakdown
      FROM usage_logs
      WHERE date(created_at) = ?
      GROUP BY tenant_id
    `).bind(today).all();

    if (!result.results) return 0;

    let count = 0;
    for (const row of result.results) {
      const r = row as Record<string, unknown>;
      await this.env.DB.prepare(`
        INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, date) DO UPDATE SET
          total_requests = excluded.total_requests,
          total_tokens = excluded.total_tokens,
          total_cost = excluded.total_cost,
          model_breakdown = excluded.model_breakdown
      `).bind(
        r.tenant_id as string,
        today,
        r.total_requests as number,
        r.total_tokens as number,
        r.total_cost as number,
        r.model_breakdown as string
      ).run();
      count++;
    }

    return count;
  }

  // Detect anomalous usage patterns
  async detectAnomalies(tenantId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const today = toDateString();
    const usage = await getDailyUsage(this.env.DB, tenantId, today);

    if (!usage) return alerts;

    // Check for sudden spike (> 3x average of last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const historicalResult = await this.env.DB.prepare(`
      SELECT AVG(total_tokens) as avg_tokens, AVG(total_cost) as avg_cost
      FROM daily_usage
      WHERE tenant_id = ? AND date >= ? AND date < ?
    `).bind(tenantId, weekAgo, today).first<{ avg_tokens: number; avg_cost: number }>();

    if (historicalResult?.avg_tokens && usage.total_tokens > historicalResult.avg_tokens * 3) {
      alerts.push({
        type: 'anomaly',
        severity: 'warning',
        tenant_id: tenantId,
        message: `비정상 사용량 감지: 오늘 ${usage.total_tokens} 토큰 (7일 평균의 ${(usage.total_tokens / historicalResult.avg_tokens).toFixed(1)}배)`,
        data: { today_tokens: usage.total_tokens, avg_tokens: historicalResult.avg_tokens },
      });
    }

    if (historicalResult?.avg_cost && usage.total_cost > historicalResult.avg_cost * 5) {
      alerts.push({
        type: 'cost_limit',
        severity: 'critical',
        tenant_id: tenantId,
        message: `비용 이상 감지: 오늘 $${usage.total_cost.toFixed(4)} (7일 평균의 ${(usage.total_cost / historicalResult.avg_cost).toFixed(1)}배)`,
        data: { today_cost: usage.total_cost, avg_cost: historicalResult.avg_cost },
      });
    }

    return alerts;
  }
}

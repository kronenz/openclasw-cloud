import type { Bindings, TenantHealth, Alert } from '../types/index.js';
import { listTenants, getTenantResources, listIncidents } from '../db/queries.js';
import { AutoRecovery } from './auto-recovery.js';
import { SlackNotifier } from './slack-notifier.js';
import { CACHE_TTL_HEALTH_STATUS, soulR2Key } from '../config/constants.js';
import { structuredLog, formatErrorMessage } from '../utils/log.js';
import { nowISO } from '../utils/id.js';

interface HealthReport {
  timestamp: string;
  total_tenants: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  tenants: TenantHealth[];
}

export class HealthChecker {
  constructor(private readonly env: Bindings) {}

  // Check a single tenant's health
  async checkTenant(tenantId: string): Promise<TenantHealth> {
    const details: Record<string, unknown> = {};
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Check 1: Resources exist
      const resources = await getTenantResources(this.env.DB, tenantId);
      details.resource_count = resources.length;
      if (resources.length === 0) {
        status = 'unhealthy';
        details.resource_error = 'No resources found';
      }

      // Check 2: SOUL.md exists in R2
      const soulObj = await this.env.STORAGE.head(soulR2Key(tenantId));
      details.soul_exists = !!soulObj;
      if (!soulObj && status === 'healthy') {
        status = 'degraded';
      }

      // Check 3: Active incidents
      const incidents = await listIncidents(this.env.DB, {
        tenantId,
        status: 'open',
      });
      details.open_incidents = incidents.length;
      if (incidents.some(i => i.severity === 'P0' || i.severity === 'P1')) {
        status = 'unhealthy';
      } else if (incidents.length > 0 && status === 'healthy') {
        status = 'degraded';
      }

      // Check 4: Recent usage (tenant is actually being used)
      const usageResult = await this.env.DB.prepare(`
        SELECT COUNT(*) as count FROM usage_logs
        WHERE tenant_id = ? AND created_at > datetime('now', '-24 hours')
      `).bind(tenantId).first<{ count: number }>();
      details.requests_24h = usageResult?.count || 0;

    } catch (error) {
      status = 'unhealthy';
      details.error = formatErrorMessage(error);
    }

    const health: TenantHealth = {
      tenant_id: tenantId,
      status,
      last_checked: nowISO(),
      details,
    };

    // Cache the health status
    await this.env.CACHE.put(
      `health:${tenantId}`,
      JSON.stringify(health),
      { expirationTtl: CACHE_TTL_HEALTH_STATUS }
    );

    return health;
  }

  // Check all active tenants (for Cron Trigger, every 5 minutes)
  async checkAllTenants(): Promise<HealthReport> {
    const tenants = await listTenants(this.env.DB, { status: 'active' });
    const results: TenantHealth[] = [];

    for (const tenant of tenants) {
      const health = await this.checkTenant(tenant.id);
      results.push(health);

      // Attempt auto-recovery for unhealthy tenants
      if (health.status === 'unhealthy') {
        const recovery = new AutoRecovery(this.env);
        await recovery.attemptRecovery(tenant.id, health);
      }
    }

    const report: HealthReport = {
      timestamp: nowISO(),
      total_tenants: tenants.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      degraded: results.filter(r => r.status === 'degraded').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length,
      tenants: results,
    };

    // Send alert if any unhealthy
    if (report.unhealthy > 0) {
      await this.sendAlert({
        type: 'health',
        severity: 'critical',
        message: `${report.unhealthy}개 테넌트 비정상 상태 감지 (전체 ${report.total_tenants}개 중)`,
        data: {
          healthy: report.healthy,
          degraded: report.degraded,
          unhealthy: report.unhealthy,
        },
      });
    }

    return report;
  }


  // Send alert via Slack webhook
  async sendAlert(alert: Alert): Promise<void> {
    structuredLog('alert', { ...alert });

    const notifier = new SlackNotifier(this.env);
    const severityMap: Record<string, string> = {
      info: 'P3',
      warning: 'P2',
      critical: 'P1',
    };

    await notifier.sendAlert({
      severity: severityMap[alert.severity],
      title: `[${alert.type.toUpperCase()}] ${alert.message}`,
      message: alert.data ? `\`\`\`${JSON.stringify(alert.data, null, 2)}\`\`\`` : '',
    });
  }
}

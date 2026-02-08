import type { Bindings, TenantHealth, Alert } from '../types/index.js';
import { listTenants, getTenantResources, listIncidents } from '../db/queries.js';
import { AutoRecovery } from './auto-recovery.js';

interface HealthReport {
  timestamp: string;
  total_tenants: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  tenants: TenantHealth[];
}

export class HealthChecker {
  constructor(private env: Bindings) {}

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
      const soulObj = await this.env.STORAGE.head(`tenants/${tenantId}/SOUL.md`);
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
      details.error = error instanceof Error ? error.message : String(error);
    }

    const health: TenantHealth = {
      tenant_id: tenantId,
      status,
      last_checked: new Date().toISOString(),
      details,
    };

    // Cache the health status
    await this.env.CACHE.put(
      `health:${tenantId}`,
      JSON.stringify(health),
      { expirationTtl: 300 }  // 5 minutes
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
      timestamp: new Date().toISOString(),
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
    console.log(JSON.stringify({
      event: 'alert',
      ...alert,
      timestamp: new Date().toISOString(),
    }));

    if (!this.env.SLACK_WEBHOOK_URL) return;

    const severityEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
    };

    try {
      await fetch(this.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${severityEmoji[alert.severity]} [${alert.type.toUpperCase()}] ${alert.message}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${severityEmoji[alert.severity]} *[${alert.type.toUpperCase()}]* ${alert.message}`,
              },
            },
            ...(alert.data ? [{
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '```' + JSON.stringify(alert.data, null, 2) + '```',
              },
            }] : []),
          ],
        }),
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }
}

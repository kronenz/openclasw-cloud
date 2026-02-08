import type { Bindings, TenantHealth } from '../types/index.js';
import {
  listIncidents,
  updateIncident,
  createIncident,
  getTenant,
  getTenantResources,
} from '../db/queries.js';
import { createNotification } from '../db/queries-v2.js';
import { generateIncidentId } from '../utils/id.js';
import { MAX_RECOVERY_ATTEMPTS } from '../config/constants.js';
import { SlackNotifier } from './slack-notifier.js';
import { structuredLog, structuredError } from '../utils/log.js';

interface RecoveryResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export class AutoRecovery {
  constructor(private env: Bindings) {}

  // Main entry point for auto-recovery
  async attemptRecovery(tenantId: string, health: TenantHealth): Promise<void> {
    structuredLog('auto_recovery_start', {
      tenant_id: tenantId,
      health_status: health.status,
    });

    try {
      // Get or create incident
      const incidents = await listIncidents(this.env.DB, {
        tenantId,
        status: 'open',
      });

      let incident = incidents[0];

      if (!incident) {
        // Create new incident
        const tenant = await getTenant(this.env.DB, tenantId);
        incident = await createIncident(this.env.DB, {
          id: generateIncidentId(),
          tenant_id: tenantId,
          severity: 'P2',
          status: 'open',
          title: `[자동 감지] ${tenant?.name || tenantId} 헬스체크 실패`,
          description: JSON.stringify(health.details),
          auto_recovery_attempts: 0,
          resolved_at: null,
        });
        structuredLog('incident_created', {
          incident_id: incident.id,
          tenant_id: tenantId,
        });
      }

      // Check if we've exhausted recovery attempts
      if (incident.auto_recovery_attempts >= MAX_RECOVERY_ATTEMPTS) {
        await this.escalateToOperator(tenantId, incident.id, health);
        return;
      }

      // Increment attempt counter
      await updateIncident(this.env.DB, incident.id, {
        auto_recovery_attempts: incident.auto_recovery_attempts + 1,
        description: JSON.stringify({
          ...health.details,
          recovery_attempt: incident.auto_recovery_attempts + 1,
          last_attempt: new Date().toISOString(),
        }),
      });

      // Notify tenant about the issue
      await this.notifyTenantOfIssue(tenantId);

      // Attempt recovery steps
      const recoveryResult = await this.performRecovery(tenantId, health);

      if (recoveryResult.success) {
        // Recovery succeeded - resolve incident
        await updateIncident(this.env.DB, incident.id, {
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          description: JSON.stringify({
            ...health.details,
            recovery_result: recoveryResult,
            resolved_at: new Date().toISOString(),
          }),
        });

        structuredLog('auto_recovery_success', {
          tenant_id: tenantId,
          incident_id: incident.id,
          attempts: incident.auto_recovery_attempts + 1,
          message: recoveryResult.message,
        });

        // Notify tenant of recovery
        await createNotification(this.env.DB, {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          channel: 'email',
          type: 'welcome',
          status: 'pending',
          content: JSON.stringify({
            subject: '서비스 복구 완료',
            body: `일시적인 장애가 자동으로 복구되었습니다.\n\n복구 내용: ${recoveryResult.message}`,
          }),
          sent_at: null,
        });
      } else {
        structuredLog('auto_recovery_failed', {
          tenant_id: tenantId,
          incident_id: incident.id,
          attempts: incident.auto_recovery_attempts + 1,
          message: recoveryResult.message,
        });
      }
    } catch (error) {
      structuredError('auto_recovery_error', error, { tenant_id: tenantId });
    }
  }

  // Perform actual recovery steps
  private async performRecovery(tenantId: string, health: TenantHealth): Promise<RecoveryResult> {
    const steps: string[] = [];

    try {
      // Step 1: Check if SOUL.md is missing
      if (!health.details.soul_exists) {
        structuredLog('recovery_step', {
          tenant_id: tenantId,
          step: 'restore_soul',
        });

        const restored = await this.restoreSoulFromBackup(tenantId);
        if (restored) {
          steps.push('SOUL.md restored from backup');
        } else {
          return {
            success: false,
            message: 'Failed to restore SOUL.md - no backup found',
          };
        }
      }

      // Step 2: Verify resources exist
      const resources = await getTenantResources(this.env.DB, tenantId);
      if (resources.length === 0) {
        return {
          success: false,
          message: 'No resources found - requires manual provisioning',
        };
      }
      steps.push('Resources verified');

      // Step 3: Re-check health after recovery attempts
      const soulObj = await this.env.STORAGE.head(`tenants/${tenantId}/SOUL.md`);
      if (!soulObj) {
        return {
          success: false,
          message: 'SOUL.md still missing after restore attempt',
        };
      }
      steps.push('SOUL.md verified');

      return {
        success: true,
        message: steps.join(', '),
        details: {
          steps,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Restore SOUL.md from R2 backup
  async restoreSoulFromBackup(tenantId: string): Promise<boolean> {
    try {
      // Check if backup exists
      const backupObj = await this.env.STORAGE.get(`backups/${tenantId}/SOUL.md`);
      if (!backupObj) {
        structuredLog('backup_not_found', {
          tenant_id: tenantId,
          path: `backups/${tenantId}/SOUL.md`,
        });
        return false;
      }

      // Read backup content
      const backupContent = await backupObj.text();

      // Restore to active location
      await this.env.STORAGE.put(`tenants/${tenantId}/SOUL.md`, backupContent, {
        httpMetadata: {
          contentType: 'text/markdown',
        },
      });

      structuredLog('soul_restored', {
        tenant_id: tenantId,
        backup_size: backupContent.length,
      });

      return true;
    } catch (error) {
      structuredError('restore_failed', error, { tenant_id: tenantId });
      return false;
    }
  }

  // Escalate to operator after 3 failed attempts
  private async escalateToOperator(tenantId: string, incidentId: string, health: TenantHealth): Promise<void> {
    // Update incident to P1 (high priority)
    await updateIncident(this.env.DB, incidentId, {
      severity: 'P1',
      status: 'investigating',
      description: JSON.stringify({
        ...health.details,
        escalation_reason: 'Auto-recovery exhausted (3 attempts)',
        escalated_at: new Date().toISOString(),
      }),
    });

    // Send alert to operator
    const notifier = new SlackNotifier(this.env);
    await notifier.sendEscalation({
      tenantId,
      reason: 'Auto-recovery exhausted',
      attempts: MAX_RECOVERY_ATTEMPTS,
    });

    structuredLog('incident_escalated', {
      tenant_id: tenantId,
      incident_id: incidentId,
      attempts: 3,
      new_severity: 'P1',
    });
  }

  // Notify tenant of temporary issue
  async notifyTenantOfIssue(tenantId: string): Promise<void> {
    try {
      await createNotification(this.env.DB, {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        channel: 'email',
        type: 'welcome',
        status: 'pending',
        content: JSON.stringify({
          subject: '일시적인 서비스 지연 안내',
          body: '현재 일시적인 기술적 문제로 서비스가 지연되고 있습니다. 자동 복구를 시도 중이며, 곧 정상화될 예정입니다.',
        }),
        sent_at: null,
      });
    } catch (error) {
      structuredError('notification_creation_failed', error, {});
    }
  }
}

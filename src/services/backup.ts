import type { Bindings, Tenant } from '../types/index.js';
import { listTenants, getTenant } from '../db/queries.js';
import { safeJsonParse } from '../utils/json.js';
import { BACKUP_RETENTION_DAYS } from '../config/constants.js';
import { structuredLog, structuredError, formatErrorMessage } from '../utils/log.js';

interface BackupResult {
  success: boolean;
  tenant_id: string;
  message: string;
  backup_size?: number;
}

interface BackupSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: BackupResult[];
}

export class BackupService {
  constructor(private env: Bindings) {}

  // Backup a single tenant's data to R2
  async backupTenant(tenantId: string): Promise<BackupResult> {
    try {
      structuredLog('backup_start', { tenant_id: tenantId });

      // Get tenant info
      const tenant = await getTenant(this.env.DB, tenantId);
      if (!tenant) {
        return {
          success: false,
          tenant_id: tenantId,
          message: 'Tenant not found',
        };
      }

      // Backup SOUL.md
      const soulObj = await this.env.STORAGE.get(`tenants/${tenantId}/SOUL.md`);
      let soulBackupSize = 0;

      if (soulObj) {
        const soulContent = await soulObj.text();
        await this.env.STORAGE.put(`backups/${tenantId}/SOUL.md`, soulContent, {
          httpMetadata: {
            contentType: 'text/markdown',
          },
          customMetadata: {
            backup_timestamp: new Date().toISOString(),
            tenant_name: tenant.name,
          },
        });
        soulBackupSize = soulContent.length;
      }

      // Backup tenant config/metadata as JSON
      const config = {
        tenant,
        backup_timestamp: new Date().toISOString(),
        backup_version: '1.0',
      };

      await this.env.STORAGE.put(
        `backups/${tenantId}/config.json`,
        JSON.stringify(config, null, 2),
        {
          httpMetadata: {
            contentType: 'application/json',
          },
        }
      );

      structuredLog('backup_complete', { tenant_id: tenantId, soul_size: soulBackupSize });

      return {
        success: true,
        tenant_id: tenantId,
        message: 'Backup completed successfully',
        backup_size: soulBackupSize,
      };
    } catch (error) {
      structuredError('backup_failed', error, { tenant_id: tenantId });

      return {
        success: false,
        tenant_id: tenantId,
        message: formatErrorMessage(error),
      };
    }
  }

  // Backup all active tenants (for daily cron)
  async backupAllTenants(): Promise<BackupSummary> {
    structuredLog('backup_all_start', {});

    const tenants = await listTenants(this.env.DB, { status: 'active' });
    const results: BackupResult[] = [];

    for (const tenant of tenants) {
      const result = await this.backupTenant(tenant.id);
      results.push(result);
    }

    const summary: BackupSummary = {
      total: tenants.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };

    structuredLog('backup_all_complete', {
      summary: {
        total: summary.total,
        succeeded: summary.succeeded,
        failed: summary.failed,
      },
    });

    return summary;
  }

  // Restore tenant from latest backup
  async restoreTenant(tenantId: string): Promise<{ success: boolean; message: string; config?: Tenant }> {
    try {
      structuredLog('restore_start', { tenant_id: tenantId });

      // Restore SOUL.md
      const soulBackup = await this.env.STORAGE.get(`backups/${tenantId}/SOUL.md`);
      if (!soulBackup) {
        return {
          success: false,
          message: 'No SOUL.md backup found',
        };
      }

      const soulContent = await soulBackup.text();
      await this.env.STORAGE.put(`tenants/${tenantId}/SOUL.md`, soulContent, {
        httpMetadata: {
          contentType: 'text/markdown',
        },
      });

      // Restore config
      const configBackup = await this.env.STORAGE.get(`backups/${tenantId}/config.json`);
      let configData: Tenant | undefined;

      if (configBackup) {
        const configText = await configBackup.text();
        const parsedConfig = safeJsonParse<{ tenant?: Tenant }>(configText, {});
        configData = parsedConfig.tenant;
      }

      structuredLog('restore_complete', { tenant_id: tenantId });

      return {
        success: true,
        message: 'Tenant restored successfully',
        config: configData,
      };
    } catch (error) {
      structuredError('restore_failed', error, { tenant_id: tenantId });

      return {
        success: false,
        message: formatErrorMessage(error),
      };
    }
  }

  // Remove backups older than retention period
  async cleanupOldBackups(retentionDays: number = BACKUP_RETENTION_DAYS): Promise<{ deleted: number; errors: number }> {
    structuredLog('cleanup_start', { retention_days: retentionDays });

    let deleted = 0;
    let errors = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      // List all objects with 'backups/' prefix
      const listed = await this.env.STORAGE.list({ prefix: 'backups/' });

      for (const obj of listed.objects) {
        try {
          // Check if object is older than retention period
          if (obj.uploaded && new Date(obj.uploaded) < cutoffDate) {
            await this.env.STORAGE.delete(obj.key);
            deleted++;

            structuredLog('backup_deleted', { key: obj.key, uploaded: obj.uploaded });
          }
        } catch (error) {
          errors++;
          structuredError('cleanup_error', error, { key: obj.key });
        }
      }

      // Handle truncated results (if more than 1000 objects)
      if (listed.truncated) {
        structuredLog('cleanup_truncated', {
          message: 'More than 1000 objects found, some may not be cleaned up',
        });
      }
    } catch (error) {
      structuredError('cleanup_list_failed', error, {});
      errors++;
    }

    structuredLog('cleanup_complete', { deleted, errors });

    return { deleted, errors };
  }
}

import type { Bindings, Tenant } from '../types/index.js';
import { listTenants, getTenant } from '../db/queries.js';

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
      console.log(JSON.stringify({
        event: 'backup_start',
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
      }));

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

      console.log(JSON.stringify({
        event: 'backup_complete',
        tenant_id: tenantId,
        soul_size: soulBackupSize,
        timestamp: new Date().toISOString(),
      }));

      return {
        success: true,
        tenant_id: tenantId,
        message: 'Backup completed successfully',
        backup_size: soulBackupSize,
      };
    } catch (error) {
      console.error(JSON.stringify({
        event: 'backup_failed',
        tenant_id: tenantId,
        error: error instanceof Error ? error.message : String(error),
      }));

      return {
        success: false,
        tenant_id: tenantId,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Backup all active tenants (for daily cron)
  async backupAllTenants(): Promise<BackupSummary> {
    console.log(JSON.stringify({
      event: 'backup_all_start',
      timestamp: new Date().toISOString(),
    }));

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

    console.log(JSON.stringify({
      event: 'backup_all_complete',
      summary: {
        total: summary.total,
        succeeded: summary.succeeded,
        failed: summary.failed,
      },
      timestamp: new Date().toISOString(),
    }));

    return summary;
  }

  // Restore tenant from latest backup
  async restoreTenant(tenantId: string): Promise<{ success: boolean; message: string; config?: Tenant }> {
    try {
      console.log(JSON.stringify({
        event: 'restore_start',
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
      }));

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
        const parsedConfig = JSON.parse(configText);
        configData = parsedConfig.tenant;
      }

      console.log(JSON.stringify({
        event: 'restore_complete',
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
      }));

      return {
        success: true,
        message: 'Tenant restored successfully',
        config: configData,
      };
    } catch (error) {
      console.error(JSON.stringify({
        event: 'restore_failed',
        tenant_id: tenantId,
        error: error instanceof Error ? error.message : String(error),
      }));

      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Remove backups older than retention period
  async cleanupOldBackups(retentionDays: number = 30): Promise<{ deleted: number; errors: number }> {
    console.log(JSON.stringify({
      event: 'cleanup_start',
      retention_days: retentionDays,
      timestamp: new Date().toISOString(),
    }));

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

            console.log(JSON.stringify({
              event: 'backup_deleted',
              key: obj.key,
              uploaded: obj.uploaded,
            }));
          }
        } catch (error) {
          errors++;
          console.error(JSON.stringify({
            event: 'cleanup_error',
            key: obj.key,
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      }

      // Handle truncated results (if more than 1000 objects)
      if (listed.truncated) {
        console.log(JSON.stringify({
          event: 'cleanup_truncated',
          message: 'More than 1000 objects found, some may not be cleaned up',
        }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: 'cleanup_list_failed',
        error: error instanceof Error ? error.message : String(error),
      }));
      errors++;
    }

    console.log(JSON.stringify({
      event: 'cleanup_complete',
      deleted,
      errors,
      timestamp: new Date().toISOString(),
    }));

    return { deleted, errors };
  }
}

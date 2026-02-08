import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Database Schema', () => {
  const schemaPath = join(__dirname, '../../../src/db/schema.sql');
  const schemaV2Path = join(__dirname, '../../../src/db/schema-v2.sql');

  it('schema.sql exists and is not empty', () => {
    const content = readFileSync(schemaPath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  it('schema.sql contains all required tables', () => {
    const content = readFileSync(schemaPath, 'utf-8');
    const requiredTables = [
      'tenants', 'tenant_resources', 'usage_logs',
      'daily_usage', 'billing_plans', 'billing_subscriptions',
      'incidents', 'provisioning_logs'
    ];
    for (const table of requiredTables) {
      expect(content).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('schema-v2.sql exists and is not empty', () => {
    const content = readFileSync(schemaV2Path, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  it('schema-v2.sql contains all Phase 2 tables', () => {
    const content = readFileSync(schemaV2Path, 'utf-8');
    const requiredTables = [
      'onboarding_surveys', 'tenant_segments',
      'notifications', 'soul_versions', 'cron_logs'
    ];
    for (const table of requiredTables) {
      expect(content).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('schema.sql has required indexes', () => {
    const content = readFileSync(schemaPath, 'utf-8');
    expect(content).toContain('idx_tenants_status');
    expect(content).toContain('idx_tenants_subdomain');
    expect(content).toContain('idx_usage_logs_tenant_id_created_at');
    expect(content).toContain('idx_billing_subscriptions_tenant_id');
    expect(content).toContain('idx_billing_subscriptions_status');
    expect(content).toContain('idx_incidents_tenant_id');
  });

  it('schema-v2.sql has required indexes', () => {
    const content = readFileSync(schemaV2Path, 'utf-8');
    expect(content).toContain('idx_onboarding_surveys_tenant_id');
    expect(content).toContain('idx_notifications_tenant_id');
    expect(content).toContain('idx_soul_versions_tenant_id');
    expect(content).toContain('idx_cron_logs_job_name');
  });

  it('schema.sql seeds billing plans', () => {
    const content = readFileSync(schemaPath, 'utf-8');
    expect(content).toContain("'plan_starter'");
    expect(content).toContain("'plan_growth'");
    expect(content).toContain("'plan_enterprise'");
  });

  it('all tables use TEXT PRIMARY KEY', () => {
    const schema = readFileSync(schemaPath, 'utf-8');
    const schemaV2 = readFileSync(schemaV2Path, 'utf-8');
    const combined = schema + schemaV2;

    // All PRIMARY KEY definitions should be TEXT (UUID style)
    const tableMatches = combined.matchAll(/CREATE TABLE.*?\(([\s\S]*?)\);/g);
    for (const match of tableMatches) {
      const tableBody = match[1];
      if (tableBody.includes('PRIMARY KEY')) {
        // Either TEXT PRIMARY KEY or composite PRIMARY KEY
        const hasPrimaryKeyColumn = tableBody.includes('TEXT PRIMARY KEY');
        const hasCompositePK = tableBody.includes('PRIMARY KEY (');
        expect(hasPrimaryKeyColumn || hasCompositePK).toBe(true);
      }
    }
  });

  it('schema-v2.sql has new performance indexes', () => {
    const content = readFileSync(schemaV2Path, 'utf-8');
    expect(content).toContain('idx_cron_logs_status');
    expect(content).toContain('idx_soul_versions_tenant_active');
    expect(content).toContain('idx_notifications_type');
    expect(content).toContain('idx_tenant_segments_segment');
  });
});

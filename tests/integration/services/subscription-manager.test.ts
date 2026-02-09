import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { SubscriptionManager } from '../../../src/services/subscription-manager.js';
import { getSubscription, getTenant, getDailyUsage, getTenantUsageSummary } from '../../../src/db/queries.js';
import { listNotifications } from '../../../src/db/queries-v2.js';
import { SUBSCRIPTION_PERIOD_DAYS, GRACE_PERIOD_DAYS } from '../../../src/config/constants.js';

describe('SubscriptionManager Service', () => {
  let manager: SubscriptionManager;

  beforeAll(async () => {
    await setupTestDb();
    manager = new SubscriptionManager(env as any);
  });

  describe('createSubscription()', () => {
    it('creates subscription with correct fields', async () => {
      // Create test tenant
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_create_test', 'Create Test Corp', 'starter', 'provisioning', 'create-test', 'create@test.com').run();

      const subscription = await manager.createSubscription('tn_create_test', 'plan_growth', 'card_test123');

      expect(subscription).toBeDefined();
      expect(subscription.tenant_id).toBe('tn_create_test');
      expect(subscription.plan_id).toBe('plan_growth');
      expect(subscription.status).toBe('active');
      expect(subscription.payment_method).toBe('card_test123');
      expect(subscription.current_period_start).toBeDefined();
      expect(subscription.current_period_end).toBeDefined();
      expect(subscription.created_at).toBeDefined();
      expect(subscription.updated_at).toBeDefined();

      // Verify period is 30 days
      const startDate = new Date(subscription.current_period_start);
      const endDate = new Date(subscription.current_period_end);
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(SUBSCRIPTION_PERIOD_DAYS);

      // Verify tenant status was updated to active
      const tenant = await getTenant(env.DB, 'tn_create_test');
      expect(tenant?.status).toBe('active');
    });

    it('creates subscription without payment method', async () => {
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_create_no_pm', 'No Payment Test', 'starter', 'provisioning', 'no-payment', 'nopay@test.com').run();

      const subscription = await manager.createSubscription('tn_create_no_pm', 'plan_starter');

      expect(subscription.payment_method).toBeNull();
      expect(subscription.status).toBe('active');
    });
  });

  describe('cancelSubscription()', () => {
    it('sets status to canceled and sets grace period', async () => {
      // Create tenant and subscription
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_cancel_test', 'Cancel Test Corp', 'growth', 'active', 'cancel-test', 'cancel@test.com').run();

      const originalPeriodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_cancel', 'tn_cancel_test', 'plan_growth', 'active', new Date().toISOString(), originalPeriodEnd).run();

      await manager.cancelSubscription('tn_cancel_test');

      const subscription = await getSubscription(env.DB, 'tn_cancel_test');
      expect(subscription?.status).toBe('canceled');

      // Verify grace period is 7 days from now
      const gracePeriodEnd = new Date(subscription!.current_period_end);
      const now = new Date();
      const diffDays = Math.round((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(GRACE_PERIOD_DAYS - 1); // Allow 1 day tolerance
      expect(diffDays).toBeLessThanOrEqual(GRACE_PERIOD_DAYS + 1);

      // Verify notification was created
      const notifications = await listNotifications(env.DB, { tenantId: 'tn_cancel_test', type: 'cancellation' });
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].channel).toBe('email');
      expect(notifications[0].status).toBe('pending');
    });

    it('throws error when subscription not found', async () => {
      await expect(manager.cancelSubscription('tn_nonexistent')).rejects.toThrow('Subscription not found');
    });
  });

  describe('upgradeSubscription()', () => {
    it('changes plan_id and updates tenant plan', async () => {
      // Create tenant and subscription
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_upgrade_test', 'Upgrade Test Corp', 'starter', 'active', 'upgrade-test', 'upgrade@test.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_upgrade', 'tn_upgrade_test', 'plan_starter', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      await manager.upgradeSubscription('tn_upgrade_test', 'plan_enterprise');

      const subscription = await getSubscription(env.DB, 'tn_upgrade_test');
      expect(subscription?.plan_id).toBe('plan_enterprise');
      expect(subscription?.status).toBe('active');

      // Verify tenant plan was updated
      const tenant = await getTenant(env.DB, 'tn_upgrade_test');
      expect(tenant?.plan).toBe('enterprise');

      // Verify notification was created
      const notifications = await listNotifications(env.DB, { tenantId: 'tn_upgrade_test', type: 'upsell' });
      expect(notifications.length).toBeGreaterThan(0);
      const content = JSON.parse(notifications[0].content || '{}');
      expect(content.subject).toContain('Upgraded');
    });

    it('throws error when subscription not found', async () => {
      await expect(manager.upgradeSubscription('tn_nonexistent', 'plan_growth')).rejects.toThrow('Subscription not found');
    });
  });

  describe('downgradeSubscription()', () => {
    it('changes plan to lower tier', async () => {
      // Create tenant and subscription
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_downgrade_test', 'Downgrade Test Corp', 'enterprise', 'active', 'downgrade-test', 'downgrade@test.com').run();

      const periodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_downgrade', 'tn_downgrade_test', 'plan_enterprise', 'active', new Date().toISOString(), periodEnd).run();

      await manager.downgradeSubscription('tn_downgrade_test', 'plan_starter');

      const subscription = await getSubscription(env.DB, 'tn_downgrade_test');
      expect(subscription?.plan_id).toBe('plan_starter');

      // Verify tenant plan was updated
      const tenant = await getTenant(env.DB, 'tn_downgrade_test');
      expect(tenant?.plan).toBe('starter');

      // Verify notification was created
      const notifications = await listNotifications(env.DB, { tenantId: 'tn_downgrade_test', type: 'downgrade' });
      expect(notifications.length).toBeGreaterThan(0);
      const content = JSON.parse(notifications[0].content || '{}');
      expect(content.subject).toContain('Downgraded');
    });

    it('throws error when subscription not found', async () => {
      await expect(manager.downgradeSubscription('tn_nonexistent', 'plan_starter')).rejects.toThrow('Subscription not found');
    });
  });

  describe('checkOverage()', () => {
    it('detects when daily usage exceeds limits', async () => {
      // Create tenant and subscription
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_overage_daily', 'Daily Overage Test', 'starter', 'active', 'overage-daily', 'overage@test.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_overage_daily', 'tn_overage_daily', 'plan_starter', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      // Insert daily usage that exceeds starter plan daily limit (100,000)
      const today = new Date().toISOString().split('T')[0];
      await env.DB.prepare(
        `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost)
         VALUES (?, ?, ?, ?, ?)`
      ).bind('tn_overage_daily', today, 1000, 150000, 5.0).run();

      const overage = await manager.checkOverage('tn_overage_daily');

      expect(overage.exceeded).toBe(true);
      expect(overage.dailyUsage).toBe(150000);
      expect(overage.dailyLimit).toBe(100000);
      expect(overage.monthlyUsage).toBe(150000);
      expect(overage.monthlyLimit).toBe(2000000);
    });

    it('detects when monthly usage exceeds limits', async () => {
      // Create tenant and subscription
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_overage_monthly', 'Monthly Overage Test', 'starter', 'active', 'overage-monthly', 'monthly@test.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_overage_monthly', 'tn_overage_monthly', 'plan_starter', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      // Insert daily usage within the current month that exceeds monthly limit (2,000,000)
      // checkOverage only aggregates from month start (YYYY-MM-01) to today
      const today = new Date();
      const currentDay = today.getDate(); // e.g. 9 for Feb 9
      const tokensPerDay = Math.ceil(2100000 / currentDay); // ensure total exceeds 2M
      for (let i = 0; i < currentDay; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost)
           VALUES (?, ?, ?, ?, ?)`
        ).bind('tn_overage_monthly', dateStr, 100, tokensPerDay, 3.0).run();
      }

      const overage = await manager.checkOverage('tn_overage_monthly');

      expect(overage.exceeded).toBe(true);
      expect(overage.monthlyUsage).toBeGreaterThan(2000000);
      expect(overage.monthlyLimit).toBe(2000000);
    });

    it('returns false when usage is within limits', async () => {
      // Create tenant and subscription
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_within_limits', 'Within Limits Test', 'growth', 'active', 'within-limits', 'within@test.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_within_limits', 'tn_within_limits', 'plan_growth', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      // Insert daily usage well below growth plan limits (500,000 daily, 10,000,000 monthly)
      const today = new Date().toISOString().split('T')[0];
      await env.DB.prepare(
        `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost)
         VALUES (?, ?, ?, ?, ?)`
      ).bind('tn_within_limits', today, 500, 50000, 2.0).run();

      const overage = await manager.checkOverage('tn_within_limits');

      expect(overage.exceeded).toBe(false);
      expect(overage.dailyUsage).toBe(50000);
      expect(overage.dailyLimit).toBe(500000);
      expect(overage.monthlyUsage).toBe(50000);
      expect(overage.monthlyLimit).toBe(10000000);
    });

    it('uses default limits when no subscription exists', async () => {
      // Create tenant without subscription
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_no_sub', 'No Subscription Test', 'starter', 'active', 'no-sub', 'nosub@test.com').run();

      const today = new Date().toISOString().split('T')[0];
      await env.DB.prepare(
        `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost)
         VALUES (?, ?, ?, ?, ?)`
      ).bind('tn_no_sub', today, 100, 50000, 1.5).run();

      const overage = await manager.checkOverage('tn_no_sub');

      expect(overage.exceeded).toBe(false);
      expect(overage.dailyLimit).toBe(100000); // DEFAULT_DAILY_TOKEN_LIMIT
      expect(overage.monthlyLimit).toBe(3000000); // DEFAULT_MONTHLY_TOKEN_LIMIT (from constants.ts)
    });

    it('handles tenant with no usage data', async () => {
      // Create tenant and subscription
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_no_usage', 'No Usage Test', 'starter', 'active', 'no-usage', 'nousage@test.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_no_usage', 'tn_no_usage', 'plan_starter', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      const overage = await manager.checkOverage('tn_no_usage');

      expect(overage.exceeded).toBe(false);
      expect(overage.dailyUsage).toBe(0);
      expect(overage.monthlyUsage).toBe(0);
    });
  });

  describe('suspendForNonPayment()', () => {
    it('sets tenant status to suspended', async () => {
      // Create tenant and subscription
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_suspend_test', 'Suspend Test Corp', 'growth', 'active', 'suspend-test', 'suspend@test.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_suspend', 'tn_suspend_test', 'plan_growth', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      await manager.suspendForNonPayment('tn_suspend_test');

      // Verify tenant status is suspended
      const tenant = await getTenant(env.DB, 'tn_suspend_test');
      expect(tenant?.status).toBe('suspended');

      // Verify subscription status is past_due
      const subscription = await getSubscription(env.DB, 'tn_suspend_test');
      expect(subscription?.status).toBe('past_due');

      // Verify notification was created
      const notifications = await listNotifications(env.DB, { tenantId: 'tn_suspend_test', type: 'payment_failed' });
      expect(notifications.length).toBeGreaterThan(0);
      const content = JSON.parse(notifications[0].content || '{}');
      expect(content.subject).toContain('Suspended');
      expect(content.body).toContain('non-payment');
    });

    it('throws error when subscription not found', async () => {
      await expect(manager.suspendForNonPayment('tn_nonexistent')).rejects.toThrow('Subscription not found');
    });
  });
});

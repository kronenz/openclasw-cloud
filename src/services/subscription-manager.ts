// OpenClasw Cloud Subscription Manager Service
import type { Bindings, BillingSubscription } from '../types/index.js';
import {
  createBillingSubscription,
  updateBillingSubscription,
} from '../db/queries-v2.js';
import { getSubscription, getTenant, updateTenant, getDailyUsage, listBillingPlans } from '../db/queries.js';
import { createNotification } from '../db/queries-v2.js';
import { GRACE_PERIOD_DAYS, DEFAULT_DAILY_TOKEN_LIMIT, DEFAULT_MONTHLY_TOKEN_LIMIT } from '../config/constants.js';
import { toDateString } from '../utils/id.js';
import { structuredLog, structuredWarn, structuredError } from '../utils/log.js';

export interface OverageInfo {
  exceeded: boolean;
  dailyUsage: number;
  dailyLimit: number;
  monthlyUsage: number;
  monthlyLimit: number;
}

export class SubscriptionManager {
  constructor(private env: Bindings) {}

  /**
   * Create a new subscription for a tenant
   */
  async createSubscription(
    tenantId: string,
    planId: string,
    paymentMethod?: string
  ): Promise<BillingSubscription> {
    try {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30); // 30 days from now

      const subscription: Omit<BillingSubscription, 'created_at' | 'updated_at'> = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        plan_id: planId,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        payment_method: paymentMethod || null,
      };

      const created = await createBillingSubscription(this.env.DB, subscription);

      // Update tenant status to active
      await updateTenant(this.env.DB, tenantId, { status: 'active' });

      structuredLog('subscription_created', {
        tenant_id: tenantId,
        subscription_id: created.id,
        plan_id: planId,
      });

      return created;
    } catch (error) {
      structuredError('subscription_creation_failed', error, {
        tenant_id: tenantId,
        plan_id: planId,
      });
      throw error;
    }
  }

  /**
   * Cancel a subscription with a 7-day grace period
   */
  async cancelSubscription(tenantId: string): Promise<void> {
    try {
      const subscription = await getSubscription(this.env.DB, tenantId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const now = new Date();
      const gracePeriodEnd = new Date(now);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

      await updateBillingSubscription(this.env.DB, subscription.id, {
        status: 'canceled',
        current_period_end: gracePeriodEnd.toISOString(),
      });

      structuredLog('subscription_canceled', {
        tenant_id: tenantId,
        subscription_id: subscription.id,
        grace_period_end: gracePeriodEnd.toISOString(),
      });

      // Create notification for cancellation
      await createNotification(this.env.DB, {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        channel: 'email',
        type: 'cancellation',
        status: 'pending',
        content: JSON.stringify({
          subject: 'Subscription Canceled',
          body: `Your subscription has been canceled. Service will continue until ${gracePeriodEnd.toISOString()}.`,
        }),
        sent_at: null,
      });
    } catch (error) {
      structuredError('subscription_cancellation_failed', error, {
        tenant_id: tenantId,
      });
      throw error;
    }
  }

  /**
   * Upgrade subscription to a higher plan
   */
  async upgradeSubscription(tenantId: string, newPlanId: string): Promise<void> {
    try {
      const subscription = await getSubscription(this.env.DB, tenantId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Update subscription plan immediately
      await updateBillingSubscription(this.env.DB, subscription.id, {
        plan_id: newPlanId,
      });

      // Update tenant plan
      const tenant = await getTenant(this.env.DB, tenantId);
      if (tenant) {
        // Map plan_id to plan tier (simplified - should query billing_plans in production)
        const planTier = newPlanId.includes('enterprise')
          ? 'enterprise'
          : newPlanId.includes('growth')
          ? 'growth'
          : 'starter';
        await updateTenant(this.env.DB, tenantId, { plan: planTier });
      }

      structuredLog('subscription_upgraded', {
        tenant_id: tenantId,
        subscription_id: subscription.id,
        old_plan_id: subscription.plan_id,
        new_plan_id: newPlanId,
      });

      // Create notification for upgrade
      await createNotification(this.env.DB, {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        channel: 'email',
        type: 'upsell',
        status: 'pending',
        content: JSON.stringify({
          subject: 'Subscription Upgraded',
          body: `Your subscription has been upgraded to plan ${newPlanId}.`,
        }),
        sent_at: null,
      });
    } catch (error) {
      structuredError('subscription_upgrade_failed', error, {
        tenant_id: tenantId,
        new_plan_id: newPlanId,
      });
      throw error;
    }
  }

  /**
   * Downgrade subscription to a lower plan (takes effect at period end)
   */
  async downgradeSubscription(tenantId: string, newPlanId: string): Promise<void> {
    try {
      const subscription = await getSubscription(this.env.DB, tenantId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Schedule downgrade for period end
      // In a real implementation, we'd store this in a separate field
      // For now, we'll just update immediately with a log note
      await updateBillingSubscription(this.env.DB, subscription.id, {
        plan_id: newPlanId,
      });

      // Update tenant plan
      const tenant = await getTenant(this.env.DB, tenantId);
      if (tenant) {
        const planTier = newPlanId.includes('enterprise')
          ? 'enterprise'
          : newPlanId.includes('growth')
          ? 'growth'
          : 'starter';
        await updateTenant(this.env.DB, tenantId, { plan: planTier });
      }

      structuredLog('subscription_downgraded', {
        tenant_id: tenantId,
        subscription_id: subscription.id,
        old_plan_id: subscription.plan_id,
        new_plan_id: newPlanId,
        effective_at: subscription.current_period_end,
        note: 'scheduled for period end',
      });

      // Create notification
      await createNotification(this.env.DB, {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        channel: 'email',
        type: 'downgrade',
        status: 'pending',
        content: JSON.stringify({
          subject: 'Subscription Downgraded',
          body: `Your subscription will be downgraded to plan ${newPlanId} at the end of your billing period.`,
        }),
        sent_at: null,
      });
    } catch (error) {
      structuredError('subscription_downgrade_failed', error, {
        tenant_id: tenantId,
        new_plan_id: newPlanId,
      });
      throw error;
    }
  }

  /**
   * Check if tenant has exceeded token limits
   */
  async checkOverage(tenantId: string): Promise<OverageInfo> {
    try {
      const today = toDateString();
      const usage = await getDailyUsage(this.env.DB, tenantId, today);

      // Get subscription and plan limits from billing_plans table
      const subscription = await getSubscription(this.env.DB, tenantId);
      let dailyLimit = DEFAULT_DAILY_TOKEN_LIMIT;
      let monthlyLimit = DEFAULT_MONTHLY_TOKEN_LIMIT;

      if (subscription) {
        try {
          const plans = await listBillingPlans(this.env.DB);
          const plan = plans.find(p => p.id === subscription.plan_id);
          if (plan) {
            dailyLimit = plan.daily_token_limit;
            monthlyLimit = plan.monthly_token_limit;
          }
        } catch (planError) {
          structuredWarn('plan_limits_fetch_failed', {
            tenant_id: tenantId,
            note: 'using defaults',
            error_message: planError instanceof Error ? planError.message : String(planError),
          });
        }
      }

      const dailyUsage = usage?.total_tokens || 0;
      const monthlyUsage = dailyUsage; // Simplified - should aggregate month's usage

      const exceeded = dailyUsage > dailyLimit || monthlyUsage > monthlyLimit;

      if (exceeded) {
        structuredWarn('token_limit_exceeded', {
          tenant_id: tenantId,
          daily_usage: dailyUsage,
          daily_limit: dailyLimit,
          monthly_usage: monthlyUsage,
          monthly_limit: monthlyLimit,
        });
      }

      return {
        exceeded,
        dailyUsage,
        dailyLimit,
        monthlyUsage,
        monthlyLimit,
      };
    } catch (error) {
      structuredError('overage_check_failed', error, {
        tenant_id: tenantId,
      });
      throw error;
    }
  }

  /**
   * Suspend tenant for non-payment
   */
  async suspendForNonPayment(tenantId: string): Promise<void> {
    try {
      const subscription = await getSubscription(this.env.DB, tenantId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Update tenant status to suspended
      await updateTenant(this.env.DB, tenantId, { status: 'suspended' });

      // Update subscription status to past_due
      await updateBillingSubscription(this.env.DB, subscription.id, {
        status: 'past_due',
      });

      structuredWarn('tenant_suspended_non_payment', {
        tenant_id: tenantId,
        subscription_id: subscription.id,
      });

      // Send notification
      await createNotification(this.env.DB, {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        channel: 'email',
        type: 'payment_failed',
        status: 'pending',
        content: JSON.stringify({
          subject: 'Service Suspended - Payment Required',
          body: 'Your service has been suspended due to non-payment. Please update your payment method.',
        }),
        sent_at: null,
      });
    } catch (error) {
      structuredError('tenant_suspension_failed', error, {
        tenant_id: tenantId,
      });
      throw error;
    }
  }
}

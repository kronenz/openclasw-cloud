import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, Variables, ApiResponse, BillingPlan, BillingSubscription } from '../types/index.js';
import { listBillingPlans, getSubscription, getTenantUsageSummary } from '../db/queries.js';
import { updateTenant } from '../db/queries.js';
import { createNotification } from '../db/queries-v2.js';
import { SubscriptionManager } from '../services/subscription-manager.js';

const billing = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Portone webhook payload type
interface PortoneWebhookPayload {
  type: string;
  metadata?: { tenant_id?: string; plan_id?: string };
  tenant_id?: string;
  plan_id?: string;
  amount?: number;
  [key: string]: unknown;
}

// Validation schemas
const upgradePlanSchema = z.object({
  new_plan_id: z.enum(['plan_starter', 'plan_growth', 'plan_enterprise']),
});

// GET /plans - list all billing plans
billing.get('/plans', async (c) => {
  try {
    const plans = await listBillingPlans(c.env.DB);

    return c.json<ApiResponse<BillingPlan[]>>({
      success: true,
      data: plans,
    });
  } catch (e) {
    console.error('Failed to list billing plans:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to list billing plans',
      code: 'BILLING_PLANS_FAILED',
    }, 500);
  }
});

// GET /subscription - get current subscription for tenant
billing.get('/subscription', async (c) => {
  try {
    const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

    if (!tenantId) {
      return c.json<ApiResponse>({
        success: false,
        error: 'tenant_id is required',
        code: 'MISSING_TENANT_ID',
      }, 400);
    }

    const subscription = await getSubscription(c.env.DB, tenantId);

    if (!subscription) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND',
      }, 404);
    }

    return c.json<ApiResponse<BillingSubscription>>({
      success: true,
      data: subscription,
    });
  } catch (e) {
    console.error('Failed to get subscription:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get subscription',
      code: 'GET_SUBSCRIPTION_FAILED',
    }, 500);
  }
});

// POST /subscription/upgrade - upgrade to a higher plan
billing.post('/subscription/upgrade', async (c) => {
  try {
    const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

    if (!tenantId) {
      return c.json<ApiResponse>({
        success: false,
        error: 'tenant_id is required',
        code: 'MISSING_TENANT_ID',
      }, 400);
    }

    const body = await c.req.json();
    const parsed = upgradePlanSchema.safeParse(body);

    if (!parsed.success) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request body',
        code: 'INVALID_REQUEST',
        details: parsed.error.errors,
      }, 400);
    }

    const manager = new SubscriptionManager(c.env);
    await manager.upgradeSubscription(tenantId, parsed.data.new_plan_id);

    return c.json<ApiResponse>({
      success: true,
      data: { message: 'Subscription upgraded successfully' },
    });
  } catch (e) {
    console.error('Failed to upgrade subscription:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to upgrade subscription',
      code: 'UPGRADE_FAILED',
    }, 500);
  }
});

// POST /subscription/cancel - cancel subscription
billing.post('/subscription/cancel', async (c) => {
  try {
    const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

    if (!tenantId) {
      return c.json<ApiResponse>({
        success: false,
        error: 'tenant_id is required',
        code: 'MISSING_TENANT_ID',
      }, 400);
    }

    const manager = new SubscriptionManager(c.env);
    await manager.cancelSubscription(tenantId);

    return c.json<ApiResponse>({
      success: true,
      data: { message: 'Subscription canceled. Service will continue for 7 days.' },
    });
  } catch (e) {
    console.error('Failed to cancel subscription:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to cancel subscription',
      code: 'CANCEL_FAILED',
    }, 500);
  }
});

// GET /invoices - list invoices (placeholder)
billing.get('/invoices', async (c) => {
  try {
    const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

    if (!tenantId) {
      return c.json<ApiResponse>({
        success: false,
        error: 'tenant_id is required',
        code: 'MISSING_TENANT_ID',
      }, 400);
    }

    // Placeholder: In production, query invoices table or aggregate from billing_subscriptions
    const subscription = await getSubscription(c.env.DB, tenantId);

    const invoices = subscription ? [{
      id: subscription.id,
      tenant_id: subscription.tenant_id,
      amount: 0, // Would come from billing_plans
      period_start: subscription.current_period_start,
      period_end: subscription.current_period_end,
      status: subscription.status,
      created_at: subscription.created_at,
    }] : [];

    return c.json<ApiResponse>({
      success: true,
      data: invoices,
    });
  } catch (e) {
    console.error('Failed to list invoices:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to list invoices',
      code: 'LIST_INVOICES_FAILED',
    }, 500);
  }
});

// GET /usage - get usage-based billing summary for current period
billing.get('/usage', async (c) => {
  try {
    const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

    if (!tenantId) {
      return c.json<ApiResponse>({
        success: false,
        error: 'tenant_id is required',
        code: 'MISSING_TENANT_ID',
      }, 400);
    }

    const subscription = await getSubscription(c.env.DB, tenantId);

    if (!subscription) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND',
      }, 404);
    }

    // Get usage for current billing period
    const startDate = subscription.current_period_start.split('T')[0];
    const endDate = subscription.current_period_end.split('T')[0];

    const usage = await getTenantUsageSummary(c.env.DB, tenantId, startDate, endDate);

    const totalTokens = usage.reduce((sum, day) => sum + day.total_tokens, 0);
    const totalCost = usage.reduce((sum, day) => sum + day.total_cost, 0);
    const totalRequests = usage.reduce((sum, day) => sum + day.total_requests, 0);

    return c.json<ApiResponse>({
      success: true,
      data: {
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
        total_tokens: totalTokens,
        total_cost: totalCost,
        total_requests: totalRequests,
        daily_breakdown: usage,
      },
    });
  } catch (e) {
    console.error('Failed to get usage:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get usage',
      code: 'GET_USAGE_FAILED',
    }, 500);
  }
});

// POST /webhook - handle payment webhook from Portone
billing.post('/webhook', async (c) => {
  try {
    const signature = c.req.header('X-Portone-Signature');
    const webhookSecret = c.env.PORTONE_WEBHOOK_SECRET;

    let payload: PortoneWebhookPayload;

    // Verify webhook signature
    if (webhookSecret && signature) {
      const body = await c.req.text();
      const expectedSignature = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(webhookSecret + body)
      );
      const expectedHex = Array.from(new Uint8Array(expectedSignature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Use constant-time comparison to prevent timing attacks
      const sigBytes = new TextEncoder().encode(signature);
      const expBytes = new TextEncoder().encode(expectedHex);
      if (sigBytes.length !== expBytes.length || !crypto.subtle.timingSafeEqual(sigBytes, expBytes)) {
        console.warn('Invalid webhook signature');
        return c.json<ApiResponse>({
          success: false,
          error: 'Invalid signature',
          code: 'INVALID_SIGNATURE',
        }, 401);
      }

      try {
        payload = JSON.parse(body);
      } catch (parseError) {
        console.error('Invalid JSON in webhook payload:', parseError);
        return c.json<ApiResponse>({
          success: false,
          error: 'Invalid JSON payload',
          code: 'INVALID_PAYLOAD',
        }, 400);
      }
    } else if (!webhookSecret) {
      // Webhook secret not configured - reject for security
      return c.json<ApiResponse>({
        success: false,
        error: 'Webhook verification not configured',
        code: 'CONFIGURATION_ERROR',
      }, 503);
    } else {
      // Signature missing but secret is configured
      return c.json<ApiResponse>({
        success: false,
        error: 'Missing webhook signature',
        code: 'INVALID_SIGNATURE',
      }, 401);
    }

    const manager = new SubscriptionManager(c.env);

    // Handle payment events
    switch (payload.type) {
      case 'payment.paid': {
        console.log('Payment successful:', payload);

        const tenantId = payload.metadata?.tenant_id || payload.tenant_id;
        const planId = payload.metadata?.plan_id || payload.plan_id;

        if (!tenantId) {
          console.error('No tenant_id in payment.paid webhook');
          break;
        }

        // Create or activate subscription
        const existingSub = await getSubscription(c.env.DB, tenantId);

        if (!existingSub) {
          // Create new subscription
          await manager.createSubscription(tenantId, planId || 'plan_starter');
        } else {
          // Reactivate if suspended
          await updateTenant(c.env.DB, tenantId, { status: 'active' });
        }

        // Send welcome notification
        await createNotification(c.env.DB, {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          channel: 'email',
          type: 'welcome',
          status: 'pending',
          content: JSON.stringify({
            subject: 'Payment Received',
            body: 'Your payment has been processed successfully. Thank you!',
          }),
          sent_at: null,
        });
        break;
      }

      case 'payment.failed': {
        console.log('Payment failed:', payload);

        const tenantId = payload.metadata?.tenant_id || payload.tenant_id;

        if (!tenantId) {
          console.error('No tenant_id in payment.failed webhook');
          break;
        }

        // Send payment failed notification
        await createNotification(c.env.DB, {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          channel: 'email',
          type: 'payment_failed',
          status: 'pending',
          content: JSON.stringify({
            subject: 'Payment Failed',
            body: 'Your payment could not be processed. Please update your payment method.',
          }),
          sent_at: null,
        });
        break;
      }

      case 'payment.canceled': {
        console.log('Payment canceled:', payload);

        const tenantId = payload.metadata?.tenant_id || payload.tenant_id;

        if (!tenantId) {
          console.error('No tenant_id in payment.canceled webhook');
          break;
        }

        // Cancel subscription with grace period
        await manager.cancelSubscription(tenantId);
        break;
      }

      default:
        console.log('Unknown webhook event:', payload.type);
    }

    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  } catch (e) {
    console.error('Failed to process webhook:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to process webhook',
      code: 'WEBHOOK_FAILED',
    }, 500);
  }
});

export { billing };

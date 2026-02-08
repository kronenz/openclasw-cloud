import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, Variables, ApiResponse, BillingPlan, BillingSubscription } from '../types/index.js';
import { listBillingPlans, getSubscription, getTenantUsageSummary } from '../db/queries.js';
import { updateTenant } from '../db/queries.js';
import { createNotification } from '../db/queries-v2.js';
import { SubscriptionManager } from '../services/subscription-manager.js';
import { BILLING_PLAN_IDS, ERROR_CODES } from '../config/constants.js';
import { structuredLog, structuredWarn, structuredError } from '../utils/log.js';
import { withErrorHandler, validationError } from '../utils/error-handler.js';

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
  new_plan_id: z.enum([...BILLING_PLAN_IDS]),
});

// GET /plans - list all billing plans
billing.get('/plans', withErrorHandler('billing_plans_list_failed', async (c) => {
  const plans = await listBillingPlans(c.env.DB);

  return c.json<ApiResponse<BillingPlan[]>>({
    success: true,
    data: plans,
  });
}));

// GET /subscription - get current subscription for tenant
billing.get('/subscription', withErrorHandler('billing_subscription_get_failed', async (c) => {
  const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

  if (!tenantId) {
    return validationError(c, 'tenant_id is required');
  }

  const subscription = await getSubscription(c.env.DB, tenantId);

  if (!subscription) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Subscription not found',
      code: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
    }, 404);
  }

  return c.json<ApiResponse<BillingSubscription>>({
    success: true,
    data: subscription,
  });
}));

// POST /subscription/upgrade - upgrade to a higher plan
billing.post('/subscription/upgrade', withErrorHandler('billing_subscription_upgrade_failed', async (c) => {
  const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

  if (!tenantId) {
    return validationError(c, 'tenant_id is required');
  }

  const body = await c.req.json();
  const parsed = upgradePlanSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Invalid request body', parsed.error.errors);
  }

  const manager = new SubscriptionManager(c.env);
  await manager.upgradeSubscription(tenantId, parsed.data.new_plan_id);

  return c.json<ApiResponse>({
    success: true,
    data: { message: 'Subscription upgraded successfully' },
  });
}));

// POST /subscription/cancel - cancel subscription
billing.post('/subscription/cancel', withErrorHandler('billing_subscription_cancel_failed', async (c) => {
  const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

  if (!tenantId) {
    return validationError(c, 'tenant_id is required');
  }

  const manager = new SubscriptionManager(c.env);
  await manager.cancelSubscription(tenantId);

  return c.json<ApiResponse>({
    success: true,
    data: { message: 'Subscription canceled. Service will continue for 7 days.' },
  });
}));

// GET /invoices - list invoices (placeholder)
billing.get('/invoices', withErrorHandler('billing_invoices_list_failed', async (c) => {
  const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

  if (!tenantId) {
    return validationError(c, 'tenant_id is required');
  }

  const subscription = await getSubscription(c.env.DB, tenantId);

  // Look up plan price for invoice amount
  const plans = await listBillingPlans(c.env.DB);
  const plan = subscription ? plans.find(p => p.id === subscription.plan_id) : undefined;

  const invoices = subscription ? [{
    id: subscription.id,
    tenant_id: subscription.tenant_id,
    amount: plan?.monthly_price || 0,
    period_start: subscription.current_period_start,
    period_end: subscription.current_period_end,
    status: subscription.status,
    created_at: subscription.created_at,
  }] : [];

  return c.json<ApiResponse>({
    success: true,
    data: invoices,
  });
}));

// GET /usage - get usage-based billing summary for current period
billing.get('/usage', withErrorHandler('billing_usage_get_failed', async (c) => {
  const tenantId = c.req.query('tenant_id') || c.get('tenantId') || '';

  if (!tenantId) {
    return validationError(c, 'tenant_id is required');
  }

  const subscription = await getSubscription(c.env.DB, tenantId);

  if (!subscription) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Subscription not found',
      code: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
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
}));

// POST /webhook - handle payment webhook from Portone
billing.post('/webhook', withErrorHandler('billing_webhook_process_failed', async (c) => {
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
      structuredWarn('webhook_invalid_signature');
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid signature',
        code: ERROR_CODES.INVALID_SIGNATURE,
      }, 401);
    }

    try {
      payload = JSON.parse(body);
    } catch (parseError) {
      structuredError('webhook_invalid_json', parseError);
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid JSON payload',
        code: ERROR_CODES.INVALID_PAYLOAD,
      }, 400);
    }
  } else if (!webhookSecret) {
    // Webhook secret not configured - reject for security
    return c.json<ApiResponse>({
      success: false,
      error: 'Webhook verification not configured',
      code: ERROR_CODES.CONFIGURATION_ERROR,
    }, 503);
  } else {
    // Signature missing but secret is configured
    return c.json<ApiResponse>({
      success: false,
      error: 'Missing webhook signature',
      code: ERROR_CODES.INVALID_SIGNATURE,
    }, 401);
  }

  const manager = new SubscriptionManager(c.env);

  // Handle payment events
  switch (payload.type) {
    case 'payment.paid': {
      const tenantId = payload.metadata?.tenant_id || payload.tenant_id;
      const planId = payload.metadata?.plan_id || payload.plan_id;

      structuredLog('webhook_payment_paid', { tenant_id: tenantId, plan_id: planId });

      if (!tenantId) {
        structuredError('webhook_missing_tenant_id', new Error('Missing tenant_id'), { event: 'payment.paid' });
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
      const tenantId = payload.metadata?.tenant_id || payload.tenant_id;

      structuredLog('webhook_payment_failed', { tenant_id: tenantId });

      if (!tenantId) {
        structuredError('webhook_missing_tenant_id', new Error('Missing tenant_id'), { event: 'payment.failed' });
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
      const tenantId = payload.metadata?.tenant_id || payload.tenant_id;

      structuredLog('webhook_payment_canceled', { tenant_id: tenantId });

      if (!tenantId) {
        structuredError('webhook_missing_tenant_id', new Error('Missing tenant_id'), { event: 'payment.canceled' });
        break;
      }

      // Cancel subscription with grace period
      await manager.cancelSubscription(tenantId);
      break;
    }

    default:
      structuredWarn('webhook_unknown_event', { type: payload.type });
  }

  return c.json<ApiResponse>({
    success: true,
    data: { received: true },
  });
}));

export { billing };

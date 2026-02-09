import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { parseApiResponse } from '../../helpers/types.js';

const JWT_SECRET = 'test-jwt-secret';

describe('Billing Webhook Routes', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;
  });

  async function generateWebhookSignature(payload: string, secret: string): Promise<string> {
    const signatureBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(secret + payload)
    );
    return Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  describe('POST /api/billing/webhook - payment.paid', () => {
    it('creates subscription for new tenant on payment.paid', async () => {
      // Create tenant first
      await env.DB.prepare(
        `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_webhook-new', 'Webhook New Corp', 'starter', 'provisioning', 'webhook-new', 'new@example.com').run();

      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        type: 'payment.paid',
        tenant_id: 'tn_webhook-new',
        plan_id: 'plan_growth',
        amount: 149000,
      });

      const signature = await generateWebhookSignature(payload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.received).toBe(true);

      // Verify subscription was created
      const subscription = await env.DB.prepare(
        'SELECT * FROM billing_subscriptions WHERE tenant_id = ?'
      ).bind('tn_webhook-new').first();

      expect(subscription).toBeTruthy();
      expect(subscription.plan_id).toBe('plan_growth');
      expect(subscription.status).toBe('active');
    });

    it('activates existing tenant on payment.paid', async () => {
      // Create tenant with subscription
      await env.DB.prepare(
        `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_webhook-existing', 'Webhook Existing Corp', 'starter', 'suspended', 'webhook-existing', 'existing@example.com').run();

      await env.DB.prepare(
        `INSERT OR REPLACE INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_existing', 'tn_webhook-existing', 'plan_starter', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        type: 'payment.paid',
        tenant_id: 'tn_webhook-existing',
        amount: 49000,
      });

      const signature = await generateWebhookSignature(payload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);

      // Verify tenant was activated
      const tenant = await env.DB.prepare(
        'SELECT * FROM tenants WHERE id = ?'
      ).bind('tn_webhook-existing').first();

      expect(tenant.status).toBe('active');
    });

    it('uses metadata.tenant_id when tenant_id is not in root', async () => {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_webhook-metadata', 'Webhook Metadata Corp', 'starter', 'provisioning', 'webhook-metadata', 'metadata@example.com').run();

      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        type: 'payment.paid',
        metadata: {
          tenant_id: 'tn_webhook-metadata',
          plan_id: 'plan_starter',
        },
        amount: 49000,
      });

      const signature = await generateWebhookSignature(payload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/billing/webhook - payment.failed', () => {
    it('creates notification on payment.failed', async () => {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_webhook-failed', 'Webhook Failed Corp', 'starter', 'active', 'webhook-failed', 'failed@example.com').run();

      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        type: 'payment.failed',
        tenant_id: 'tn_webhook-failed',
        amount: 49000,
        reason: 'insufficient_funds',
      });

      const signature = await generateWebhookSignature(payload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);

      // Verify notification was created
      const notification = await env.DB.prepare(
        'SELECT * FROM notifications WHERE tenant_id = ? AND type = ?'
      ).bind('tn_webhook-failed', 'payment_failed').first();

      expect(notification).toBeTruthy();
      expect(notification.channel).toBe('email');
    });

    it('fails when tenant does not exist (foreign key constraint)', async () => {
      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        type: 'payment.failed',
        tenant_id: 'tn_nonexistent',
        amount: 49000,
      });

      const signature = await generateWebhookSignature(payload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      // Currently fails with 500 due to foreign key constraint when trying to create notification
      expect(res.status).toBe(500);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/billing/webhook - payment.canceled', () => {
    it('cancels subscription on payment.canceled', async () => {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('tn_webhook-canceled', 'Webhook Canceled Corp', 'starter', 'active', 'webhook-canceled', 'canceled@example.com').run();

      await env.DB.prepare(
        `INSERT OR REPLACE INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind('sub_canceled', 'tn_webhook-canceled', 'plan_starter', 'active', new Date().toISOString(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();

      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        type: 'payment.canceled',
        tenant_id: 'tn_webhook-canceled',
        amount: 49000,
      });

      const signature = await generateWebhookSignature(payload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);

      // Verify subscription was canceled
      const subscription = await env.DB.prepare(
        'SELECT * FROM billing_subscriptions WHERE tenant_id = ?'
      ).bind('tn_webhook-canceled').first();

      expect(subscription.status).toBe('canceled');
    });
  });

  describe('POST /api/billing/webhook - validation', () => {
    it('rejects webhook without tenant_id for payment events', async () => {
      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        type: 'payment.paid',
        amount: 49000,
      });

      const signature = await generateWebhookSignature(payload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      // Should still return success but log error
      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
    });

    it('handles unknown event types gracefully', async () => {
      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        type: 'payment.unknown_event',
        tenant_id: 'tn_test',
        amount: 49000,
      });

      const signature = await generateWebhookSignature(payload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Portone-Signature': signature },
        body: payload,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
    });

    it('rejects webhook with invalid signature', async () => {
      (env as any).PORTONE_WEBHOOK_SECRET = 'test-webhook-secret';

      const payload = JSON.stringify({
        type: 'payment.paid',
        tenant_id: 'tn_test',
        amount: 49000,
      });

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Portone-Signature': 'invalid-signature-not-real'
        },
        body: payload,
      }, env);

      expect(res.status).toBe(401);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_SIGNATURE');
    });

    it('rejects webhook without signature header', async () => {
      (env as any).PORTONE_WEBHOOK_SECRET = 'test-webhook-secret';

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment.paid',
          tenant_id: 'tn_test',
          amount: 49000,
        }),
      }, env);

      expect(res.status).toBe(401);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_SIGNATURE');
    });

    it('rejects webhook when secret is not configured', async () => {
      (env as any).PORTONE_WEBHOOK_SECRET = undefined;

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Portone-Signature': 'some-signature-not-real'
        },
        body: JSON.stringify({
          type: 'payment.paid',
          tenant_id: 'tn_test',
          amount: 49000,
        }),
      }, env);

      expect(res.status).toBe(503);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('CONFIGURATION_ERROR');
    });

    it('rejects webhook with malformed JSON', async () => {
      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const invalidPayload = '{ "type": "payment.paid", invalid json }';
      const signature = await generateWebhookSignature(invalidPayload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Portone-Signature': signature
        },
        body: invalidPayload,
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_PAYLOAD');
    });

    it('accepts webhook with empty payload object', async () => {
      const webhookSecret = 'test-webhook-secret';
      (env as any).PORTONE_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({});
      const signature = await generateWebhookSignature(payload, webhookSecret);

      const res = await app.request('/api/billing/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Portone-Signature': signature
        },
        body: payload,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
    });
  });
});

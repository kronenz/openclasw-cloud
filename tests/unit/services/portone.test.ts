import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PortOneClient } from '../../../src/services/portone.js';
import type { Bindings } from '../../../src/types/index.js';

function createMockEnv(portoneApiKey?: string): Bindings {
  const env: any = {
    DB: {} as any,
    STORAGE: {} as any,
    CACHE: {} as any,
    SESSIONS: {} as any,
    AI: {} as any,
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'debug',
    AI_GATEWAY_ENDPOINT: 'https://test.ai.cloudflare.com',
    JWT_SECRET: 'test-secret',
  };

  if (portoneApiKey) {
    env.PORTONE_API_KEY = portoneApiKey;
  }

  return env;
}

describe('PortOneClient', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('createCheckoutUrl', () => {
    it('creates checkout URL successfully', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ checkout_url: 'https://payment.portone.io/checkout/abc123' }),
      });
      global.fetch = fetchMock;

      const result = await client.createCheckoutUrl({
        tenantId: 'tn_test123',
        planId: 'starter',
        amount: 50000,
        orderName: 'Starter Plan',
      });

      expect(result).toBe('https://payment.portone.io/checkout/abc123');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.portone.io/v2/payments/prepare',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-portone-key',
          },
        })
      );

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.amount).toBe(50000);
      expect(callBody.name).toBe('Starter Plan');
      expect(callBody.metadata.tenant_id).toBe('tn_test123');
      expect(callBody.metadata.plan_id).toBe('starter');
    });

    it('generates unique merchant_uid with timestamp', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ checkout_url: 'https://payment.portone.io/checkout/abc123' }),
      });
      global.fetch = fetchMock;

      await client.createCheckoutUrl({
        tenantId: 'tn_test123',
        planId: 'starter',
        amount: 50000,
        orderName: 'Starter Plan',
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.merchant_uid).toMatch(/^order_tn_test123_\d+$/);
    });

    it('returns empty string when checkout_url is missing', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      global.fetch = fetchMock;

      const result = await client.createCheckoutUrl({
        tenantId: 'tn_test123',
        planId: 'starter',
        amount: 50000,
        orderName: 'Starter Plan',
      });

      expect(result).toBe('');
    });

    it('throws error when API returns non-ok response', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });
      global.fetch = fetchMock;

      await expect(
        client.createCheckoutUrl({
          tenantId: 'tn_test123',
          planId: 'starter',
          amount: 50000,
          orderName: 'Starter Plan',
        })
      ).rejects.toThrow('PortOne API error: 401 Invalid API key');
    });

    it('throws error when network fails', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      await expect(
        client.createCheckoutUrl({
          tenantId: 'tn_test123',
          planId: 'starter',
          amount: 50000,
          orderName: 'Starter Plan',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('processRefund', () => {
    it('processes refund successfully', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = fetchMock;

      await client.processRefund({
        paymentId: 'pay_123',
        amount: 30000,
        reason: 'Customer requested refund',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.portone.io/v2/payments/pay_123/cancel',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-portone-key',
          },
        })
      );

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.amount).toBe(30000);
      expect(callBody.reason).toBe('Customer requested refund');
    });

    it('throws error when refund fails', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Payment already refunded',
      });
      global.fetch = fetchMock;

      await expect(
        client.processRefund({
          paymentId: 'pay_123',
          amount: 30000,
          reason: 'Customer requested refund',
        })
      ).rejects.toThrow('PortOne API error: 400 Payment already refunded');
    });

    it('handles network errors during refund', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockRejectedValue(new Error('Connection timeout'));
      global.fetch = fetchMock;

      await expect(
        client.processRefund({
          paymentId: 'pay_123',
          amount: 30000,
          reason: 'Customer requested refund',
        })
      ).rejects.toThrow('Connection timeout');
    });
  });

  describe('createBillingKey', () => {
    it('creates billing key successfully', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ billing_key: 'bk_test_abc123' }),
      });
      global.fetch = fetchMock;

      const result = await client.createBillingKey({
        tenantId: 'tn_test123',
        cardInfo: {
          cardNumber: '1234567812345678',
          expiryYear: '2026',
          expiryMonth: '12',
          birthOrBusinessRegistrationNumber: '900101',
          passwordTwoDigits: '12',
        },
      });

      expect(result).toBe('bk_test_abc123');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.portone.io/v2/billing-keys',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-portone-key',
          },
        })
      );

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.customer_uid).toBe('tn_test123');
      expect(callBody.card_number).toBe('1234567812345678');
      expect(callBody.expiry).toBe('2026-12');
      expect(callBody.birth).toBe('900101');
      expect(callBody.pwd_2digit).toBe('12');
    });

    it('returns empty string when billing_key is missing', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      global.fetch = fetchMock;

      const result = await client.createBillingKey({
        tenantId: 'tn_test123',
        cardInfo: {
          cardNumber: '1234567812345678',
          expiryYear: '2026',
          expiryMonth: '12',
        },
      });

      expect(result).toBe('');
    });

    it('throws error when card validation fails', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid card number',
      });
      global.fetch = fetchMock;

      await expect(
        client.createBillingKey({
          tenantId: 'tn_test123',
          cardInfo: {
            cardNumber: 'invalid',
            expiryYear: '2026',
            expiryMonth: '12',
          },
        })
      ).rejects.toThrow('PortOne API error: 400 Invalid card number');
    });
  });

  describe('chargeWithBillingKey', () => {
    it('charges with billing key successfully', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = fetchMock;

      await client.chargeWithBillingKey({
        billingKey: 'bk_test_abc123',
        amount: 50000,
        orderName: 'Monthly subscription',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.portone.io/v2/billing-keys/bk_test_abc123/charge',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-portone-key',
          },
        })
      );

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.amount).toBe(50000);
      expect(callBody.name).toBe('Monthly subscription');
      expect(callBody.merchant_uid).toMatch(/^charge_\d+$/);
    });

    it('throws error when billing key is invalid', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Billing key not found',
      });
      global.fetch = fetchMock;

      await expect(
        client.chargeWithBillingKey({
          billingKey: 'bk_invalid',
          amount: 50000,
          orderName: 'Monthly subscription',
        })
      ).rejects.toThrow('PortOne API error: 404 Billing key not found');
    });

    it('throws error when charge fails', async () => {
      const env = createMockEnv('test-portone-key');
      const client = new PortOneClient(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => 'Insufficient funds',
      });
      global.fetch = fetchMock;

      await expect(
        client.chargeWithBillingKey({
          billingKey: 'bk_test_abc123',
          amount: 50000,
          orderName: 'Monthly subscription',
        })
      ).rejects.toThrow('PortOne API error: 402 Insufficient funds');
    });
  });

  describe('API configuration', () => {
    it('warns when PORTONE_API_KEY is not configured', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const env = createMockEnv();
      new PortOneClient(env);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PORTONE_API_KEY not configured')
      );

      consoleWarnSpy.mockRestore();
    });

    it('does not warn when PORTONE_API_KEY is configured', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const env = createMockEnv('test-key');
      new PortOneClient(env);

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});

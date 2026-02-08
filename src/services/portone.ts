// OpenClasw Cloud PortOne Payment Integration Service
import type { Bindings } from '../types/index.js';
import { structuredLog, structuredWarn, structuredError } from '../utils/log.js';
import { fetchWithTimeout } from '../utils/fetch.js';
import { PORTONE_API_BASE, API_TIMEOUT_STANDARD } from '../config/constants.js';

export interface CheckoutParams {
  tenantId: string;
  planId: string;
  amount: number;
  orderName: string;
}

export interface RefundParams {
  paymentId: string;
  amount: number;
  reason: string;
}

export interface BillingKeyParams {
  tenantId: string;
  cardInfo: {
    cardNumber: string;
    expiryYear: string;
    expiryMonth: string;
    birthOrBusinessRegistrationNumber?: string;
    passwordTwoDigits?: string;
  };
}

export interface ChargeParams {
  billingKey: string;
  amount: number;
  orderName: string;
}

export class PortOneClient {
  private apiKey: string;

  constructor(env: Bindings) {
    this.apiKey = env.PORTONE_API_KEY || '';
    if (!this.apiKey) {
      structuredWarn('portone_api_key_not_configured', {});
    }
  }

  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error('PortOne API key is not configured. Set PORTONE_API_KEY environment variable.');
    }
  }

  private async requireOk(response: Response): Promise<void> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PortOne API error: ${response.status} ${errorText}`);
    }
  }

  /**
   * Create a checkout URL for one-time payment
   */
  async createCheckoutUrl(params: CheckoutParams): Promise<string> {
    this.ensureConfigured();
    try {
      const response = await fetchWithTimeout(`${PORTONE_API_BASE}/payments/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          merchant_uid: `order_${params.tenantId}_${Date.now()}`,
          amount: params.amount,
          name: params.orderName,
          buyer_name: params.tenantId,
          buyer_tel: '',
          buyer_email: '',
          notice_url: '', // Webhook URL would be set here
          metadata: {
            tenant_id: params.tenantId,
            plan_id: params.planId,
          },
        }),
      }, API_TIMEOUT_STANDARD);

      await this.requireOk(response);

      const data = await response.json() as { checkout_url?: string };

      structuredLog('checkout_url_created', {
        tenant_id: params.tenantId,
        plan_id: params.planId,
        amount: params.amount,
      });

      return data.checkout_url || '';
    } catch (error) {
      structuredError('checkout_url_creation_failed', error, {
        tenant_id: params.tenantId,
      });
      throw error;
    }
  }

  /**
   * Process a refund
   */
  async processRefund(params: RefundParams): Promise<void> {
    this.ensureConfigured();
    try {
      const response = await fetchWithTimeout(`${PORTONE_API_BASE}/payments/${params.paymentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          amount: params.amount,
          reason: params.reason,
        }),
      }, API_TIMEOUT_STANDARD);

      await this.requireOk(response);

      structuredLog('refund_processed', {
        payment_id: params.paymentId,
        amount: params.amount,
        reason: params.reason,
      });
    } catch (error) {
      structuredError('refund_processing_failed', error, {
        payment_id: params.paymentId,
      });
      throw error;
    }
  }

  /**
   * Create a billing key for recurring payments
   */
  async createBillingKey(params: BillingKeyParams): Promise<string> {
    this.ensureConfigured();
    try {
      const response = await fetchWithTimeout(`${PORTONE_API_BASE}/billing-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          customer_uid: params.tenantId,
          card_number: params.cardInfo.cardNumber,
          expiry: `${params.cardInfo.expiryYear}-${params.cardInfo.expiryMonth}`,
          birth: params.cardInfo.birthOrBusinessRegistrationNumber,
          pwd_2digit: params.cardInfo.passwordTwoDigits,
        }),
      }, API_TIMEOUT_STANDARD);

      await this.requireOk(response);

      const data = await response.json() as { billing_key?: string };

      structuredLog('billing_key_created', {
        tenant_id: params.tenantId,
      });

      return data.billing_key || '';
    } catch (error) {
      structuredError('billing_key_creation_failed', error, {
        tenant_id: params.tenantId,
      });
      throw error;
    }
  }

  /**
   * Charge using a billing key (recurring payment)
   */
  async chargeWithBillingKey(params: ChargeParams): Promise<void> {
    this.ensureConfigured();
    try {
      const response = await fetchWithTimeout(`${PORTONE_API_BASE}/billing-keys/${params.billingKey}/charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          merchant_uid: `charge_${Date.now()}`,
          amount: params.amount,
          name: params.orderName,
        }),
      }, API_TIMEOUT_STANDARD);

      await this.requireOk(response);

      structuredLog('recurring_payment_charged', {
        billing_key: params.billingKey,
        amount: params.amount,
      });
    } catch (error) {
      structuredError('billing_key_charge_failed', error, {
        billing_key: params.billingKey,
      });
      throw error;
    }
  }
}

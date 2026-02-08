// OpenClasw Cloud PortOne Payment Integration Service
import type { Bindings } from '../types/index.js';

const PORTONE_API_BASE = 'https://api.portone.io/v2';

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

  constructor(private env: Bindings) {
    this.apiKey = env.PORTONE_API_KEY || '';
    if (!this.apiKey) {
      console.warn(JSON.stringify({
        level: 'warning',
        message: 'PORTONE_API_KEY not configured',
      }));
    }
  }

  /**
   * Create a checkout URL for one-time payment
   */
  async createCheckoutUrl(params: CheckoutParams): Promise<string> {
    try {
      const response = await fetch(`${PORTONE_API_BASE}/payments/prepare`, {
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PortOne API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { checkout_url?: string };

      console.log(JSON.stringify({
        level: 'info',
        message: 'Checkout URL created',
        tenant_id: params.tenantId,
        plan_id: params.planId,
        amount: params.amount,
      }));

      return data.checkout_url || '';
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Failed to create checkout URL',
        tenant_id: params.tenantId,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }

  /**
   * Process a refund
   */
  async processRefund(params: RefundParams): Promise<void> {
    try {
      const response = await fetch(`${PORTONE_API_BASE}/payments/${params.paymentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          amount: params.amount,
          reason: params.reason,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PortOne API error: ${response.status} ${errorText}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        message: 'Refund processed',
        payment_id: params.paymentId,
        amount: params.amount,
        reason: params.reason,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Failed to process refund',
        payment_id: params.paymentId,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }

  /**
   * Create a billing key for recurring payments
   */
  async createBillingKey(params: BillingKeyParams): Promise<string> {
    try {
      const response = await fetch(`${PORTONE_API_BASE}/billing-keys`, {
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PortOne API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { billing_key?: string };

      console.log(JSON.stringify({
        level: 'info',
        message: 'Billing key created',
        tenant_id: params.tenantId,
      }));

      return data.billing_key || '';
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Failed to create billing key',
        tenant_id: params.tenantId,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }

  /**
   * Charge using a billing key (recurring payment)
   */
  async chargeWithBillingKey(params: ChargeParams): Promise<void> {
    try {
      const response = await fetch(`${PORTONE_API_BASE}/billing-keys/${params.billingKey}/charge`, {
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PortOne API error: ${response.status} ${errorText}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        message: 'Recurring payment charged',
        billing_key: params.billingKey,
        amount: params.amount,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Failed to charge billing key',
        billing_key: params.billingKey,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }
}

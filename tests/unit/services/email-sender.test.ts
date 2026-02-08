import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailSender } from '../../../src/services/email-sender.js';
import type { Bindings } from '../../../src/types/index.js';

// Mock the fetchWithTimeout utility
vi.mock('../../../src/utils/fetch.js', () => ({
  fetchWithTimeout: vi.fn(),
  DEFAULT_FETCH_TIMEOUT_MS: 10_000,
}));

// Mock the structuredLog utility
vi.mock('../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredWarn: vi.fn(),
  structuredError: vi.fn(),
}));

import { fetchWithTimeout } from '../../../src/utils/fetch.js';
import { structuredLog } from '../../../src/utils/log.js';

function createMockEnv(resendApiKey?: string): Bindings {
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

  if (resendApiKey) {
    env.RESEND_API_KEY = resendApiKey;
  }

  return env;
}

describe('EmailSender', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('sendWelcomeEmail', () => {
    it('sends welcome email via Resend API when configured', async () => {
      const env = createMockEnv('test-resend-key');
      const sender = new EmailSender(env);

      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email_123' }),
      } as any);

      const result = await sender.sendWelcomeEmail({
        tenantName: 'Test Cafe',
        contactName: 'John Doe',
        contactEmail: 'john@example.com',
        subdomain: 'testcafe',
        plan: 'starter',
        apiKey: 'test_api_key_12345',
      });

      expect(result).toBe(true);
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-resend-key',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(structuredLog).toHaveBeenCalledWith('email_sent', {
        to: 'john@example.com',
        subject: expect.stringContaining('Test Cafe'),
      });

      const callBody = JSON.parse(vi.mocked(fetchWithTimeout).mock.calls[0][1]?.body as string);
      expect(callBody.from).toBe('OpenClaw <noreply@openclaw.ai>');
      expect(callBody.to).toEqual(['john@example.com']);
      expect(callBody.subject).toContain('Test Cafe');
      expect(callBody.html).toContain('환영합니다');
      expect(callBody.text).toContain('Test Cafe');
    });

    it('includes API key and dashboard URL in email body', async () => {
      const env = createMockEnv('test-resend-key');
      const sender = new EmailSender(env);

      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email_123' }),
      } as any);

      await sender.sendWelcomeEmail({
        tenantName: 'Test Cafe',
        contactName: 'John Doe',
        contactEmail: 'john@example.com',
        subdomain: 'testcafe',
        plan: 'starter',
        apiKey: 'test_api_key_12345',
      });

      const callBody = JSON.parse(vi.mocked(fetchWithTimeout).mock.calls[0][1]?.body as string);
      expect(callBody.html).toContain('test_api_key_12345');
      expect(callBody.html).toContain('https://testcafe.openclaw.ai/dashboard');
      expect(callBody.text).toContain('test_api_key_12345');
      expect(callBody.text).toContain('https://testcafe.openclaw.ai/dashboard');
    });

    it('skips sending when RESEND_API_KEY is not configured', async () => {
      const env = createMockEnv();
      const sender = new EmailSender(env);

      const result = await sender.sendWelcomeEmail({
        tenantName: 'Test Cafe',
        contactName: 'John Doe',
        contactEmail: 'john@example.com',
        subdomain: 'testcafe',
        plan: 'starter',
        apiKey: 'test_api_key_12345',
      });

      expect(result).toBe(true);
      expect(fetchWithTimeout).not.toHaveBeenCalled();
      expect(structuredLog).toHaveBeenCalledWith('email_send_skipped', {
        reason: 'RESEND_API_KEY not configured',
        to: 'john@example.com',
        subject: expect.stringContaining('Test Cafe'),
      });
    });

    it('returns false when Resend API returns error', async () => {
      const env = createMockEnv('test-resend-key');
      const sender = new EmailSender(env);

      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: false,
        text: async () => 'Invalid API key',
      } as any);

      const result = await sender.sendWelcomeEmail({
        tenantName: 'Test Cafe',
        contactName: 'John Doe',
        contactEmail: 'john@example.com',
        subdomain: 'testcafe',
        plan: 'starter',
        apiKey: 'test_api_key_12345',
      });

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Email send failed:', 'Invalid API key');
    });

    it('handles network errors gracefully', async () => {
      const env = createMockEnv('test-resend-key');
      const sender = new EmailSender(env);

      const error = new Error('Network error');
      vi.mocked(fetchWithTimeout).mockRejectedValue(error);

      const result = await sender.sendWelcomeEmail({
        tenantName: 'Test Cafe',
        contactName: 'John Doe',
        contactEmail: 'john@example.com',
        subdomain: 'testcafe',
        plan: 'starter',
        apiKey: 'test_api_key_12345',
      });

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Email send error:', error);
    });
  });

  describe('sendPaymentFailedEmail', () => {
    it('sends payment failed email with correct content', async () => {
      const env = createMockEnv('test-resend-key');
      const sender = new EmailSender(env);

      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email_456' }),
      } as any);

      const result = await sender.sendPaymentFailedEmail({
        contactEmail: 'jane@example.com',
        contactName: 'Jane Smith',
        tenantName: 'Jane Store',
      });

      expect(result).toBe(true);
      expect(fetchWithTimeout).toHaveBeenCalled();

      const callBody = JSON.parse(vi.mocked(fetchWithTimeout).mock.calls[0][1]?.body as string);
      expect(callBody.to).toEqual(['jane@example.com']);
      expect(callBody.subject).toContain('Jane Store');
      expect(callBody.subject).toContain('결제 실패');
      expect(callBody.html).toContain('Jane Smith');
      expect(callBody.html).toContain('결제 처리에 실패했습니다');
    });

    it('includes 7-day warning in payment failed email', async () => {
      const env = createMockEnv('test-resend-key');
      const sender = new EmailSender(env);

      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email_456' }),
      } as any);

      await sender.sendPaymentFailedEmail({
        contactEmail: 'jane@example.com',
        contactName: 'Jane Smith',
        tenantName: 'Jane Store',
      });

      const callBody = JSON.parse(vi.mocked(fetchWithTimeout).mock.calls[0][1]?.body as string);
      expect(callBody.html).toContain('7일');
      expect(callBody.html).toContain('일시 중지');
    });

    it('skips sending when API key is not configured', async () => {
      const env = createMockEnv();
      const sender = new EmailSender(env);

      const result = await sender.sendPaymentFailedEmail({
        contactEmail: 'jane@example.com',
        contactName: 'Jane Smith',
        tenantName: 'Jane Store',
      });

      expect(result).toBe(true);
      expect(fetchWithTimeout).not.toHaveBeenCalled();
      expect(structuredLog).toHaveBeenCalledWith('email_send_skipped', {
        reason: 'RESEND_API_KEY not configured',
        to: 'jane@example.com',
        subject: expect.stringContaining('Jane Store'),
      });
    });
  });

  describe('sendReEngagementEmail', () => {
    it('sends re-engagement email with inactive days count', async () => {
      const env = createMockEnv('test-resend-key');
      const sender = new EmailSender(env);

      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email_789' }),
      } as any);

      const result = await sender.sendReEngagementEmail({
        contactEmail: 'bob@example.com',
        contactName: 'Bob Wilson',
        tenantName: 'Bob Shop',
        inactiveDays: 45,
      });

      expect(result).toBe(true);
      expect(fetchWithTimeout).toHaveBeenCalled();

      const callBody = JSON.parse(vi.mocked(fetchWithTimeout).mock.calls[0][1]?.body as string);
      expect(callBody.to).toEqual(['bob@example.com']);
      expect(callBody.subject).toContain('Bob Wilson');
      expect(callBody.subject).toContain('Bob Shop');
      expect(callBody.html).toContain('45일');
      expect(callBody.html).toContain('Bob Wilson');
      expect(callBody.text).toContain('45일');
    });

    it('includes feature list in re-engagement email', async () => {
      const env = createMockEnv('test-resend-key');
      const sender = new EmailSender(env);

      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email_789' }),
      } as any);

      await sender.sendReEngagementEmail({
        contactEmail: 'bob@example.com',
        contactName: 'Bob Wilson',
        tenantName: 'Bob Shop',
        inactiveDays: 30,
      });

      const callBody = JSON.parse(vi.mocked(fetchWithTimeout).mock.calls[0][1]?.body as string);
      expect(callBody.html).toContain('고객 문의 자동 응대');
      expect(callBody.html).toContain('예약 및 일정 관리');
      expect(callBody.html).toContain('자주 묻는 질문');
    });

    it('returns false on Resend API error', async () => {
      const env = createMockEnv('test-resend-key');
      const sender = new EmailSender(env);

      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: false,
        text: async () => 'Rate limit exceeded',
      } as any);

      const result = await sender.sendReEngagementEmail({
        contactEmail: 'bob@example.com',
        contactName: 'Bob Wilson',
        tenantName: 'Bob Shop',
        inactiveDays: 30,
      });

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Email send failed:', 'Rate limit exceeded');
    });

    it('skips sending when API key is not configured', async () => {
      const env = createMockEnv();
      const sender = new EmailSender(env);

      const result = await sender.sendReEngagementEmail({
        contactEmail: 'bob@example.com',
        contactName: 'Bob Wilson',
        tenantName: 'Bob Shop',
        inactiveDays: 30,
      });

      expect(result).toBe(true);
      expect(fetchWithTimeout).not.toHaveBeenCalled();
      expect(structuredLog).toHaveBeenCalledWith('email_send_skipped', {
        reason: 'RESEND_API_KEY not configured',
        to: 'bob@example.com',
        subject: expect.stringContaining('Bob Shop'),
      });
    });
  });
});

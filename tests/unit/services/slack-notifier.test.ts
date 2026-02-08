import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlackNotifier } from '../../../src/services/slack-notifier.js';
import type { Bindings } from '../../../src/types/index.js';

// Mock the structuredError utility
vi.mock('../../../src/utils/log.js', () => ({
  structuredError: vi.fn(),
}));

import { structuredError } from '../../../src/utils/log.js';

describe('SlackNotifier', () => {
  let mockEnv: Bindings;
  let notifier: SlackNotifier;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    mockEnv = {
      SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test/webhook',
      DB: {} as any,
      STORAGE: {} as any,
      CACHE: {} as any,
      AI_GATEWAY_URL: '',
      AI_GATEWAY_ID: '',
      AI_GATEWAY_TOKEN: '',
    };

    notifier = new SlackNotifier(mockEnv);
  });

  describe('sendAlert', () => {
    it('returns false when SLACK_WEBHOOK_URL is not configured', async () => {
      const noWebhookEnv = { ...mockEnv, SLACK_WEBHOOK_URL: '' };
      const notifierNoWebhook = new SlackNotifier(noWebhookEnv);

      const result = await notifierNoWebhook.sendAlert({
        severity: 'P1',
        title: 'Test Alert',
        message: 'Test message',
      });

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends alert with correct payload format', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const result = await notifier.sendAlert({
        severity: 'P2',
        title: 'Test Alert',
        message: 'Test message',
      });

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://hooks.slack.com/test/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.text).toContain('⚠️');
      expect(payload.text).toContain('[P2]');
      expect(payload.text).toContain('Test Alert');
      expect(payload.blocks).toHaveLength(2);
    });

    it('uses critical emoji for P0 severity', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await notifier.sendAlert({
        severity: 'P0',
        title: 'Critical Alert',
        message: 'Critical issue',
      });

      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.text).toContain('🚨');
    });

    it('uses critical emoji for P1 severity', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await notifier.sendAlert({
        severity: 'P1',
        title: 'High Priority Alert',
        message: 'High priority issue',
      });

      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.text).toContain('🚨');
    });

    it('includes tenant context when tenantId is provided', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await notifier.sendAlert({
        severity: 'P2',
        title: 'Tenant Alert',
        message: 'Tenant issue',
        tenantId: 'tenant-123',
      });

      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.blocks).toHaveLength(3);
      expect(payload.blocks[2].type).toBe('context');
      expect(payload.blocks[2].elements[0].text).toContain('tenant-123');
    });

    it('handles fetch errors gracefully and returns false', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const result = await notifier.sendAlert({
        severity: 'P1',
        title: 'Test Alert',
        message: 'Test message',
      });

      expect(result).toBe(false);
      expect(structuredError).toHaveBeenCalledWith(
        'slack_notification_failed',
        expect.any(Error)
      );
    });

    it('returns true on successful send', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const result = await notifier.sendAlert({
        severity: 'P1',
        title: 'Test Alert',
        message: 'Test message',
      });

      expect(result).toBe(true);
    });

    it('returns false when fetch response is not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400 });

      const result = await notifier.sendAlert({
        severity: 'P1',
        title: 'Test Alert',
        message: 'Test message',
      });

      expect(result).toBe(false);
    });
  });

  describe('sendIncidentAlert', () => {
    it('sends incident alert with P2 severity', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const result = await notifier.sendIncidentAlert({
        tenantId: 'tenant-456',
        status: 'unhealthy',
        details: { resource_count: 0, soul_exists: false },
      });

      expect(result).toBe(true);
      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.text).toContain('[P2]');
      expect(payload.text).toContain('tenant-456');
      expect(payload.text).toContain('unhealthy');
    });

    it('includes tenant details in message', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await notifier.sendIncidentAlert({
        tenantId: 'tenant-789',
        status: 'degraded',
        details: { resource_count: 2, soul_exists: true, open_incidents: 1 },
      });

      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      const messageBlock = payload.blocks[1];
      expect(messageBlock.text.text).toContain('resource_count');
      expect(messageBlock.text.text).toContain('soul_exists');
      expect(messageBlock.text.text).toContain('open_incidents');
    });
  });

  describe('sendEscalation', () => {
    it('sends escalation with P1 severity', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const result = await notifier.sendEscalation({
        tenantId: 'tenant-999',
        reason: 'Auto-recovery exhausted',
        attempts: 3,
      });

      expect(result).toBe(true);
      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.text).toContain('🚨');
      expect(payload.text).toContain('[P1]');
      expect(payload.text).toContain('tenant-999');
      expect(payload.text).toContain('3회 시도');
    });

    it('includes escalation reason and manual action requirement', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await notifier.sendEscalation({
        tenantId: 'tenant-abc',
        reason: 'Critical failure',
        attempts: 5,
      });

      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      const messageBlock = payload.blocks[1];
      expect(messageBlock.text.text).toContain('에스컬레이션 사유');
      expect(messageBlock.text.text).toContain('Critical failure');
      expect(messageBlock.text.text).toContain('Operator 수동 확인 필요');
    });

    it('includes tenant context block', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await notifier.sendEscalation({
        tenantId: 'tenant-xyz',
        reason: 'Test escalation',
        attempts: 3,
      });

      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.blocks).toHaveLength(3);
      expect(payload.blocks[2].type).toBe('context');
      expect(payload.blocks[2].elements[0].text).toContain('tenant-xyz');
    });
  });
});

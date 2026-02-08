import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSurvey,
  getSurvey,
  updateSurvey,
  upsertTenantSegment,
  getTenantSegment,
  listTenantsBySegment,
  createNotification,
  updateNotification,
  listNotifications,
  hasRecentNotification,
  createEmailNotification,
  createSoulVersion,
  getActiveSoul,
  listSoulVersions,
  createCronLog,
  updateCronLog,
  createBillingSubscription,
  updateBillingSubscription,
} from '../../../src/db/queries-v2.js';
import type {
  OnboardingSurvey,
  TenantSegment,
  Notification,
  SoulVersion,
  CronLog,
  BillingSubscription,
} from '../../../src/types/index.js';

function createMockDB() {
  const mockRun = vi.fn().mockResolvedValue({ success: true });
  const mockFirst = vi.fn().mockResolvedValue(null);
  const mockAll = vi.fn().mockResolvedValue({ results: [] });
  const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst, all: mockAll });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind, run: mockRun, first: mockFirst, all: mockAll });

  return {
    db: { prepare: mockPrepare } as unknown as D1Database,
    mockPrepare,
    mockBind,
    mockRun,
    mockFirst,
    mockAll,
  };
}

describe('queries-v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Onboarding Surveys', () => {
    describe('createSurvey', () => {
      it('creates a survey with all fields', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        const survey: Omit<OnboardingSurvey, 'created_at'> = {
          id: 'survey_1',
          tenant_id: 'tn_1',
          industry: 'retail',
          business_description: 'Coffee shop',
          preferred_tone: 'friendly',
          preferred_language: 'ko',
          target_services: 'kakao,telegram',
          custom_instructions: 'Use emoji',
          completed_at: '2026-02-08T10:00:00Z',
        };

        const result = await createSurvey(db, survey);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO onboarding_surveys')
        );
        expect(mockBind).toHaveBeenCalledWith(
          'survey_1',
          'tn_1',
          'retail',
          'Coffee shop',
          'friendly',
          'ko',
          'kakao,telegram',
          'Use emoji',
          '2026-02-08T10:00:00Z',
          expect.any(String)
        );
        expect(result.id).toBe('survey_1');
        expect(result.created_at).toBeDefined();
      });
    });

    describe('getSurvey', () => {
      it('retrieves the most recent survey for a tenant', async () => {
        const { db, mockPrepare, mockBind, mockFirst } = createMockDB();

        const mockSurvey: OnboardingSurvey = {
          id: 'survey_1',
          tenant_id: 'tn_1',
          industry: 'retail',
          business_description: 'Coffee shop',
          preferred_tone: 'friendly',
          preferred_language: 'ko',
          target_services: 'kakao',
          custom_instructions: null,
          completed_at: '2026-02-08T10:00:00Z',
          created_at: '2026-02-08T09:00:00Z',
        };

        mockFirst.mockResolvedValue(mockSurvey);

        const result = await getSurvey(db, 'tn_1');

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM onboarding_surveys WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1')
        );
        expect(mockBind).toHaveBeenCalledWith('tn_1');
        expect(result).toEqual(mockSurvey);
      });

      it('returns null when no survey exists', async () => {
        const { db, mockFirst } = createMockDB();
        mockFirst.mockResolvedValue(null);

        const result = await getSurvey(db, 'tn_nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('updateSurvey', () => {
      it('updates multiple fields', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateSurvey(db, 'survey_1', {
          industry: 'food',
          preferred_tone: 'professional',
          completed_at: '2026-02-08T11:00:00Z',
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE onboarding_surveys SET industry = ?, preferred_tone = ?, completed_at = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('food', 'professional', '2026-02-08T11:00:00Z', 'survey_1');
      });

      it('updates single field', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateSurvey(db, 'survey_1', {
          custom_instructions: 'New instructions',
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE onboarding_surveys SET custom_instructions = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('New instructions', 'survey_1');
      });

      it('does nothing when no updates provided', async () => {
        const { db, mockPrepare } = createMockDB();

        await updateSurvey(db, 'survey_1', {});

        expect(mockPrepare).not.toHaveBeenCalled();
      });
    });
  });

  describe('Tenant Segments', () => {
    describe('upsertTenantSegment', () => {
      it('inserts or updates a tenant segment', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        const segment: TenantSegment = {
          tenant_id: 'tn_1',
          segment: 'champion',
          score: 95,
          last_active_at: '2026-02-08T10:00:00Z',
          risk_factors: null,
          updated_at: '2026-02-08T10:00:00Z',
        };

        await upsertTenantSegment(db, segment);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO tenant_segments')
        );
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('ON CONFLICT(tenant_id) DO UPDATE SET')
        );
        expect(mockBind).toHaveBeenCalledWith(
          'tn_1',
          'champion',
          95,
          '2026-02-08T10:00:00Z',
          null,
          expect.any(String)
        );
      });
    });

    describe('getTenantSegment', () => {
      it('retrieves a tenant segment', async () => {
        const { db, mockPrepare, mockBind, mockFirst } = createMockDB();

        const mockSegment: TenantSegment = {
          tenant_id: 'tn_1',
          segment: 'champion',
          score: 95,
          last_active_at: '2026-02-08T10:00:00Z',
          risk_factors: null,
          updated_at: '2026-02-08T10:00:00Z',
        };

        mockFirst.mockResolvedValue(mockSegment);

        const result = await getTenantSegment(db, 'tn_1');

        expect(mockPrepare).toHaveBeenCalledWith(
          'SELECT * FROM tenant_segments WHERE tenant_id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('tn_1');
        expect(result).toEqual(mockSegment);
      });

      it('returns null when segment does not exist', async () => {
        const { db, mockFirst } = createMockDB();
        mockFirst.mockResolvedValue(null);

        const result = await getTenantSegment(db, 'tn_nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('listTenantsBySegment', () => {
      it('lists tenants by segment ordered by score', async () => {
        const { db, mockPrepare, mockBind, mockAll } = createMockDB();

        const mockSegments: TenantSegment[] = [
          {
            tenant_id: 'tn_1',
            segment: 'champion',
            score: 95,
            last_active_at: '2026-02-08T10:00:00Z',
            risk_factors: null,
            updated_at: '2026-02-08T10:00:00Z',
          },
          {
            tenant_id: 'tn_2',
            segment: 'champion',
            score: 90,
            last_active_at: '2026-02-08T09:00:00Z',
            risk_factors: null,
            updated_at: '2026-02-08T09:00:00Z',
          },
        ];

        mockAll.mockResolvedValue({ results: mockSegments });

        const result = await listTenantsBySegment(db, 'champion');

        expect(mockPrepare).toHaveBeenCalledWith(
          'SELECT * FROM tenant_segments WHERE segment = ? ORDER BY score DESC'
        );
        expect(mockBind).toHaveBeenCalledWith('champion');
        expect(result).toEqual(mockSegments);
      });

      it('returns empty array when no tenants in segment', async () => {
        const { db, mockAll } = createMockDB();
        mockAll.mockResolvedValue({ results: [] });

        const result = await listTenantsBySegment(db, 'nonexistent');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Notifications', () => {
    describe('createNotification', () => {
      it('creates a notification with all fields', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        const notification: Omit<Notification, 'created_at'> = {
          id: 'notif_1',
          tenant_id: 'tn_1',
          channel: 'email',
          type: 'welcome',
          status: 'sent',
          content: 'Welcome to OpenClaw!',
          sent_at: '2026-02-08T10:00:00Z',
        };

        const result = await createNotification(db, notification);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO notifications')
        );
        expect(mockBind).toHaveBeenCalledWith(
          'notif_1',
          'tn_1',
          'email',
          'welcome',
          'sent',
          'Welcome to OpenClaw!',
          '2026-02-08T10:00:00Z',
          expect.any(String)
        );
        expect(result.id).toBe('notif_1');
        expect(result.created_at).toBeDefined();
      });
    });

    describe('updateNotification', () => {
      it('updates notification status', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateNotification(db, 'notif_1', {
          status: 'failed',
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE notifications SET status = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('failed', 'notif_1');
      });

      it('updates multiple fields', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateNotification(db, 'notif_1', {
          status: 'sent',
          sent_at: '2026-02-08T11:00:00Z',
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE notifications SET status = ?, sent_at = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('sent', '2026-02-08T11:00:00Z', 'notif_1');
      });

      it('does nothing when no updates provided', async () => {
        const { db, mockPrepare } = createMockDB();

        await updateNotification(db, 'notif_1', {});

        expect(mockPrepare).not.toHaveBeenCalled();
      });
    });

    describe('listNotifications', () => {
      it('lists all notifications with default limit', async () => {
        const { db, mockPrepare, mockBind, mockAll } = createMockDB();

        const mockNotifications: Notification[] = [
          {
            id: 'notif_1',
            tenant_id: 'tn_1',
            channel: 'email',
            type: 'welcome',
            status: 'sent',
            content: 'Welcome!',
            sent_at: '2026-02-08T10:00:00Z',
            created_at: '2026-02-08T09:00:00Z',
          },
        ];

        mockAll.mockResolvedValue({ results: mockNotifications });

        const result = await listNotifications(db);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM notifications WHERE 1=1')
        );
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY created_at DESC LIMIT ?')
        );
        expect(mockBind).toHaveBeenCalledWith(50);
        expect(result).toEqual(mockNotifications);
      });

      it('filters by tenant_id', async () => {
        const { db, mockPrepare, mockBind, mockAll } = createMockDB();

        mockAll.mockResolvedValue({ results: [] });

        await listNotifications(db, { tenantId: 'tn_1' });

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('AND tenant_id = ?')
        );
        expect(mockBind).toHaveBeenCalledWith('tn_1', 50);
      });

      it('filters by status and type', async () => {
        const { db, mockPrepare, mockBind, mockAll } = createMockDB();

        mockAll.mockResolvedValue({ results: [] });

        await listNotifications(db, { status: 'sent', type: 'welcome' });

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('AND status = ?')
        );
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('AND type = ?')
        );
        expect(mockBind).toHaveBeenCalledWith('sent', 'welcome', 50);
      });

      it('uses custom limit', async () => {
        const { db, mockBind, mockAll } = createMockDB();

        mockAll.mockResolvedValue({ results: [] });

        await listNotifications(db, { limit: 10 });

        expect(mockBind).toHaveBeenCalledWith(10);
      });

      it('returns empty array when no notifications', async () => {
        const { db, mockAll } = createMockDB();
        mockAll.mockResolvedValue({ results: [] });

        const result = await listNotifications(db);

        expect(result).toEqual([]);
      });
    });

    describe('hasRecentNotification', () => {
      it('returns true when recent notification exists (count > 0)', async () => {
        const { db, mockPrepare, mockBind, mockFirst } = createMockDB();

        mockFirst.mockResolvedValue({ count: 3 });

        const result = await hasRecentNotification(db, 'tn_1', 'welcome', 7);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining("SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND type = ? AND created_at > datetime('now', '-' || ? || ' days')")
        );
        expect(mockBind).toHaveBeenCalledWith('tn_1', 'welcome', 7);
        expect(result).toBe(true);
      });

      it('returns false when no recent notification (count = 0)', async () => {
        const { db, mockFirst } = createMockDB();

        mockFirst.mockResolvedValue({ count: 0 });

        const result = await hasRecentNotification(db, 'tn_1', 're_engagement', 14);

        expect(result).toBe(false);
      });

      it('returns false when result is null', async () => {
        const { db, mockFirst } = createMockDB();

        mockFirst.mockResolvedValue(null);

        const result = await hasRecentNotification(db, 'tn_1', 'upsell', 30);

        expect(result).toBe(false);
      });

      it('passes correct parameters (tenantId, type, withinDays) to the query', async () => {
        const { db, mockPrepare, mockBind, mockFirst } = createMockDB();

        mockFirst.mockResolvedValue({ count: 1 });

        await hasRecentNotification(db, 'tn_test_123', 'payment_failed', 5);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining("SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND type = ? AND created_at > datetime('now', '-' || ? || ' days')")
        );
        expect(mockBind).toHaveBeenCalledWith('tn_test_123', 'payment_failed', 5);
      });
    });

    describe('createEmailNotification', () => {
      it('creates notification with correct channel (email) and status (pending)', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await createEmailNotification(db, 'tn_1', 'welcome', 'Welcome to OpenClaw', 'Thank you for joining!');

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO notifications')
        );

        const bindCall = mockBind.mock.calls[0];
        expect(bindCall[1]).toBe('tn_1'); // tenant_id
        expect(bindCall[2]).toBe('email'); // channel
        expect(bindCall[3]).toBe('welcome'); // type
        expect(bindCall[4]).toBe('pending'); // status
        expect(bindCall[6]).toBeNull(); // sent_at
      });

      it('passes subject and body as JSON stringified content', async () => {
        const { db, mockBind } = createMockDB();

        await createEmailNotification(
          db,
          'tn_1',
          'payment_failed',
          'Payment Failed',
          'Your payment could not be processed'
        );

        const bindCall = mockBind.mock.calls[0];
        const content = bindCall[5]; // content field
        expect(content).toBe(JSON.stringify({
          subject: 'Payment Failed',
          body: 'Your payment could not be processed'
        }));
      });

      it('generates a unique ID (crypto.randomUUID)', async () => {
        const { db, mockBind } = createMockDB();

        // Mock crypto.randomUUID
        const mockUUID = 'test-uuid-1234';
        vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID);

        await createEmailNotification(db, 'tn_1', 'upsell', 'Upgrade Now', 'Get more features');

        const bindCall = mockBind.mock.calls[0];
        expect(bindCall[0]).toBe(mockUUID); // id field

        vi.restoreAllMocks();
      });
    });
  });

  describe('Soul Versions', () => {
    describe('createSoulVersion', () => {
      it('creates a soul version', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        const version: Omit<SoulVersion, 'created_at'> = {
          id: 'soul_1',
          tenant_id: 'tn_1',
          version: 1,
          content: '# SOUL.md\n\nFriendly cafe assistant',
          generated_by: 'persona-agent',
          is_active: 1,
        };

        const result = await createSoulVersion(db, version);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO soul_versions')
        );
        expect(mockBind).toHaveBeenCalledWith(
          'soul_1',
          'tn_1',
          1,
          '# SOUL.md\n\nFriendly cafe assistant',
          'persona-agent',
          1,
          expect.any(String)
        );
        expect(result.id).toBe('soul_1');
        expect(result.created_at).toBeDefined();
      });
    });

    describe('getActiveSoul', () => {
      it('retrieves the active soul version', async () => {
        const { db, mockPrepare, mockBind, mockFirst } = createMockDB();

        const mockSoul: SoulVersion = {
          id: 'soul_1',
          tenant_id: 'tn_1',
          version: 2,
          content: '# SOUL.md v2',
          generated_by: 'persona-agent',
          is_active: 1,
          created_at: '2026-02-08T10:00:00Z',
        };

        mockFirst.mockResolvedValue(mockSoul);

        const result = await getActiveSoul(db, 'tn_1');

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM soul_versions WHERE tenant_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1')
        );
        expect(mockBind).toHaveBeenCalledWith('tn_1');
        expect(result).toEqual(mockSoul);
      });

      it('returns null when no active soul exists', async () => {
        const { db, mockFirst } = createMockDB();
        mockFirst.mockResolvedValue(null);

        const result = await getActiveSoul(db, 'tn_nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('listSoulVersions', () => {
      it('lists all soul versions for a tenant', async () => {
        const { db, mockPrepare, mockBind, mockAll } = createMockDB();

        const mockVersions: SoulVersion[] = [
          {
            id: 'soul_2',
            tenant_id: 'tn_1',
            version: 2,
            content: '# v2',
            generated_by: 'persona-agent',
            is_active: 1,
            created_at: '2026-02-08T10:00:00Z',
          },
          {
            id: 'soul_1',
            tenant_id: 'tn_1',
            version: 1,
            content: '# v1',
            generated_by: 'persona-agent',
            is_active: 0,
            created_at: '2026-02-08T09:00:00Z',
          },
        ];

        mockAll.mockResolvedValue({ results: mockVersions });

        const result = await listSoulVersions(db, 'tn_1');

        expect(mockPrepare).toHaveBeenCalledWith(
          'SELECT * FROM soul_versions WHERE tenant_id = ? ORDER BY version DESC'
        );
        expect(mockBind).toHaveBeenCalledWith('tn_1');
        expect(result).toEqual(mockVersions);
      });

      it('returns empty array when no versions exist', async () => {
        const { db, mockAll } = createMockDB();
        mockAll.mockResolvedValue({ results: [] });

        const result = await listSoulVersions(db, 'tn_nonexistent');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Cron Logs', () => {
    describe('createCronLog', () => {
      it('creates a cron log with null completed_at and error_message', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        const log: Omit<CronLog, 'completed_at' | 'error_message'> = {
          id: 'cron_1',
          job_name: 'daily-segment-update',
          status: 'running',
          tenants_processed: 0,
          details: null,
          started_at: '2026-02-08T10:00:00Z',
        };

        const result = await createCronLog(db, log);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO cron_logs')
        );
        expect(mockBind).toHaveBeenCalledWith(
          'cron_1',
          'daily-segment-update',
          'running',
          0,
          null,
          '2026-02-08T10:00:00Z',
          null,
          null
        );
        expect(result.id).toBe('cron_1');
        expect(result.completed_at).toBeNull();
        expect(result.error_message).toBeNull();
      });
    });

    describe('updateCronLog', () => {
      it('updates status and completed_at', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateCronLog(db, 'cron_1', {
          status: 'completed',
          completed_at: '2026-02-08T10:05:00Z',
          tenants_processed: 150,
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE cron_logs SET status = ?, tenants_processed = ?, completed_at = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('completed', 150, '2026-02-08T10:05:00Z', 'cron_1');
      });

      it('updates with error message', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateCronLog(db, 'cron_1', {
          status: 'failed',
          error_message: 'Database connection timeout',
          completed_at: '2026-02-08T10:05:00Z',
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE cron_logs SET status = ?, completed_at = ?, error_message = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('failed', '2026-02-08T10:05:00Z', 'Database connection timeout', 'cron_1');
      });

      it('updates details field', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateCronLog(db, 'cron_1', {
          details: 'Processed 100 tenants successfully',
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE cron_logs SET details = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('Processed 100 tenants successfully', 'cron_1');
      });

      it('does nothing when no updates provided', async () => {
        const { db, mockPrepare } = createMockDB();

        await updateCronLog(db, 'cron_1', {});

        expect(mockPrepare).not.toHaveBeenCalled();
      });
    });
  });

  describe('Billing Subscriptions', () => {
    describe('createBillingSubscription', () => {
      it('creates a subscription with timestamps', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        const sub: Omit<BillingSubscription, 'created_at' | 'updated_at'> = {
          id: 'sub_1',
          tenant_id: 'tn_1',
          plan_id: 'starter',
          status: 'active',
          current_period_start: '2026-02-01T00:00:00Z',
          current_period_end: '2026-03-01T00:00:00Z',
          payment_method: 'card',
        };

        const result = await createBillingSubscription(db, sub);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO billing_subscriptions')
        );
        expect(mockBind).toHaveBeenCalledWith(
          'sub_1',
          'tn_1',
          'starter',
          'active',
          '2026-02-01T00:00:00Z',
          '2026-03-01T00:00:00Z',
          'card',
          expect.any(String),
          expect.any(String)
        );
        expect(result.id).toBe('sub_1');
        expect(result.created_at).toBeDefined();
        expect(result.updated_at).toBeDefined();
      });
    });

    describe('updateBillingSubscription', () => {
      it('updates plan_id and status', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateBillingSubscription(db, 'sub_1', {
          plan_id: 'growth',
          status: 'active',
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE billing_subscriptions SET plan_id = ?, status = ?, updated_at = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('growth', 'active', expect.any(String), 'sub_1');
      });

      it('updates period dates', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateBillingSubscription(db, 'sub_1', {
          current_period_start: '2026-03-01T00:00:00Z',
          current_period_end: '2026-04-01T00:00:00Z',
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE billing_subscriptions SET current_period_start = ?, current_period_end = ?, updated_at = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith(
          '2026-03-01T00:00:00Z',
          '2026-04-01T00:00:00Z',
          expect.any(String),
          'sub_1'
        );
      });

      it('updates payment_method', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateBillingSubscription(db, 'sub_1', {
          payment_method: 'transfer',
        });

        expect(mockPrepare).toHaveBeenCalledWith(
          'UPDATE billing_subscriptions SET payment_method = ?, updated_at = ? WHERE id = ?'
        );
        expect(mockBind).toHaveBeenCalledWith('transfer', expect.any(String), 'sub_1');
      });

      it('always updates updated_at timestamp', async () => {
        const { db, mockPrepare, mockBind } = createMockDB();

        await updateBillingSubscription(db, 'sub_1', {
          status: 'cancelled',
        });

        const bindCall = mockBind.mock.calls[0];
        expect(bindCall).toHaveLength(3);
        expect(bindCall[0]).toBe('cancelled');
        expect(typeof bindCall[1]).toBe('string'); // updated_at timestamp
        expect(bindCall[2]).toBe('sub_1');
      });

      it('does nothing when no updates provided', async () => {
        const { db, mockPrepare } = createMockDB();

        await updateBillingSubscription(db, 'sub_1', {});

        expect(mockPrepare).not.toHaveBeenCalled();
      });
    });
  });
});

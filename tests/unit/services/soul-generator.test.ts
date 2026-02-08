import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoulGenerator } from '../../../src/services/soul-generator.js';
import type { Bindings, OnboardingSurvey, SoulVersion } from '../../../src/types/index.js';
import { AI_MAX_TOKENS_SOUL } from '../../../src/config/constants.js';

function createMockEnv(): Bindings {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    } as any,
    STORAGE: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    } as any,
    CACHE: {} as any,
    SESSIONS: {} as any,
    AI: {
      run: vi.fn().mockResolvedValue({
        response: '# AI 비서\n\n## 기본 정보\n- 업종: cafe\n- 언어: 한국어',
      }),
    } as any,
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'debug',
    AI_GATEWAY_ENDPOINT: 'https://test.ai.cloudflare.com',
    JWT_SECRET: 'test-secret',
  };
}

describe('SoulGenerator', () => {
  let env: Bindings;
  let generator: SoulGenerator;

  beforeEach(() => {
    env = createMockEnv();
    generator = new SoulGenerator(env);
    vi.clearAllMocks();
  });

  describe('generate', () => {
    it('generates SOUL.md content from survey data', async () => {
      const survey: OnboardingSurvey = {
        id: 'survey_1',
        tenant_id: 'tn_test123',
        industry: 'cafe',
        business_description: 'Small coffee shop in downtown',
        preferred_tone: 'friendly',
        preferred_language: 'ko',
        target_services: '["kakao", "telegram"]',
        custom_instructions: null,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const content = await generator.generate('tn_test123', survey);

      expect(content).toBeTruthy();
      expect(content).toContain('AI 비서');
      expect(content).toContain('cafe');
    });

    it('uses correct template based on industry', async () => {
      const cafeSurvey: OnboardingSurvey = {
        id: 'survey_1',
        tenant_id: 'tn_cafe',
        industry: 'cafe',
        business_description: 'Cafe',
        preferred_tone: 'friendly',
        preferred_language: 'ko',
        target_services: null,
        custom_instructions: null,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      vi.spyOn(env.AI, 'run').mockResolvedValue({
        response: '# Cafe AI\n\n메뉴 안내, 영업시간, 예약 관리',
      } as any);

      const content = await generator.generate('tn_cafe', cafeSurvey);

      expect(env.AI.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('카페/음식점 업종 특화'),
            }),
          ]),
        })
      );
    });

    it('handles missing optional fields gracefully', async () => {
      const minimalSurvey: OnboardingSurvey = {
        id: 'survey_1',
        tenant_id: 'tn_test123',
        industry: 'general',
        business_description: null,
        preferred_tone: 'polite',
        preferred_language: 'ko',
        target_services: null,
        custom_instructions: null,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const content = await generator.generate('tn_test123', minimalSurvey);

      expect(content).toBeTruthy();
      expect(content).toContain('AI 비서');
    });

    it('includes custom instructions when provided', async () => {
      const survey: OnboardingSurvey = {
        id: 'survey_1',
        tenant_id: 'tn_test123',
        industry: 'office',
        business_description: 'Tech company',
        preferred_tone: 'formal',
        preferred_language: 'ko',
        target_services: '["slack"]',
        custom_instructions: 'Always use formal language',
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      vi.spyOn(env.AI, 'run').mockResolvedValue({
        response: '# Office AI\n\n## 추가 지시사항\nAlways use formal language',
      } as any);

      const content = await generator.generate('tn_test123', survey);

      expect(env.AI.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Always use formal language'),
            }),
          ]),
        })
      );
    });

    it('falls back to template generation when AI fails', async () => {
      const survey: OnboardingSurvey = {
        id: 'survey_1',
        tenant_id: 'tn_test123',
        industry: 'shopping',
        business_description: 'Online store',
        preferred_tone: 'friendly',
        preferred_language: 'ko',
        target_services: null,
        custom_instructions: null,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      vi.spyOn(env.AI, 'run').mockRejectedValue(new Error('AI service unavailable'));

      const content = await generator.generate('tn_test123', survey);

      expect(content).toBeTruthy();
      expect(content).toContain('AI 비서');
      expect(content).toContain('shopping');
      expect(content).toContain('친근하고 따뜻한'); // friendly tone
    });

    it('uses fallback when AI returns empty response', async () => {
      const survey: OnboardingSurvey = {
        id: 'survey_1',
        tenant_id: 'tn_test123',
        industry: 'general',
        business_description: null,
        preferred_tone: 'polite',
        preferred_language: 'ko',
        target_services: null,
        custom_instructions: null,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      vi.spyOn(env.AI, 'run').mockResolvedValue({ response: '' } as any);

      const content = await generator.generate('tn_test123', survey);

      expect(content).toBeTruthy();
      expect(content).toContain('## 기본 정보');
      expect(content).toContain('정중하고 공손한'); // polite tone
    });

    it('maps tone correctly in fallback', async () => {
      const survey: OnboardingSurvey = {
        id: 'survey_1',
        tenant_id: 'tn_test123',
        industry: 'general',
        business_description: null,
        preferred_tone: 'formal',
        preferred_language: 'ko',
        target_services: null,
        custom_instructions: null,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      vi.spyOn(env.AI, 'run').mockRejectedValue(new Error('AI unavailable'));

      const content = await generator.generate('tn_test123', survey);

      expect(content).toContain('격식 있고 전문적인'); // formal tone
    });

    it('includes custom instructions in fallback', async () => {
      const survey: OnboardingSurvey = {
        id: 'survey_1',
        tenant_id: 'tn_test123',
        industry: 'general',
        business_description: null,
        preferred_tone: 'polite',
        preferred_language: 'ko',
        target_services: null,
        custom_instructions: 'Always verify customer identity',
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      vi.spyOn(env.AI, 'run').mockRejectedValue(new Error('AI unavailable'));

      const content = await generator.generate('tn_test123', survey);

      expect(content).toContain('## 추가 지시사항');
      expect(content).toContain('Always verify customer identity');
    });

    it('uses correct max_tokens (AI_MAX_TOKENS_SOUL) when calling AI', async () => {
      const survey: OnboardingSurvey = {
        id: 'survey_1',
        tenant_id: 'tn_test123',
        industry: 'cafe',
        business_description: 'Test cafe',
        preferred_tone: 'friendly',
        preferred_language: 'ko',
        target_services: null,
        custom_instructions: null,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      await generator.generate('tn_test123', survey);

      expect(env.AI.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          max_tokens: AI_MAX_TOKENS_SOUL,
        })
      );
    });
  });

  describe('storeVersion', () => {
    it('creates new version record in database', async () => {
      const content = '# Test SOUL\n\nTest content';

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM soul_versions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO soul_versions')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      await generator.storeVersion(env.DB, 'tn_test123', content, 'survey');

      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'tenants/tn_test123/SOUL.md',
        content
      );
    });

    it('stores SOUL.md in R2', async () => {
      const content = '# Test SOUL\n\nTest content';

      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      await generator.storeVersion(env.DB, 'tn_test123', content, 'template');

      expect(env.STORAGE.put).toHaveBeenCalledWith(
        'tenants/tn_test123/SOUL.md',
        content
      );
    });

    it('deactivates current version before creating new one', async () => {
      const currentVersion: SoulVersion = {
        id: 'soul_v1',
        tenant_id: 'tn_test123',
        version: 1,
        content: 'Old content',
        generated_by: 'template',
        is_active: 1,
        created_at: new Date().toISOString(),
      };

      const updateRunMock = vi.fn().mockResolvedValue({});
      const updateBindMock = vi.fn().mockReturnValue({
        run: updateRunMock,
      });

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM soul_versions') && query.includes('is_active = 1')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(currentVersion),
            }),
          } as any;
        }
        if (query.includes('UPDATE soul_versions SET is_active = 0')) {
          return {
            bind: updateBindMock,
          } as any;
        }
        if (query.includes('INSERT INTO soul_versions')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const newContent = '# New SOUL\n\nNew content';
      await generator.storeVersion(env.DB, 'tn_test123', newContent, 'manual');

      expect(updateBindMock).toHaveBeenCalled();
      expect(updateRunMock).toHaveBeenCalled();
    });

    it('increments version number correctly', async () => {
      const currentVersion: SoulVersion = {
        id: 'soul_v2',
        tenant_id: 'tn_test123',
        version: 2,
        content: 'Version 2 content',
        generated_by: 'survey',
        is_active: 1,
        created_at: new Date().toISOString(),
      };

      let insertedVersion = 0;

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM soul_versions') && query.includes('is_active = 1')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(currentVersion),
            }),
          } as any;
        }
        if (query.includes('UPDATE soul_versions SET is_active = 0')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO soul_versions')) {
          return {
            bind: vi.fn().mockImplementation((...args: any[]) => {
              insertedVersion = args[2]; // version is 3rd parameter
              return {
                run: vi.fn().mockResolvedValue({}),
              };
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const newContent = '# Version 3\n\nVersion 3 content';
      await generator.storeVersion(env.DB, 'tn_test123', newContent, 'manual');

      expect(insertedVersion).toBe(3);
    });

    it('starts at version 1 when no previous version exists', async () => {
      let insertedVersion = 0;

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM soul_versions') && query.includes('is_active = 1')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO soul_versions')) {
          return {
            bind: vi.fn().mockImplementation((...args: any[]) => {
              insertedVersion = args[2]; // version is 3rd parameter
              return {
                run: vi.fn().mockResolvedValue({}),
              };
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const newContent = '# First Version\n\nFirst version content';
      await generator.storeVersion(env.DB, 'tn_test123', newContent, 'template');

      expect(insertedVersion).toBe(1);
    });
  });
});

import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, ApiResponse, OnboardingSurvey, SoulVersion } from '../types/index.js';
import {
  createSurvey,
  getSurvey,
  updateSurvey,
  getActiveSoul,
  listSoulVersions,
} from '../db/queries-v2.js';
import { SoulGenerator } from '../services/soul-generator.js';

const onboarding = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const surveySchema = z.object({
  industry: z.string().min(1),
  business_description: z.string().optional(),
  preferred_tone: z.string().default('polite'),
  preferred_language: z.string().default('ko'),
  target_services: z.array(z.string()).optional(),
  custom_instructions: z.string().optional(),
});

const soulUpdateSchema = z.object({
  content: z.string().min(1),
});

// POST /:tenantId/survey - Submit onboarding survey
onboarding.post('/:tenantId/survey', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const body = await c.req.json();
    const parsed = surveySchema.safeParse(body);

    if (!parsed.success) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.errors,
      }, 400);
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    // Convert target_services array to JSON string
    const targetServices = data.target_services ? JSON.stringify(data.target_services) : null;

    const survey = await createSurvey(c.env.DB, {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      industry: data.industry,
      business_description: data.business_description || null,
      preferred_tone: data.preferred_tone,
      preferred_language: data.preferred_language,
      target_services: targetServices,
      custom_instructions: data.custom_instructions || null,
      completed_at: now,
    });

    return c.json<ApiResponse<OnboardingSurvey>>({
      success: true,
      data: survey,
    }, 201);
  } catch (e) {
    console.error('Failed to create survey:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to create survey',
      code: 'SURVEY_CREATE_FAILED',
    }, 500);
  }
});

// GET /:tenantId/survey - Get survey for tenant
onboarding.get('/:tenantId/survey', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const survey = await getSurvey(c.env.DB, tenantId);

    if (!survey) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Survey not found',
        code: 'SURVEY_NOT_FOUND',
      }, 404);
    }

    return c.json<ApiResponse<OnboardingSurvey>>({
      success: true,
      data: survey,
    });
  } catch (e) {
    console.error('Failed to get survey:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get survey',
      code: 'SURVEY_GET_FAILED',
    }, 500);
  }
});

// POST /:tenantId/soul/generate - Generate SOUL.md using AI
onboarding.post('/:tenantId/soul/generate', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const survey = await getSurvey(c.env.DB, tenantId);

    if (!survey) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Survey not found. Please complete the onboarding survey first.',
        code: 'SURVEY_NOT_FOUND',
      }, 404);
    }

    const generator = new SoulGenerator(c.env);
    const content = await generator.generate(tenantId, survey);
    await generator.storeVersion(c.env.DB, tenantId, content, 'survey');

    // Invalidate cache after generation
    const cacheKey = `soul:${tenantId}`;
    await c.env.CACHE.delete(cacheKey);

    return c.json<ApiResponse<{ content: string }>>({
      success: true,
      data: { content },
    });
  } catch (e) {
    console.error('Failed to generate SOUL:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to generate SOUL.md',
      code: 'SOUL_GENERATE_FAILED',
    }, 500);
  }
});

// GET /:tenantId/soul - Get current active SOUL.md
onboarding.get('/:tenantId/soul', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const soul = await getActiveSoul(c.env.DB, tenantId);

    if (!soul) {
      // Fallback to R2 with KV caching
      const cacheKey = `soul:${tenantId}`;
      let soulContent = await c.env.CACHE.get(cacheKey);

      if (!soulContent) {
        const r2Object = await c.env.STORAGE.get(`tenants/${tenantId}/SOUL.md`);
        if (!r2Object) {
          return c.json<ApiResponse>({
            success: false,
            error: 'SOUL.md not found',
            code: 'SOUL_NOT_FOUND',
          }, 404);
        }

        soulContent = await r2Object.text();
        await c.env.CACHE.put(cacheKey, soulContent, { expirationTtl: 3600 });
      }

      return c.json<ApiResponse<{ content: string }>>({
        success: true,
        data: { content: soulContent },
      });
    }

    return c.json<ApiResponse<SoulVersion>>({
      success: true,
      data: soul,
    });
  } catch (e) {
    console.error('Failed to get SOUL:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get SOUL.md',
      code: 'SOUL_GET_FAILED',
    }, 500);
  }
});

// GET /:tenantId/soul/versions - List all SOUL.md versions
onboarding.get('/:tenantId/soul/versions', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const versions = await listSoulVersions(c.env.DB, tenantId);

    return c.json<ApiResponse<SoulVersion[]>>({
      success: true,
      data: versions,
    });
  } catch (e) {
    console.error('Failed to list SOUL versions:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to list SOUL versions',
      code: 'SOUL_LIST_FAILED',
    }, 500);
  }
});

// PUT /:tenantId/soul - Manually update SOUL.md
onboarding.put('/:tenantId/soul', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const body = await c.req.json();
    const parsed = soulUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.errors,
      }, 400);
    }

    const { content } = parsed.data;
    const generator = new SoulGenerator(c.env);
    await generator.storeVersion(c.env.DB, tenantId, content, 'manual');

    // Invalidate cache after update
    const cacheKey = `soul:${tenantId}`;
    await c.env.CACHE.delete(cacheKey);

    return c.json<ApiResponse<{ content: string }>>({
      success: true,
      data: { content },
    });
  } catch (e) {
    console.error('Failed to update SOUL:', e);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to update SOUL.md',
      code: 'SOUL_UPDATE_FAILED',
    }, 500);
  }
});

export { onboarding };

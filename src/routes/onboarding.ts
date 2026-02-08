import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, ApiResponse, OnboardingSurvey, SoulVersion } from '../types/index.js';
import {
  createSurvey,
  getSurvey,
  getActiveSoul,
  listSoulVersions,
} from '../db/queries-v2.js';
import { SoulGenerator } from '../services/soul-generator.js';
import {
  MAX_SOUL_CONTENT_LENGTH,
  MAX_BUSINESS_DESCRIPTION_LENGTH,
  MAX_CUSTOM_INSTRUCTIONS_LENGTH,
  CACHE_TTL_SOUL_MD,
} from '../config/constants.js';
import { withErrorHandler, validationError } from '../utils/error-handler.js';

const onboarding = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const surveySchema = z.object({
  industry: z.string().min(1).max(50),
  business_description: z.string().max(MAX_BUSINESS_DESCRIPTION_LENGTH).optional().nullable(),
  preferred_tone: z.string().default('polite'),
  preferred_language: z.string().max(10).default('ko'),
  target_services: z.array(z.string()).max(20).optional(),
  custom_instructions: z.string().max(MAX_CUSTOM_INSTRUCTIONS_LENGTH).optional().nullable(),
});

const soulUpdateSchema = z.object({
  content: z.string().min(1).max(MAX_SOUL_CONTENT_LENGTH),
});

// POST /:tenantId/survey - Submit onboarding survey
onboarding.post('/:tenantId/survey', withErrorHandler('survey_create_failed', async (c) => {
  const tenantId = c.req.param('tenantId');
  const body = await c.req.json();
  const parsed = surveySchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Validation failed', parsed.error.errors);
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
}));

// GET /:tenantId/survey - Get survey for tenant
onboarding.get('/:tenantId/survey', withErrorHandler('survey_get_failed', async (c) => {
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
}));

// POST /:tenantId/soul/generate - Generate SOUL.md using AI
onboarding.post('/:tenantId/soul/generate', withErrorHandler('soul_generate_failed', async (c) => {
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
}));

// GET /:tenantId/soul - Get current active SOUL.md
onboarding.get('/:tenantId/soul', withErrorHandler('soul_get_failed', async (c) => {
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
      await c.env.CACHE.put(cacheKey, soulContent, { expirationTtl: CACHE_TTL_SOUL_MD });
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
}));

// GET /:tenantId/soul/versions - List all SOUL.md versions
onboarding.get('/:tenantId/soul/versions', withErrorHandler('soul_versions_list_failed', async (c) => {
  const tenantId = c.req.param('tenantId');
  const versions = await listSoulVersions(c.env.DB, tenantId);

  return c.json<ApiResponse<SoulVersion[]>>({
    success: true,
    data: versions,
  });
}));

// PUT /:tenantId/soul - Manually update SOUL.md
onboarding.put('/:tenantId/soul', withErrorHandler('soul_update_failed', async (c) => {
  const tenantId = c.req.param('tenantId');
  const body = await c.req.json();
  const parsed = soulUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Validation failed', parsed.error.errors);
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
}));

export { onboarding };

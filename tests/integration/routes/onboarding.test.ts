import { describe, it, expect, beforeAll, vi } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb, createTestTenant } from '../../setup.js';
import { createJWT } from '../../../src/utils/crypto.js';
import {
  MAX_BUSINESS_DESCRIPTION_LENGTH,
  MAX_CUSTOM_INSTRUCTIONS_LENGTH,
  MAX_SOUL_CONTENT_LENGTH,
} from '../../../src/config/constants.js';
import { parseApiResponse } from '../../helpers/types.js';

const JWT_SECRET = 'test-jwt-secret';

async function getAuthHeader(tenantId = 'tn_test-tenant-1') {
  const token = await createJWT({ sub: tenantId, role: 'admin' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

async function createSurvey(tenantId: string, data: any = {}) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO onboarding_surveys (id, tenant_id, industry, business_description, preferred_tone, preferred_language, target_services, custom_instructions, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    tenantId,
    data.industry || 'cafe',
    data.business_description || null,
    data.preferred_tone || 'polite',
    data.preferred_language || 'ko',
    data.target_services || null,
    data.custom_instructions || null,
    now,
    now
  ).run();
  return id;
}

describe('Onboarding Routes', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;

    // Create onboarding_surveys table
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS onboarding_surveys (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id),
        industry TEXT NOT NULL,
        business_description TEXT,
        preferred_tone TEXT NOT NULL DEFAULT 'polite',
        preferred_language TEXT NOT NULL DEFAULT 'ko',
        target_services TEXT,
        custom_instructions TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // Create soul_versions table
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS soul_versions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id),
        version INTEGER NOT NULL DEFAULT 1,
        content TEXT NOT NULL,
        generated_by TEXT NOT NULL DEFAULT 'template',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
  });

  describe('POST /api/tenants/:tenantId/survey', () => {
    it('creates a survey with valid data', async () => {
      const tenantId = 'tn_survey_test';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: 'cafe',
          business_description: 'A cozy coffee shop',
          preferred_tone: 'friendly',
          preferred_language: 'ko',
          target_services: ['kakao', 'telegram'],
          custom_instructions: 'Focus on menu recommendations',
        }),
      }, env);

      expect(res.status).toBe(201);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.tenant_id).toBe(tenantId);
      expect(body.data.industry).toBe('cafe');
      expect(body.data.preferred_tone).toBe('friendly');
      expect(body.data.completed_at).toBeDefined();
    });

    it('creates survey with minimal data', async () => {
      const tenantId = 'tn_survey_minimal';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: 'office',
        }),
      }, env);

      expect(res.status).toBe(201);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.industry).toBe('office');
      expect(body.data.preferred_tone).toBe('polite');
      expect(body.data.preferred_language).toBe('ko');
    });

    it('validates required fields', async () => {
      const tenantId = 'tn_survey_invalid';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toBeDefined();
    });

    it('rejects empty industry', async () => {
      const tenantId = 'tn_survey_empty';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: '' }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects business_description exceeding MAX_BUSINESS_DESCRIPTION_LENGTH', async () => {
      const tenantId = 'tn_survey_long_desc';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const longDescription = 'x'.repeat(MAX_BUSINESS_DESCRIPTION_LENGTH + 1);

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: 'cafe',
          business_description: longDescription,
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects custom_instructions exceeding MAX_CUSTOM_INSTRUCTIONS_LENGTH', async () => {
      const tenantId = 'tn_survey_long_instr';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const longInstructions = 'x'.repeat(MAX_CUSTOM_INSTRUCTIONS_LENGTH + 1);

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: 'shopping',
          custom_instructions: longInstructions,
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid preferred_tone value', async () => {
      const tenantId = 'tn_survey_bad_tone';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: 'cafe',
          preferred_tone: 'sarcastic',
        }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('requires authentication (401 without JWT)', async () => {
      const tenantId = 'tn_survey_noauth';
      await createTestTenant({ id: tenantId });

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: 'cafe' }),
      }, env);

      expect(res.status).toBe(401);
    });

    it('handles target_services array', async () => {
      const tenantId = 'tn_survey_services';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: 'shopping',
          target_services: ['slack', 'discord', 'telegram'],
        }),
      }, env);

      expect(res.status).toBe(201);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.target_services).toBeDefined();
    });
  });

  describe('GET /api/tenants/:tenantId/survey', () => {
    it('returns survey for tenant', async () => {
      const tenantId = 'tn_get_survey';
      await createTestTenant({ id: tenantId });
      await createSurvey(tenantId, {
        industry: 'office',
        business_description: 'Tech startup',
      });

      const headers = await getAuthHeader(tenantId);
      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.tenant_id).toBe(tenantId);
      expect(body.data.industry).toBe('office');
      expect(body.data.business_description).toBe('Tech startup');
    });

    it('returns 404 when survey not found', async () => {
      const tenantId = 'tn_no_survey';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('SURVEY_NOT_FOUND');
    });

    it('returns most recent survey when multiple exist', async () => {
      const tenantId = 'tn_multi_survey';
      await createTestTenant({ id: tenantId });
      await createSurvey(tenantId, { industry: 'cafe' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await createSurvey(tenantId, { industry: 'office' });

      const headers = await getAuthHeader(tenantId);
      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.industry).toBe('office');
    });

    it('requires authentication (401 without JWT)', async () => {
      const tenantId = 'tn_get_survey_noauth';
      await createTestTenant({ id: tenantId });

      const res = await app.request(`/api/tenants/${tenantId}/survey`, {
        method: 'GET',
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/tenants/:tenantId/soul/generate', () => {
    it('generates SOUL.md from survey', async () => {
      const tenantId = 'tn_soul_gen';
      await createTestTenant({ id: tenantId });
      await createSurvey(tenantId, {
        industry: 'cafe',
        business_description: 'Coffee and pastries',
        preferred_tone: 'friendly',
      });

      const headers = await getAuthHeader(tenantId);
      const res = await app.request(`/api/tenants/${tenantId}/soul/generate`, {
        method: 'POST',
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.content).toBeDefined();
      expect(typeof body.data.content).toBe('string');
      expect(body.data.content.length).toBeGreaterThan(0);
    });

    it('returns 404 when survey not found', async () => {
      const tenantId = 'tn_no_survey_gen';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/soul/generate`, {
        method: 'POST',
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('SURVEY_NOT_FOUND');
      expect(body.error).toContain('complete the onboarding survey first');
    });

    it('requires authentication (401 without JWT)', async () => {
      const tenantId = 'tn_soul_gen_noauth';
      await createTestTenant({ id: tenantId });

      const res = await app.request(`/api/tenants/${tenantId}/soul/generate`, {
        method: 'POST',
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/tenants/:tenantId/soul', () => {
    it('returns active SOUL.md version', async () => {
      const tenantId = 'tn_get_soul';
      await createTestTenant({ id: tenantId });

      const soulContent = '# SOUL\nTest persona content';
      await env.DB.prepare(
        `INSERT INTO soul_versions (id, tenant_id, version, content, generated_by, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), tenantId, 1, soulContent, 'survey', 1, new Date().toISOString()).run();

      const headers = await getAuthHeader(tenantId);
      const res = await app.request(`/api/tenants/${tenantId}/soul`, {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.content).toBe(soulContent);
    });

    it('falls back to R2 when no version exists', async () => {
      const tenantId = 'tn_soul_r2';
      await createTestTenant({ id: tenantId });

      // Mock R2 object
      const mockContent = '# SOUL from R2\nFallback content';
      (env.STORAGE as any).get = vi.fn().mockResolvedValue({
        text: async () => mockContent,
      });

      const headers = await getAuthHeader(tenantId);
      const res = await app.request(`/api/tenants/${tenantId}/soul`, {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.content).toBe(mockContent);
    });

    it('returns 404 when SOUL not found anywhere', async () => {
      const tenantId = 'tn_no_soul';
      await createTestTenant({ id: tenantId });

      (env.STORAGE as any).get = vi.fn().mockResolvedValue(null);

      const headers = await getAuthHeader(tenantId);
      const res = await app.request(`/api/tenants/${tenantId}/soul`, {
        headers,
      }, env);

      expect(res.status).toBe(404);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('SOUL_NOT_FOUND');
    });

    it('requires authentication (401 without JWT)', async () => {
      const tenantId = 'tn_get_soul_noauth';
      await createTestTenant({ id: tenantId });

      const res = await app.request(`/api/tenants/${tenantId}/soul`, {
        method: 'GET',
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/tenants/:tenantId/soul/versions', () => {
    it('lists all SOUL versions', async () => {
      const tenantId = 'tn_soul_versions';
      await createTestTenant({ id: tenantId });

      await env.DB.prepare(
        `INSERT INTO soul_versions (id, tenant_id, version, content, generated_by, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), tenantId, 1, 'v1 content', 'survey', 0, new Date().toISOString()).run();

      await env.DB.prepare(
        `INSERT INTO soul_versions (id, tenant_id, version, content, generated_by, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), tenantId, 2, 'v2 content', 'manual', 1, new Date().toISOString()).run();

      const headers = await getAuthHeader(tenantId);
      const res = await app.request(`/api/tenants/${tenantId}/soul/versions`, {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.data[0].version).toBeGreaterThan(body.data[1].version);
    });

    it('returns empty array when no versions exist', async () => {
      const tenantId = 'tn_no_versions';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/soul/versions`, {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(0);
    });

    it('requires authentication (401 without JWT)', async () => {
      const tenantId = 'tn_versions_noauth';
      await createTestTenant({ id: tenantId });

      const res = await app.request(`/api/tenants/${tenantId}/soul/versions`, {
        method: 'GET',
      }, env);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/tenants/:tenantId/soul', () => {
    it('manually updates SOUL.md', async () => {
      const tenantId = 'tn_soul_update';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const newContent = '# SOUL\nManually updated content';
      const res = await app.request(`/api/tenants/${tenantId}/soul`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.content).toBe(newContent);
    });

    it('validates content field', async () => {
      const tenantId = 'tn_soul_invalid';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/soul`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects empty content', async () => {
      const tenantId = 'tn_soul_empty';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const res = await app.request(`/api/tenants/${tenantId}/soul`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects content exceeding MAX_SOUL_CONTENT_LENGTH', async () => {
      const tenantId = 'tn_soul_toolong';
      await createTestTenant({ id: tenantId });
      const headers = await getAuthHeader(tenantId);

      const tooLongContent = 'x'.repeat(MAX_SOUL_CONTENT_LENGTH + 1);

      const res = await app.request(`/api/tenants/${tenantId}/soul`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: tooLongContent }),
      }, env);

      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('requires authentication (401 without JWT)', async () => {
      const tenantId = 'tn_soul_update_noauth';
      await createTestTenant({ id: tenantId });

      const res = await app.request(`/api/tenants/${tenantId}/soul`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# SOUL\nTest content' }),
      }, env);

      expect(res.status).toBe(401);
    });
  });
});

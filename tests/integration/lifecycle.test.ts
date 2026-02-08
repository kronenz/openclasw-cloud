import { describe, it, expect, beforeAll, vi } from 'vitest';
import { app } from '../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../setup.js';
import { createJWT } from '../../src/utils/crypto.js';
import { parseApiResponse } from '../helpers/types.js';

const JWT_SECRET = 'test-jwt-secret';

async function getAuthHeader(tenantId = 'tn_lifecycle-test') {
  const token = await createJWT({ sub: tenantId, role: 'admin' }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe('Tenant Lifecycle Integration', () => {
  beforeAll(async () => {
    await setupTestDb();
    (env as any).JWT_SECRET = JWT_SECRET;

    // Mock AI.run for webhook processing
    (env as any).AI = {
      run: vi.fn().mockResolvedValue({
        response: '네, 무엇을 도와드릴까요?',
      }),
    };

    // Mock STORAGE for SOUL.md retrieval
    (env as any).STORAGE = {
      get: vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue('당신은 친절한 AI 비서입니다.'),
      }),
      put: vi.fn().mockResolvedValue(undefined),
    };

    // Mock CACHE
    (env as any).CACHE = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('Complete lifecycle: create tenant, submit survey, process webhook', async () => {
    let createdTenantId: string;

    // Step 1: Create tenant via POST /api/tenants
    {
      const headers = await getAuthHeader('tn_admin');
      const res = await app.request('/api/tenants', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lifecycle Test Corp',
          contact_email: 'lifecycle@example.com',
          plan: 'starter',
        }),
      }, env);

      expect(res.status).toBe(201);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Lifecycle Test Corp');
      expect(body.data.status).toBe('provisioning');
      expect(body.data.id).toMatch(/^tn_/);

      createdTenantId = body.data.id;
    }

    // Step 2: Verify tenant is in provisioning status
    {
      const headers = await getAuthHeader(createdTenantId);
      const res = await app.request(`/api/tenants/${createdTenantId}`, {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('provisioning');
      expect(body.data.id).toBe(createdTenantId);
    }

    // Step 3: Submit onboarding survey via POST /api/tenants/:id/survey
    {
      const headers = await getAuthHeader(createdTenantId);
      const res = await app.request(`/api/tenants/${createdTenantId}/survey`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: 'technology',
          business_description: '스타트업을 위한 AI 솔루션 제공',
          preferred_tone: 'friendly',
          preferred_language: 'ko',
          target_services: ['kakaotalk', 'telegram'],
          custom_instructions: '고객 응대 시 항상 친절하게',
        }),
      }, env);

      expect(res.status).toBe(201);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.industry).toBe('technology');
      expect(body.data.tenant_id).toBe(createdTenantId);
    }

    // Step 4: Update tenant status to active
    {
      const headers = await getAuthHeader(createdTenantId);
      const res = await app.request(`/api/tenants/${createdTenantId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
        }),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('active');
    }

    // Step 5: Process KakaoTalk webhook message
    {
      const headers = await getAuthHeader(createdTenantId);
      const kakaoRequest = {
        userRequest: {
          utterance: '안녕하세요',
          user: {
            id: 'kakao-user-lifecycle',
            properties: {},
          },
        },
        bot: {
          id: createdTenantId,
        },
        action: {
          name: 'chat',
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'kakaotalk',
        },
        body: JSON.stringify(kakaoRequest),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.version).toBe('2.0');
      expect(body.template).toBeDefined();
      expect(body.template.outputs).toHaveLength(1);
      expect(body.template.outputs[0].simpleText).toBeDefined();
      expect(body.template.outputs[0].simpleText.text).toBe('네, 무엇을 도와드릴까요?');
    }

    // Step 6: Verify KakaoTalk response format structure
    {
      const headers = await getAuthHeader(createdTenantId);
      const kakaoRequest = {
        userRequest: {
          utterance: '도움말',
          user: {
            id: 'kakao-user-lifecycle',
            properties: {},
          },
        },
        bot: {
          id: createdTenantId,
        },
        action: {
          name: 'help',
        },
      };

      const res = await app.request('/api/webhooks/messenger', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Platform-Type': 'kakaotalk',
        },
        body: JSON.stringify(kakaoRequest),
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);

      // Verify KakaoTalk SkillResponse v2.0 format
      expect(body.version).toBe('2.0');
      expect(body.template).toBeDefined();
      expect(body.template.outputs).toBeDefined();
      expect(Array.isArray(body.template.outputs)).toBe(true);
      expect(body.template.outputs.length).toBeGreaterThan(0);

      // Verify simpleText component
      const firstOutput = body.template.outputs[0];
      expect(firstOutput.simpleText).toBeDefined();
      expect(firstOutput.simpleText.text).toBeDefined();
      expect(typeof firstOutput.simpleText.text).toBe('string');
    }

    // Step 7: List tenants and verify created tenant exists
    {
      const headers = await getAuthHeader(createdTenantId);
      const res = await app.request('/api/tenants', {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);

      const tenant = body.data.find((t: any) => t.id === createdTenantId);
      expect(tenant).toBeDefined();
      expect(tenant.name).toBe('Lifecycle Test Corp');
      expect(tenant.status).toBe('active');
    }

    // Step 8: Retrieve onboarding survey and verify data
    {
      const headers = await getAuthHeader(createdTenantId);
      const res = await app.request(`/api/tenants/${createdTenantId}/survey`, {
        headers,
      }, env);

      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data.industry).toBe('technology');
      expect(body.data.preferred_tone).toBe('friendly');
      expect(body.data.preferred_language).toBe('ko');
      expect(body.data.completed_at).toBeDefined();
    }
  });
});

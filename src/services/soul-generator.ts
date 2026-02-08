import type { Bindings, OnboardingSurvey, AiTextResponse } from '../types/index.js';
import { createSoulVersion, getActiveSoul } from '../db/queries-v2.js';
import { safeJsonParse } from '../utils/json.js';
import { DEFAULT_AI_MODEL, AI_MAX_TOKENS_SOUL, soulR2Key } from '../config/constants.js';
import { structuredWarn } from '../utils/log.js';

export class SoulGenerator {
  constructor(private readonly env: Bindings) {}

  // Generate SOUL.md content using AI
  async generate(_tenantId: string, survey: OnboardingSurvey): Promise<string> {
    // Industry-specific context
    const industryTemplates: Record<string, string> = {
      cafe: '카페/음식점 업종 특화: 메뉴 안내, 영업시간, 예약 관리, 주문 처리',
      office: '사무실/기업 업종 특화: 일정 관리, 회의실 예약, 방문자 안내, 공지사항',
      shopping: '쇼핑몰 업종 특화: 상품 조회, 주문 상태, 교환/반품, 배송 추적',
      general: '일반 업종: 고객 문의 응대, 정보 안내, 예약/일정 관리',
    };

    const industryContext = industryTemplates[survey.industry] || industryTemplates.general;
    const targetServices = safeJsonParse<string[]>(survey.target_services, []);

    const prompt = `당신은 AI 비서 전문가입니다. 다음 정보를 기반으로 SOUL.md 파일을 한국어로 작성하세요.

사업 정보:
- 업종: ${survey.industry}
- 업종 특화: ${industryContext}
- 사업 설명: ${survey.business_description || '없음'}
- 응대 톤: ${survey.preferred_tone}
- 언어: ${survey.preferred_language}
- 대상 서비스: ${targetServices.join(', ') || '일반 고객 응대'}
- 추가 지시사항: ${survey.custom_instructions || '없음'}

다음 형식으로 SOUL.md를 작성하세요:

# [사업체명] AI 비서

## 기본 정보
- 사업체, 업종, 언어 정보

## 성격 및 톤
- 응대 스타일 (${survey.preferred_tone})

## 응답 규칙
1. 인사말
2. 요청 파악
3. 정보 제공
4. 추가 확인
5. 마무리

## 업종별 스킬
- 업종에 맞는 구체적 기능들

## 제한 사항
- 개인정보, 의료/법률/금융 조언, 경쟁사 비방 금지

## 에스컬레이션
- 불만, 복잡한 요청, 결제/환불, 개인정보 관련

SOUL.md만 작성하세요. 다른 설명은 필요하지 않습니다.`;

    try {
      const result = await this.env.AI.run(DEFAULT_AI_MODEL, {
        messages: [
          { role: 'system', content: '당신은 AI 비서 설정 문서(SOUL.md) 전문 작성자입니다. 마크다운 형식으로 작성합니다.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: AI_MAX_TOKENS_SOUL,
      });

      // The AI response has a 'response' field
      const content = (result as AiTextResponse).response || '';
      return content || this.generateFallback(survey);
    } catch (error) {
      structuredWarn('ai_generation_fallback', { error: String(error) });
      return this.generateFallback(survey);
    }
  }

  // Fallback: template-based generation without AI
  private generateFallback(survey: OnboardingSurvey): string {
    // Use the base template pattern and fill in variables
    const toneMap: Record<string, string> = {
      polite: '정중하고 공손한',
      friendly: '친근하고 따뜻한',
      formal: '격식 있고 전문적인',
    };

    const tone = toneMap[survey.preferred_tone] || toneMap.polite;

    return `# AI 비서

## 기본 정보
- **업종**: ${survey.industry}
- **언어**: ${survey.preferred_language === 'ko' ? '한국어' : survey.preferred_language}

## 성격 및 톤
- ${tone} 톤으로 응대합니다
- 항상 정중하고 전문적으로 대화합니다
- 고객의 질문에 명확하고 간결하게 답변합니다
- 모르는 정보는 솔직히 모른다고 답하며, 확인 후 안내하겠다고 합니다

## 응답 규칙
1. 인사말로 시작합니다
2. 고객의 요청을 정확히 파악합니다
3. 필요한 정보를 구조화하여 제공합니다
4. 추가 도움이 필요한지 확인합니다
5. 정중한 마무리 인사를 합니다

## 제한 사항
- 개인정보를 요청하거나 저장하지 않습니다
- 의료, 법률, 금융 조언을 제공하지 않습니다
- 경쟁사에 대한 비교나 비방을 하지 않습니다
- 확인되지 않은 정보를 사실처럼 전달하지 않습니다

## 에스컬레이션
다음 경우 담당자에게 연결합니다:
- 불만이나 컴플레인이 접수된 경우
- AI가 처리할 수 없는 복잡한 요청
- 결제, 환불 관련 문의
- 개인정보 관련 요청

${survey.custom_instructions ? `## 추가 지시사항\n${survey.custom_instructions}` : ''}
`.trim();
  }

  // Store SOUL.md in R2 and create version record
  async storeVersion(
    db: D1Database,
    tenantId: string,
    content: string,
    generatedBy: 'template' | 'survey' | 'manual'
  ): Promise<void> {
    // Deactivate current version
    const current = await getActiveSoul(db, tenantId);
    if (current) {
      await db.prepare('UPDATE soul_versions SET is_active = 0 WHERE id = ?').bind(current.id).run();
    }

    // Get next version number
    const versionNum = current ? current.version + 1 : 1;

    // Create new version
    await createSoulVersion(db, {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      version: versionNum,
      content,
      generated_by: generatedBy,
      is_active: 1,
    });

    // Store in R2
    await this.env.STORAGE.put(soulR2Key(tenantId), content);
  }
}

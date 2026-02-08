# SOUL.md 작성 매뉴얼
> 버전: 0.1.0 | 최종 수정: 2026-02-08
> 담당 팀: persona | 관련 파이프라인: persona-crafting

## 개요
고객의 업종과 선호도에 맞춘 AI 비서의 페르소나를 정의하는 SOUL.md 파일을 생성하고 검증하는 절차입니다.
고객이 만족할 때까지 반복적으로 개선할 수 있습니다.

**목적**: 고객 맞춤형 AI 비서 페르소나 정의
**적용 범위**: 온보딩 완료된 모든 고객 (초기 + 재설정 요청 시)

## 사전 조건
- 온보딩 파이프라인 완료 (컨테이너, DB, KV, R2 준비됨)
- 고객 설문 데이터 수집 완료:
  - `industry` (업종)
  - `main_tasks` (주요 업무 3-5개)
  - `tone_preference` (formal/casual/friendly)
  - `response_style` (concise/detailed/conversational)
  - `special_requirements` (선택사항: 특별 요구사항)
- SOUL.md 템플릿 라이브러리 준비 (`templates/souls/`)

## 절차

### Step 1: 고객 설문 데이터 수신
- **담당**: `persona-agent`
- **도구**: Queue 리스너 (PERSONA_QUEUE)
- **입력**: 온보딩 파이프라인에서 전달된 메시지
- **실행**:
  ```javascript
  const message = await env.PERSONA_QUEUE.receive();
  const { customer_id, industry, preferred_messenger } = message.data;

  // D1에서 고객 설문 데이터 조회
  const survey = await env.DB.prepare(`
    SELECT industry, main_tasks, tone_preference,
           response_style, special_requirements
    FROM customer_surveys
    WHERE customer_id = ?
  `).bind(customer_id).first();

  if (!survey) {
    // 설문 미완료 시 기본값 사용
    survey = {
      industry: industry || 'general',
      main_tasks: ['정보 조회', '일정 관리', '문서 작성'],
      tone_preference: 'friendly',
      response_style: 'balanced'
    };
  }
  ```
- **예상 소요시간**: 5초
- **성공 기준**:
  - `survey` 객체에 필수 필드 존재
  - `main_tasks` 배열에 1개 이상 항목
- **실패 시**:
  - DB 조회 실패 → 재시도 3회
  - 데이터 누락 → 기본값으로 계속 진행

### Step 2: 업종별 SOUL.md 템플릿 선택
- **담당**: `persona-agent`
- **도구**: R2 Storage (템플릿 라이브러리)
- **입력**: `industry`
- **실행**:
  ```javascript
  // 업종 매핑
  const industryMap = {
    'healthcare': 'souls/healthcare-assistant.md',
    'retail': 'souls/retail-support.md',
    'education': 'souls/education-tutor.md',
    'finance': 'souls/finance-advisor.md',
    'manufacturing': 'souls/manufacturing-coordinator.md',
    'legal': 'souls/legal-assistant.md',
    'default': 'souls/general-assistant.md'
  };

  const templatePath = industryMap[industry] || industryMap['default'];
  const template = await env.R2_STORAGE.get(`templates/${templatePath}`);

  if (!template) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const soulContent = await template.text();
  ```
- **예상 소요시간**: 3초
- **성공 기준**:
  - 템플릿 파일 존재
  - 파일 크기 > 500 bytes
  - 필수 섹션 존재: `## Identity`, `## Personality`, `## Skills`
- **실패 시**:
  - 템플릿 누락 → `default` 템플릿 사용
  - R2 읽기 실패 → 운영자 알림

### Step 3: 고객 정보로 템플릿 커스터마이징
- **담당**: `persona-agent`
- **도구**: AI 모델 (Claude Haiku) + 템플릿 엔진
- **입력**: 템플릿 + 고객 설문 데이터
- **실행**:
  ```javascript
  // AI 모델로 커스터마이징
  const customizedSoul = await callAI({
    model: 'claude-3-haiku',
    prompt: `
      다음 SOUL.md 템플릿을 고객 정보에 맞게 커스터마이징하세요.

      템플릿:
      ${soulContent}

      고객 정보:
      - 업종: ${survey.industry}
      - 주요 업무: ${survey.main_tasks.join(', ')}
      - 톤: ${survey.tone_preference}
      - 응답 스타일: ${survey.response_style}
      - 특별 요구사항: ${survey.special_requirements || '없음'}

      지침:
      1. Identity 섹션에 업종 특화 소개 추가
      2. Personality에 톤 설정 반영
      3. Skills 섹션에 주요 업무 관련 스킬 강조
      4. 특별 요구사항을 Constraints에 반영
      5. 기존 구조는 유지하되 내용만 변경

      SOUL.md 형식으로 출력하세요.
    `,
    max_tokens: 3000
  });

  // 변수 치환 (회사명 등)
  const finalSoul = customizedSoul
    .replace(/{{COMPANY_NAME}}/g, company_name)
    .replace(/{{CUSTOMER_ID}}/g, customer_id);
  ```
- **예상 소요시간**: 10-15초
- **성공 기준**:
  - 출력이 유효한 Markdown 형식
  - 필수 섹션 모두 포함
  - 고객 정보(업종, 업무)가 본문에 반영됨
- **실패 시**:
  - AI 호출 실패 → 재시도 2회
  - 2회 실패 → 템플릿을 그대로 사용 (최소한의 변수 치환만)

### Step 4: 기본 스킬 팩 선택
- **담당**: `persona-agent`
- **도구**: 스킬 카탈로그 매칭 로직
- **입력**: `industry`, `main_tasks`
- **실행**:
  ```javascript
  // 업종별 추천 스킬 세트
  const skillPacks = {
    healthcare: [
      'appointment-scheduling',
      'patient-inquiry',
      'medical-record-lookup',
      'prescription-reminder'
    ],
    retail: [
      'inventory-check',
      'order-status',
      'customer-support',
      'product-recommendation'
    ],
    education: [
      'course-info',
      'grade-inquiry',
      'assignment-reminder',
      'study-material-search'
    ],
    default: [
      'basic-chat',
      'web-search',
      'calendar-management',
      'document-generation'
    ]
  };

  const recommendedSkills = skillPacks[industry] || skillPacks.default;

  // main_tasks 키워드 기반 추가 스킬 추천
  for (const task of survey.main_tasks) {
    if (task.includes('일정') || task.includes('캘린더')) {
      recommendedSkills.push('calendar-sync');
    }
    if (task.includes('이메일') || task.includes('메일')) {
      recommendedSkills.push('email-assistant');
    }
    if (task.includes('문서') || task.includes('작성')) {
      recommendedSkills.push('document-generation');
    }
  }

  // 중복 제거
  const uniqueSkills = [...new Set(recommendedSkills)];
  ```
- **예상 소요시간**: 2초
- **성공 기준**:
  - 최소 3개 이상 스킬 선택
  - 모든 스킬이 스킬 카탈로그에 존재
- **실패 시**:
  - 스킬 누락 → `default` 팩 사용

### Step 5: SOUL.md를 OpenClaw 인스턴스에 적용
- **담당**: `persona-agent`
- **도구**: R2 Storage + HTTP API
- **입력**: `customer_id`, `finalSoul`, `uniqueSkills`
- **실행**:
  ```javascript
  // R2에 SOUL.md 저장
  await env.R2_STORAGE.put(
    `customers/${customer_id}/SOUL.md`,
    finalSoul,
    { metadata: { version: '1.0', created_at: new Date().toISOString() } }
  );

  // 백업 생성
  await env.R2_STORAGE.put(
    `customers/${customer_id}/backups/soul-${Date.now()}.md`,
    finalSoul
  );

  // 컨테이너에 SOUL 로드 요청
  const response = await fetch(
    `https://openclaw-${customer_id}.workers.dev/soul/reload`,
    {
      method: 'POST',
      headers: { 'X-Admin-Token': env.ADMIN_SECRET },
      body: JSON.stringify({
        soul_content: finalSoul,
        skills: uniqueSkills
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Soul reload failed: ${response.statusText}`);
  }
  ```
- **예상 소요시간**: 5초
- **성공 기준**:
  - R2 저장 성공
  - `/soul/reload` 엔드포인트가 200 응답
  - 백업 파일 생성 확인
- **실패 시**:
  - R2 저장 실패 → 재시도
  - 로드 실패 → 컨테이너 재시작 후 재시도

### Step 6: 테스트 대화 3회 실행
- **담당**: `persona-agent`
- **도구**: OpenClaw 인스턴스 (테스트 모드)
- **입력**: 업종별 테스트 시나리오
- **실행**:
  ```javascript
  const testScenarios = [
    {
      input: '안녕하세요, 소개 좀 해주세요.',
      expectation: 'identity_consistent' // 정체성 일관성 체크
    },
    {
      input: survey.main_tasks[0], // 주요 업무 1번
      expectation: 'skill_relevant' // 관련 스킬 활성화 체크
    },
    {
      input: '어떤 일을 도와줄 수 있나요?',
      expectation: 'capability_clear' // 역량 명확성 체크
    }
  ];

  const testResults = [];
  for (const scenario of testScenarios) {
    const response = await fetch(
      `https://openclaw-${customer_id}.workers.dev/chat`,
      {
        method: 'POST',
        body: JSON.stringify({
          message: scenario.input,
          test_mode: true
        })
      }
    );

    const result = await response.json();
    testResults.push({
      input: scenario.input,
      output: result.message,
      tone: analyzeTone(result.message), // formal/casual/friendly 판정
      skills_used: result.skills_used,
      passed: validateExpectation(result, scenario.expectation)
    });
  }

  // 전체 통과율 계산
  const passRate = testResults.filter(r => r.passed).length / testResults.length;
  ```
- **예상 소요시간**: 20-30초 (모델 응답 시간 포함)
- **성공 기준**:
  - 3개 시나리오 모두 응답 수신
  - 통과율 >= 66% (3개 중 2개 이상 통과)
  - 톤이 `survey.tone_preference`와 일치
- **실패 시**:
  - 통과율 < 66% → Step 3으로 돌아가서 커스터마이징 재실행 (최대 2회)
  - 응답 없음 → 컨테이너 헬스체크

### Step 7: 결과를 고객에게 미리보기로 전송
- **담당**: `persona-agent`
- **도구**: 메신저 통합 (preferred_messenger)
- **입력**: `customer_id`, `testResults`
- **실행**:
  ```javascript
  // 미리보기 메시지 구성
  const previewMessage = `
🎉 AI 비서 페르소나가 준비되었습니다!

<테스트 대화 샘플>
${testResults.map((r, i) => `
${i+1}. 질문: ${r.input}
   답변: ${r.output.substring(0, 100)}...
`).join('\n')}

✅ 페르소나 톤: ${survey.tone_preference}
✅ 활성화된 스킬: ${uniqueSkills.length}개

이 페르소나가 마음에 드시나요?
👍 좋아요 (사용 시작)
🔄 수정 요청
  `;

  // 메신저로 전송
  await sendMessengerMessage({
    customer_id,
    messenger: preferred_messenger,
    message: previewMessage,
    buttons: [
      { action: 'approve', label: '좋아요' },
      { action: 'request_edit', label: '수정 요청' }
    ]
  });

  // D1에 상태 기록
  await env.DB.prepare(`
    UPDATE customers
    SET persona_status = 'pending_approval',
        persona_preview_sent_at = ?
    WHERE id = ?
  `).bind(new Date().toISOString(), customer_id).run();
  ```
- **예상 소요시간**: 5초
- **성공 기준**:
  - 메신저 전송 성공 (응답 코드 200)
  - DB 상태 업데이트 확인
- **실패 시**:
  - 메신저 전송 실패 → 이메일로 대체 발송
  - 이메일도 실패 → 운영자 알림

## Human Gate 조건
**고객 승인 필요**: Step 7 이후 고객이 페르소나에 만족하지 않을 경우

### 수정 요청 처리 절차
1. 고객이 "수정 요청" 버튼 클릭 시:
   ```javascript
   // 추가 설문 발송
   await sendMessengerMessage({
     customer_id,
     message: `어떤 부분을 수정하면 좋을까요?

     1️⃣ 말투가 너무 딱딱해요 / 캐주얼해요
     2️⃣ 답변이 너무 짧아요 / 길어요
     3️⃣ 전문 용어가 필요해요 / 쉬운 말로 해주세요
     4️⃣ 기타 (직접 입력)`,
     buttons: [...]
   });
   ```

2. 고객 피드백 수신 → Step 3으로 돌아가서 재커스터마이징
   - 피드백을 AI 프롬프트에 추가
   - 최대 3회 반복 가능

3. 3회 반복 후에도 불만족 시:
   - 운영자(persona-specialist)에게 에스컬레이션
   - 수동 SOUL.md 작성 요청

### 자동 승인 조건
- 고객이 24시간 내 응답 없음 → 자동 승인 (기본값 사용)
- 고객이 "좋아요" 버튼 클릭 → 즉시 승인

## 버전 관리
- 모든 SOUL.md 변경은 R2 `backups/` 에 타임스탬프와 함께 저장
- 고객이 이전 버전으로 롤백 요청 시:
  ```javascript
  await env.R2_STORAGE.copy(
    `customers/${customer_id}/backups/soul-${backup_timestamp}.md`,
    `customers/${customer_id}/SOUL.md`
  );
  ```

## 모니터링
- Grafana 대시보드:
  - 페르소나 생성 성공률
  - 고객 승인률
  - 평균 수정 요청 횟수
  - 업종별 템플릿 사용 분포

## 변경 이력
| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1.0 | 2026-02-08 | 초안 작성 |

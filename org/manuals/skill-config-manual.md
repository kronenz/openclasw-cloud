# 스킬 설정 매뉴얼
> 버전: 0.1.0 | 최종 수정: 2026-02-08
> 담당 팀: persona + skill-dev | 관련 파이프라인: persona-crafting, skill-deployment

## 개요
고객의 업무 요구사항에 맞춰 AI 비서의 스킬을 선택, 활성화, 테스트하는 절차입니다.
100+ 개의 사전 구축된 스킬 카탈로그에서 매칭하며, 필요 시 커스텀 스킬 개발로 에스컬레이션합니다.

**목적**: 고객 맞춤형 스킬 세트 구성
**적용 범위**: 초기 온보딩 + 스킬 추가/변경 요청 시

## 사전 조건
- SOUL.md 작성 완료 (persona-crafting 파이프라인)
- 스킬 카탈로그 DB 준비 (D1 `skills` 테이블)
- 스킬 바이너리 저장소 (R2 `skills/`)
- 통합 테스트 환경 (샌드박스 컨테이너)

## 절차

### Step 1: 고객 요구사항에서 필요 스킬 목록 도출
- **담당**: `skill-analyst-agent`
- **도구**: AI 모델 (Claude Haiku) + NLP 분석
- **입력**:
  - `customer_survey.main_tasks` (주요 업무 목록)
  - `customer_survey.special_requirements` (특별 요구사항)
  - `industry` (업종)
- **실행**:
  ```javascript
  // AI 모델로 요구사항 분석
  const skillRequirements = await callAI({
    model: 'claude-3-haiku',
    prompt: `
      다음 고객 요구사항에서 필요한 스킬 목록을 도출하세요.

      업종: ${industry}
      주요 업무: ${survey.main_tasks.join(', ')}
      특별 요구사항: ${survey.special_requirements}

      출력 형식 (JSON):
      [
        {
          "skill_name": "스킬 이름",
          "reason": "필요 이유",
          "priority": "high/medium/low",
          "keywords": ["키워드1", "키워드2"]
        }
      ]
    `,
    response_format: 'json'
  });

  // 키워드 기반 추가 분석
  const keywords = extractKeywords(survey.main_tasks.join(' '));
  const keywordSkills = await env.DB.prepare(`
    SELECT skill_id, name, category
    FROM skills
    WHERE keywords LIKE ANY(?)
  `).bind(keywords.map(k => `%${k}%`)).all();

  // 결합 및 중복 제거
  const allRequiredSkills = [
    ...skillRequirements,
    ...keywordSkills.map(s => ({
      skill_name: s.name,
      skill_id: s.skill_id,
      priority: 'medium',
      source: 'keyword_match'
    }))
  ];
  ```
- **예상 소요시간**: 10초
- **성공 기준**:
  - 최소 3개 이상 스킬 도출
  - 각 스킬에 `priority` 필드 존재
- **실패 시**:
  - AI 호출 실패 → 키워드 매칭만 사용
  - 스킬 0개 → 기본 스킬 팩 사용

### Step 2: 기존 스킬 카탈로그에서 매칭
- **담당**: `skill-analyst-agent`
- **도구**: D1 Database (스킬 카탈로그)
- **입력**: `allRequiredSkills`
- **실행**:
  ```javascript
  // 스킬 카탈로그에서 정확히 일치하는 스킬 검색
  const matchedSkills = [];
  const unmatchedRequirements = [];

  for (const requirement of allRequiredSkills) {
    const skill = await env.DB.prepare(`
      SELECT skill_id, name, category, version,
             dependencies, requires_auth, description
      FROM skills
      WHERE name = ? OR keywords LIKE ?
      ORDER BY usage_count DESC
      LIMIT 1
    `).bind(
      requirement.skill_name,
      `%${requirement.skill_name}%`
    ).first();

    if (skill) {
      matchedSkills.push({
        ...skill,
        priority: requirement.priority,
        match_source: requirement.source || 'ai_analysis'
      });
    } else {
      unmatchedRequirements.push(requirement);
    }
  }

  // 카테고리별 그룹화
  const skillsByCategory = matchedSkills.reduce((acc, skill) => {
    acc[skill.category] = acc[skill.category] || [];
    acc[skill.category].push(skill);
    return acc;
  }, {});

  console.log(`매칭 성공: ${matchedSkills.length}개`);
  console.log(`매칭 실패: ${unmatchedRequirements.length}개`);
  ```
- **예상 소요시간**: 5초
- **성공 기준**:
  - 매칭률 >= 70% (전체 요구사항 중 70% 이상 매칭)
  - `matchedSkills` 배열에 최소 3개 스킬
- **실패 시**:
  - 매칭률 < 70% → Step 6으로 에스컬레이션 (커스텀 스킬 개발)
  - DB 조회 실패 → 재시도 3회

### Step 3: 스킬 의존성 확인
- **담당**: `skill-analyst-agent`
- **도구**: 의존성 그래프 분석
- **입력**: `matchedSkills`
- **실행**:
  ```javascript
  const skillsWithDependencies = [];
  const missingDependencies = [];

  for (const skill of matchedSkills) {
    const deps = JSON.parse(skill.dependencies || '[]');

    // 의존성 스킬 확인
    const depSkills = await env.DB.prepare(`
      SELECT skill_id, name FROM skills WHERE skill_id IN (${deps.join(',')})
    `).all();

    if (depSkills.length < deps.length) {
      missingDependencies.push({
        skill: skill.name,
        missing: deps.filter(d => !depSkills.some(ds => ds.skill_id === d))
      });
    }

    // OAuth/API 키 필요 여부 확인
    if (skill.requires_auth) {
      const authConfig = JSON.parse(skill.requires_auth);
      skill.auth_required = authConfig; // { type: 'oauth', provider: 'google' }
    }

    skillsWithDependencies.push({
      ...skill,
      resolved_dependencies: depSkills,
      dependency_status: depSkills.length === deps.length ? 'satisfied' : 'missing'
    });
  }

  // 누락된 의존성 자동 추가
  for (const missing of missingDependencies) {
    const depSkill = await env.DB.prepare(`
      SELECT * FROM skills WHERE skill_id = ?
    `).bind(missing.missing[0]).first();

    if (depSkill) {
      matchedSkills.push({
        ...depSkill,
        priority: 'low',
        match_source: 'dependency'
      });
    }
  }
  ```
- **예상 소요시간**: 8초
- **성공 기준**:
  - 모든 스킬의 `dependency_status = 'satisfied'`
  - OAuth 필요 스킬에 `auth_required` 필드 존재
- **실패 시**:
  - 의존성 해결 불가 → 해당 스킬 제외하고 계속 진행
  - 순환 의존성 발견 → 운영자 알림

### Step 4: 스킬 활성화
- **담당**: `skill-deployment-agent`
- **도구**: R2 Storage + OpenClaw 인스턴스 API
- **입력**: `customer_id`, `skillsWithDependencies`
- **실행**:
  ```javascript
  const activationResults = [];

  for (const skill of skillsWithDependencies) {
    try {
      // R2에서 스킬 바이너리 다운로드
      const skillBinary = await env.R2_STORAGE.get(
        `skills/${skill.skill_id}/${skill.version}/skill.wasm`
      );

      if (!skillBinary) {
        throw new Error(`Skill binary not found: ${skill.skill_id}`);
      }

      // 고객 R2 저장소에 복사
      await env.R2_STORAGE.put(
        `customers/${customer_id}/skills/${skill.skill_id}.wasm`,
        skillBinary.body
      );

      // 스킬 메타데이터 저장
      await env.R2_STORAGE.put(
        `customers/${customer_id}/skills/${skill.skill_id}.json`,
        JSON.stringify({
          skill_id: skill.skill_id,
          name: skill.name,
          version: skill.version,
          enabled: true,
          config: skill.default_config || {},
          auth_required: skill.auth_required || null
        })
      );

      // OpenClaw 인스턴스에 스킬 로드
      const response = await fetch(
        `https://openclaw-${customer_id}.workers.dev/skills/load`,
        {
          method: 'POST',
          headers: { 'X-Admin-Token': env.ADMIN_SECRET },
          body: JSON.stringify({
            skill_id: skill.skill_id,
            wasm_path: `customers/${customer_id}/skills/${skill.skill_id}.wasm`
          })
        }
      );

      activationResults.push({
        skill_id: skill.skill_id,
        status: response.ok ? 'success' : 'failed',
        error: response.ok ? null : await response.text()
      });

    } catch (error) {
      activationResults.push({
        skill_id: skill.skill_id,
        status: 'failed',
        error: error.message
      });
    }
  }

  const successCount = activationResults.filter(r => r.status === 'success').length;
  console.log(`활성화 성공: ${successCount}/${skillsWithDependencies.length}`);
  ```
- **예상 소요시간**: 30-60초 (스킬 수에 비례)
- **성공 기준**:
  - 활성화 성공률 >= 90%
  - 모든 high priority 스킬 활성화 성공
- **실패 시**:
  - 개별 스킬 실패 → 로그 남기고 계속 진행
  - 전체 실패율 > 10% → 운영자 알림

### Step 5: 스킬별 통합 테스트 실행
- **담당**: `skill-test-agent`
- **도구**: 샌드박스 컨테이너 + 테스트 시나리오
- **입력**: `customer_id`, 활성화된 스킬 목록
- **실행**:
  ```javascript
  const testResults = [];

  for (const skill of activationResults.filter(r => r.status === 'success')) {
    // 스킬별 테스트 시나리오 로드
    const testScenario = await env.R2_STORAGE.get(
      `skills/${skill.skill_id}/test-scenario.json`
    );

    if (!testScenario) {
      console.warn(`No test scenario for ${skill.skill_id}`);
      continue;
    }

    const scenario = await testScenario.json();

    // 테스트 실행
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

    // 결과 검증
    const passed = validateTestResult(result, scenario.expected_output);

    testResults.push({
      skill_id: skill.skill_id,
      skill_name: skill.name,
      input: scenario.input,
      output: result.message,
      skills_invoked: result.skills_used,
      passed: passed,
      error: passed ? null : result.error
    });
  }

  const passRate = testResults.filter(r => r.passed).length / testResults.length;
  console.log(`테스트 통과율: ${(passRate * 100).toFixed(1)}%`);
  ```
- **예상 소요시간**: 1-2분 (스킬 수에 비례)
- **성공 기준**:
  - 테스트 통과율 >= 80%
  - 모든 high priority 스킬 테스트 통과
- **실패 시**:
  - 개별 스킬 실패 → 해당 스킬 비활성화 후 고객에게 알림
  - 통과율 < 80% → 운영자 검토 요청

### Step 6: 커스텀 스킬 필요 시 에스컬레이션
- **담당**: `skill-analyst-agent`
- **도구**: Jira/Linear (티켓 생성)
- **입력**: `unmatchedRequirements`
- **실행**:
  ```javascript
  if (unmatchedRequirements.length > 0) {
    // 커스텀 스킬 개발 티켓 생성
    for (const requirement of unmatchedRequirements) {
      const ticket = await createTicket({
        project: 'SKILL_DEV',
        type: 'custom_skill_request',
        title: `[${customer_id}] 커스텀 스킬 개발: ${requirement.skill_name}`,
        description: `
          고객 ID: ${customer_id}
          업종: ${industry}
          요구사항: ${requirement.reason}
          우선순위: ${requirement.priority}

          예상 기능:
          ${requirement.keywords.join(', ')}

          유사 스킬: (자동 검색 결과)
          ${await findSimilarSkills(requirement.skill_name)}
        `,
        priority: requirement.priority,
        labels: ['custom-skill', industry, `customer-${customer_id}`]
      });

      console.log(`티켓 생성: ${ticket.id}`);
    }

    // 고객에게 알림
    await sendMessengerMessage({
      customer_id,
      message: `요청하신 기능 중 일부는 커스텀 개발이 필요합니다.

      개발 필요 기능:
      ${unmatchedRequirements.map(r => `- ${r.skill_name}`).join('\n')}

      예상 개발 기간: ${estimateDevelopmentTime(unmatchedRequirements)}
      담당자가 곧 연락드리겠습니다.`
    });

    // skill-development 파이프라인으로 핸드오프
    await env.SKILL_DEV_QUEUE.send({
      type: 'CUSTOM_SKILL_REQUEST',
      customer_id,
      requirements: unmatchedRequirements,
      tickets: tickets.map(t => t.id)
    });
  }
  ```
- **예상 소요시간**: 10초
- **성공 기준**:
  - 각 미매칭 요구사항마다 티켓 1개 생성
  - 고객 알림 발송 성공
- **실패 시**:
  - 티켓 생성 실패 → 이메일로 운영팀에 직접 알림
  - 큐 전송 실패 → 재시도

## Human Gate 조건

### 자동 진행 가능 (Human Gate 불필요)
- 매칭률 >= 90%
- 모든 스킬이 OAuth 불필요
- 테스트 통과율 >= 95%

### Human Gate 필요 (운영자 승인)
1. **OAuth/API 키 필요 스킬 존재 시**:
   - 고객에게 인증 프로세스 안내 필요
   - 예: Google Calendar 연동 → OAuth 동의 화면

2. **커스텀 스킬 개발 필요 시** (Step 6):
   - skill-dev 팀 리뷰
   - 개발 일정 및 비용 산정

3. **테스트 통과율 < 80% 시**:
   - 운영자가 수동으로 스킬 조합 재구성

4. **민감한 권한 요구 시**:
   - 파일 시스템 접근
   - 외부 결제 API 호출
   - 개인정보 처리

## OAuth/API 키 설정 프로세스

### OAuth 필요 스킬 처리
```javascript
// OAuth 필요 스킬 감지 시
if (skill.auth_required && skill.auth_required.type === 'oauth') {
  // 고객에게 OAuth 동의 링크 발송
  const authUrl = generateOAuthUrl({
    provider: skill.auth_required.provider, // 'google', 'microsoft', etc.
    scopes: skill.auth_required.scopes,
    redirect_uri: `https://openclaw-${customer_id}.workers.dev/oauth/callback`,
    state: encodeState({ customer_id, skill_id: skill.skill_id })
  });

  await sendMessengerMessage({
    customer_id,
    message: `${skill.name} 스킬을 사용하려면 ${skill.auth_required.provider} 계정 연동이 필요합니다.`,
    buttons: [
      { label: '연동하기', url: authUrl },
      { label: '나중에', action: 'skip' }
    ]
  });

  // 스킬 상태를 'pending_auth'로 설정
  await updateSkillStatus(customer_id, skill.skill_id, 'pending_auth');
}
```

### API 키 필요 스킬 처리
```javascript
if (skill.auth_required && skill.auth_required.type === 'api_key') {
  await sendMessengerMessage({
    customer_id,
    message: `${skill.name} 스킬을 사용하려면 ${skill.auth_required.provider} API 키가 필요합니다.

    설정 방법:
    1. ${skill.auth_required.guide_url} 에서 API 키 발급
    2. 아래 명령어로 등록:
       /set-api-key ${skill.skill_id} <your-api-key>`
  });
}
```

## 모니터링
- Grafana 대시보드:
  - 스킬 활성화 성공률
  - 스킬별 사용 빈도
  - 테스트 통과율 추이
  - 커스텀 스킬 요청 건수

## 변경 이력
| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1.0 | 2026-02-08 | 초안 작성 |

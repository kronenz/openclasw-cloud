# 고객 성공 매뉴얼
> 버전: 0.1.0 | 최종 수정: 2026-02-08
> 담당 팀: customer-success | 관련 파이프라인: customer-success

## 개요
고객의 AI 비서 사용 패턴을 분석하여 리인게이지먼트, 업셀, 만족도 관리를 자동화하는 절차입니다.
고객 이탈 방지와 LTV(생애 가치) 극대화를 목표로 합니다.

**목적**: 고객 성공 자동화, 이탈 방지, 업셀 기회 발견
**적용 범위**: 모든 활성 고객 (주간/월간 분석)

## 사전 조건
- 고객 활동 로그 수집 (D1 `activity_logs` 테이블)
- 스킬 사용량 추적 (D1 `skill_usage` 테이블)
- 요금제별 한도 설정 (KV)
- 메신저/이메일 통합

## 절차

### Step 1: 주간 활동 분석
- **담당**: `customer-success-analyst-agent`
- **도구**: D1 Database + AI 분석
- **입력**: 없음 (모든 고객 대상)
- **실행**:
  ```javascript
  // Cron Trigger: 매주 월요일 09:00
  export default {
    async scheduled(event, env, ctx) {
      const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const now = new Date().toISOString();

      // 모든 고객의 주간 활동 집계
      const customers = await env.DB.prepare(`
        SELECT id, company_name, plan, admin_email, preferred_messenger
        FROM customers WHERE status = 'active'
      `).all();

      for (const customer of customers.results) {
        // 활동 데이터 수집
        const activity = await analyzeCustomerActivity(env, customer.id, oneWeekAgo, now);

        // 분석 결과 저장
        await env.DB.prepare(`
          INSERT INTO weekly_analysis (
            customer_id, week_start, week_end,
            message_count, skill_usage_count, error_count,
            top_skills, engagement_score, analysis_data,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          customer.id,
          oneWeekAgo,
          now,
          activity.message_count,
          activity.skill_usage_count,
          activity.error_count,
          JSON.stringify(activity.top_skills),
          activity.engagement_score,
          JSON.stringify(activity),
          now
        ).run();

        // 리인게이지먼트 규칙 체크
        await checkReengagementRules(env, customer, activity);

        // 업셀 규칙 체크
        await checkUpsellRules(env, customer, activity);

        console.log(`[${customer.id}] Weekly analysis completed. Engagement: ${activity.engagement_score}/100`);
      }
    }
  };

  async function analyzeCustomerActivity(env, customerId, startDate, endDate) {
    // 메시지 수
    const messageCount = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM activity_logs
      WHERE customer_id = ? AND type = 'message' AND created_at BETWEEN ? AND ?
    `).bind(customerId, startDate, endDate).first();

    // 스킬 사용
    const skillUsage = await env.DB.prepare(`
      SELECT skill_id, skill_name, COUNT(*) as usage_count
      FROM skill_usage
      WHERE customer_id = ? AND used_at BETWEEN ? AND ?
      GROUP BY skill_id, skill_name
      ORDER BY usage_count DESC
      LIMIT 10
    `).bind(customerId, startDate, endDate).all();

    // 에러 수
    const errorCount = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM activity_logs
      WHERE customer_id = ? AND type = 'error' AND created_at BETWEEN ? AND ?
    `).bind(customerId, startDate, endDate).first();

    // 사용 패턴 (시간대별)
    const hourlyPattern = await env.DB.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as count
      FROM activity_logs
      WHERE customer_id = ? AND created_at BETWEEN ? AND ?
      GROUP BY hour
      ORDER BY count DESC
    `).bind(customerId, startDate, endDate).all();

    // 참여도 점수 계산 (0-100)
    const engagementScore = calculateEngagementScore({
      message_count: messageCount.count,
      skill_usage_count: skillUsage.results.length,
      error_count: errorCount.count,
      active_days: await countActiveDays(env, customerId, startDate, endDate)
    });

    return {
      message_count: messageCount.count,
      skill_usage_count: skillUsage.results.reduce((sum, s) => sum + s.usage_count, 0),
      error_count: errorCount.count,
      top_skills: skillUsage.results,
      hourly_pattern: hourlyPattern.results,
      engagement_score: engagementScore
    };
  }

  function calculateEngagementScore(data) {
    let score = 0;

    // 메시지 수 (최대 40점)
    score += Math.min(data.message_count / 10, 40);

    // 스킬 사용 다양성 (최대 30점)
    score += Math.min(data.skill_usage_count / 5, 30);

    // 활동 일수 (최대 20점)
    score += Math.min(data.active_days / 7, 1) * 20;

    // 에러 비율 (최대 -10점 패널티)
    const errorRate = data.message_count > 0 ? data.error_count / data.message_count : 0;
    score -= Math.min(errorRate * 100, 10);

    return Math.max(0, Math.min(100, score));
  }

  async function countActiveDays(env, customerId, startDate, endDate) {
    const result = await env.DB.prepare(`
      SELECT COUNT(DISTINCT DATE(created_at)) as active_days
      FROM activity_logs
      WHERE customer_id = ? AND created_at BETWEEN ? AND ?
    `).bind(customerId, startDate, endDate).first();

    return result.active_days;
  }
  ```
- **예상 소요시간**: 10-20분 (고객 수에 비례)
- **성공 기준**: 모든 고객의 주간 분석 완료
- **실패 시**: 개별 고객 실패 시 로그만 남기고 계속 진행

### Step 2: 리인게이지먼트 규칙 적용
- **담당**: `customer-success-agent`
- **도구**: 메신저/이메일 자동화
- **입력**: 주간 활동 분석 결과
- **실행**:
  ```javascript
  async function checkReengagementRules(env, customer, activity) {
    const rules = [
      {
        condition: (act) => act.message_count === 0 && act.days_since_last_active >= 7,
        action: 'send_feature_suggestion',
        priority: 'high',
        message_template: '7_day_inactive'
      },
      {
        condition: (act) => act.message_count === 0 && act.days_since_last_active >= 14,
        action: 'operator_contact_suggestion',
        priority: 'critical',
        message_template: '14_day_inactive'
      },
      {
        condition: (act) => act.engagement_score < 30 && act.message_count > 0,
        action: 'send_tips',
        priority: 'medium',
        message_template: 'low_engagement'
      },
      {
        condition: (act) => act.error_count / act.message_count > 0.3,
        action: 'send_support_offer',
        priority: 'high',
        message_template: 'high_error_rate'
      }
    ];

    // 마지막 활동 시간 조회
    const lastActivity = await env.DB.prepare(`
      SELECT MAX(created_at) as last_active
      FROM activity_logs
      WHERE customer_id = ?
    `).bind(customer.id).first();

    const daysSinceLastActive = lastActivity.last_active
      ? Math.floor((Date.now() - new Date(lastActivity.last_active).getTime()) / 86400000)
      : 999;

    activity.days_since_last_active = daysSinceLastActive;

    // 규칙 평가
    for (const rule of rules) {
      if (rule.condition(activity)) {
        // 중복 알림 방지 (7일 내 동일 템플릿 발송 확인)
        const recentNotification = await env.KV_CONFIG.get(
          `reengagement:${customer.id}:${rule.message_template}`
        );

        if (recentNotification) {
          console.log(`Skipping duplicate notification: ${rule.message_template}`);
          continue;
        }

        // 액션 실행
        await executeReengagementAction(env, customer, rule, activity);

        // 중복 방지 플래그 설정
        await env.KV_CONFIG.put(
          `reengagement:${customer.id}:${rule.message_template}`,
          'true',
          { expirationTtl: 7 * 86400 } // 7일
        );

        console.log(`[${customer.id}] Reengagement: ${rule.action}`);
        break; // 우선순위 높은 규칙 하나만 실행
      }
    }
  }

  async function executeReengagementAction(env, customer, rule, activity) {
    const messages = {
      '7_day_inactive': `
안녕하세요, ${customer.company_name}님!

요즘 AI 비서를 사용하지 않으신 것 같아요.
이런 기능들을 한번 써보시는 건 어떨까요?

${await suggestRelevantFeatures(env, customer.id)}

궁금한 점이 있으시면 언제든 물어보세요!
      `,
      '14_day_inactive': `
안녕하세요, ${customer.company_name}님.

2주째 AI 비서를 사용하지 않으신 것 같습니다.
불편한 점이 있으셨나요?

담당자가 직접 연락드려 도와드리고 싶습니다.
📞 상담 신청: ${env.SUPPORT_URL}/callback?customer_id=${customer.id}

언제든지 연락 주세요!
      `,
      'low_engagement': `
AI 비서를 더 효과적으로 활용하는 팁을 알려드릴게요!

💡 ${await generatePersonalizedTips(env, customer.id, activity)}

더 궁금한 점이 있으시면 /help 명령어를 사용해보세요.
      `,
      'high_error_rate': `
최근 오류가 자주 발생한 것 같습니다.
불편을 드려 죄송합니다.

저희가 도와드릴 수 있는 부분:
- 기술 지원팀 연결
- 설정 최적화
- 대체 기능 안내

지원이 필요하시면 답장 주세요!
      `
    };

    const message = messages[rule.message_template];

    // 메신저로 발송
    if (customer.preferred_messenger) {
      await sendMessengerMessage({
        customer_id: customer.id,
        messenger: customer.preferred_messenger,
        message: message
      });
    } else {
      // 이메일로 발송
      await sendEmail({
        to: customer.admin_email,
        subject: '[OpenClaw] AI 비서 활용 팁',
        text: message
      });
    }

    // 14일 미사용 시 운영자에게 알림
    if (rule.message_template === '14_day_inactive') {
      await sendSlackMessage(env, `
⚠️ *High churn risk*

Customer: ${customer.company_name} (${customer.id})
Last active: ${activity.days_since_last_active} days ago
Action: Contact suggested
      `);
    }

    // 활동 로그 기록
    await env.DB.prepare(`
      INSERT INTO reengagement_logs (
        customer_id, rule_type, message_template, sent_at
      ) VALUES (?, ?, ?, ?)
    `).bind(
      customer.id,
      rule.action,
      rule.message_template,
      new Date().toISOString()
    ).run();
  }

  async function suggestRelevantFeatures(env, customerId) {
    // 업종 기반 추천
    const customer = await env.DB.prepare(`
      SELECT industry FROM customers WHERE id = ?
    `).bind(customerId).first();

    const suggestions = {
      healthcare: ['진료 예약 관리', '환자 문의 응대', '처방전 리마인더'],
      retail: ['재고 조회', '주문 상태 확인', '고객 지원'],
      education: ['과제 알림', '성적 조회', '학습 자료 검색'],
      default: ['웹 검색', '문서 작성', '일정 관리']
    };

    const features = suggestions[customer.industry] || suggestions.default;
    return features.map((f, i) => `${i + 1}. ${f}`).join('\n');
  }

  async function generatePersonalizedTips(env, customerId, activity) {
    // 사용하지 않은 스킬 중 유용한 것 추천
    const availableSkills = await env.DB.prepare(`
      SELECT skill_id, name, description
      FROM customer_skills
      WHERE customer_id = ? AND enabled = true
    `).bind(customerId).all();

    const usedSkillIds = activity.top_skills.map(s => s.skill_id);
    const unusedSkills = availableSkills.results.filter(s => !usedSkillIds.includes(s.skill_id));

    if (unusedSkills.length > 0) {
      const topUnused = unusedSkills.slice(0, 3);
      return topUnused.map(s => `- ${s.name}: ${s.description}`).join('\n');
    }

    return '스킬을 이미 잘 활용하고 계시네요! 계속 사용해보세요.';
  }
  ```
- **예상 소요시간**: 5-10분
- **성공 기준**: 규칙 조건 충족 고객에게 메시지 발송
- **실패 시**: 메시지 발송 실패 시 로그만 남김

### Step 3: 업셀 규칙 적용
- **담당**: `customer-success-agent`
- **도구**: 사용량 분석 + 메신저
- **입력**: 주간 활동 분석 결과
- **실행**:
  ```javascript
  async function checkUpsellRules(env, customer, activity) {
    const upsellRules = [
      {
        condition: (cust, act) => {
          // 스킬 사용량이 요금제 한도의 80% 이상
          const limits = { starter: 5, pro: 20, enterprise: 100 };
          const limit = limits[cust.plan];
          return act.top_skills.length >= limit * 0.8;
        },
        target_plan: 'upgrade',
        message_template: 'skill_limit_approaching'
      },
      {
        condition: (cust, act) => {
          // 특정 프리미엄 스킬을 자주 시도하지만 권한 없음
          return act.premium_skill_attempts > 5;
        },
        target_plan: 'premium_addon',
        message_template: 'premium_skill_interest'
      },
      {
        condition: (cust, act) => {
          // 월 사용량이 플랜 한도의 90% 이상
          return act.monthly_usage_percent >= 90;
        },
        target_plan: 'upgrade',
        message_template: 'usage_limit_approaching'
      },
      {
        condition: (cust, act) => {
          // Starter 플랜 + 높은 참여도 (>70)
          return cust.plan === 'starter' && act.engagement_score > 70;
        },
        target_plan: 'pro',
        message_template: 'high_engagement_upsell'
      }
    ];

    // 월간 사용량 조회
    const monthlyUsage = await env.DB.prepare(`
      SELECT SUM(estimated_cost_usd) as cost
      FROM usage_logs
      WHERE customer_id = ? AND period_start >= date('now', 'start of month')
    `).bind(customer.id).first();

    const limits = { starter: 300, pro: 1500, enterprise: 6000 };
    activity.monthly_usage_percent = (monthlyUsage.cost / limits[customer.plan]) * 100;

    // 프리미엄 스킬 시도 횟수
    const premiumAttempts = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM activity_logs
      WHERE customer_id = ? AND type = 'premium_skill_denied'
        AND created_at >= date('now', '-7 days')
    `).bind(customer.id).first();

    activity.premium_skill_attempts = premiumAttempts.count;

    // 규칙 평가
    for (const rule of upsellRules) {
      if (rule.condition(customer, activity)) {
        // 중복 업셀 방지 (30일)
        const recentUpsell = await env.KV_CONFIG.get(
          `upsell:${customer.id}:${rule.message_template}`
        );

        if (recentUpsell) {
          console.log(`Skipping duplicate upsell: ${rule.message_template}`);
          continue;
        }

        await executeUpsellAction(env, customer, rule, activity);

        await env.KV_CONFIG.put(
          `upsell:${customer.id}:${rule.message_template}`,
          'true',
          { expirationTtl: 30 * 86400 } // 30일
        );

        console.log(`[${customer.id}] Upsell: ${rule.target_plan}`);
        break;
      }
    }
  }

  async function executeUpsellAction(env, customer, rule, activity) {
    const messages = {
      'skill_limit_approaching': `
${customer.company_name}님, AI 비서를 정말 잘 활용하고 계시네요! 👏

현재 ${customer.plan} 플랜에서 스킬을 거의 다 사용 중입니다.
더 많은 기능이 필요하신가요?

✨ Pro 플랜으로 업그레이드하면:
- 20개 이상의 추가 스킬
- 우선 지원
- 고급 분석 리포트

업그레이드: ${env.BILLING_URL}/upgrade?customer_id=${customer.id}
      `,
      'premium_skill_interest': `
${activity.premium_skill_attempts}회나 프리미엄 기능을 시도하셨네요!

관심 있는 기능:
${await listInterestedPremiumSkills(env, customer.id)}

프리미엄 애드온을 추가하시면 바로 사용 가능합니다.
월 $${calculateAddonPrice(activity)} 추가

자세히 보기: ${env.BILLING_URL}/addons?customer_id=${customer.id}
      `,
      'usage_limit_approaching': `
이번 달 사용량이 90%에 도달했습니다.

남은 사용량: ${100 - activity.monthly_usage_percent.toFixed(1)}%
예상 초과 시점: ${estimateOverageDate(activity)}

상위 플랜으로 업그레이드하시면 걱정 없이 사용하실 수 있습니다.

플랜 비교: ${env.BILLING_URL}/plans
      `,
      'high_engagement_upsell': `
AI 비서를 아주 적극적으로 활용하고 계시네요!

Pro 플랜으로 업그레이드하시면:
- 5배 더 많은 월간 사용량
- 더 빠른 응답 속도 (Sonnet 모델 기본)
- 우선 지원

특별 할인: 첫 달 30% OFF
지금 업그레이드: ${env.BILLING_URL}/upgrade?promo=ACTIVE30
      `
    };

    const message = messages[rule.message_template];

    await sendMessengerMessage({
      customer_id: customer.id,
      messenger: customer.preferred_messenger,
      message: message,
      buttons: [
        { label: '플랜 보기', url: `${env.BILLING_URL}/plans` },
        { label: '나중에', action: 'dismiss' }
      ]
    });

    // 세일즈팀에 알림
    await sendSlackMessage(env, `
💰 *Upsell opportunity*

Customer: ${customer.company_name} (${customer.id})
Current plan: ${customer.plan}
Suggested: ${rule.target_plan}
Reason: ${rule.message_template}
Engagement score: ${activity.engagement_score}
      `);

    // 로그 기록
    await env.DB.prepare(`
      INSERT INTO upsell_logs (
        customer_id, current_plan, suggested_plan, reason, sent_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      customer.id,
      customer.plan,
      rule.target_plan,
      rule.message_template,
      new Date().toISOString()
    ).run();
  }
  ```
- **예상 소요시간**: 5분
- **성공 기준**: 업셀 조건 충족 고객에게 메시지 발송
- **실패 시**: 로그만 남김

### Step 4: 월간 리포트 자동 생성
- **담당**: `reporting-agent`
- **도구**: D1 Database + PDF 생성
- **입력**: 없음
- **실행**:
  ```javascript
  // Cron Trigger: 매월 1일 10:00
  export default {
    async scheduled(event, env, ctx) {
      const customers = await env.DB.prepare(`
        SELECT * FROM customers WHERE status = 'active'
      `).all();

      for (const customer of customers.results) {
        const report = await generateMonthlyReport(env, customer);

        // PDF 생성
        const pdfBuffer = await generatePDF({
          template: 'customer-monthly-report',
          data: report
        });

        // R2에 저장
        await env.R2_STORAGE.put(
          `reports/customers/${customer.id}/monthly/${report.month}.pdf`,
          pdfBuffer
        );

        // 고객에게 이메일 발송
        await sendEmail({
          to: customer.admin_email,
          subject: `[OpenClaw] ${report.month} 월간 리포트`,
          html: generateReportEmail(report),
          attachments: [
            { filename: `openclaw-report-${report.month}.pdf`, content: pdfBuffer }
          ]
        });
      }
    }
  };

  async function generateMonthlyReport(env, customer) {
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1));
    const firstDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString();
    const lastDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString();

    // 총 처리 건수
    const totalMessages = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM activity_logs
      WHERE customer_id = ? AND type = 'message' AND created_at BETWEEN ? AND ?
    `).bind(customer.id, firstDay, lastDay).first();

    // 가장 많이 사용한 스킬
    const topSkills = await env.DB.prepare(`
      SELECT skill_name, COUNT(*) as usage_count
      FROM skill_usage
      WHERE customer_id = ? AND used_at BETWEEN ? AND ?
      GROUP BY skill_name
      ORDER BY usage_count DESC
      LIMIT 5
    `).bind(customer.id, firstDay, lastDay).all();

    // 시간 절감 추정 (메시지당 평균 3분 절감)
    const timeSaved = totalMessages.count * 3;

    return {
      month: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`,
      company_name: customer.company_name,
      total_tasks: totalMessages.count,
      time_saved_minutes: timeSaved,
      top_skills: topSkills.results,
      engagement_trend: 'up' // TODO: 실제 계산
    };
  }

  function generateReportEmail(report) {
    return `
<h1>${report.company_name}님의 ${report.month} AI 비서 리포트</h1>

<h2>📊 이번 달 성과</h2>
<ul>
  <li><strong>${report.total_tasks}건</strong>의 작업 처리</li>
  <li><strong>${Math.floor(report.time_saved_minutes / 60)}시간 ${report.time_saved_minutes % 60}분</strong> 절감 (추정)</li>
</ul>

<h2>🔥 가장 많이 사용한 기능</h2>
<ol>
${report.top_skills.map(s => `<li>${s.skill_name}: ${s.usage_count}회</li>`).join('')}
</ol>

<p>다음 달에도 AI 비서와 함께 생산성을 높여보세요!</p>
    `;
  }
  ```
- **예상 소요시간**: 20-30분
- **성공 기준**: 모든 고객에게 리포트 발송
- **실패 시**: 개별 실패는 로그만 남김

### Step 5: 고객 만족도 서베이 (분기별)
- **담당**: `customer-success-agent`
- **도구**: 설문 플랫폼 (Typeform/Google Forms)
- **입력**: 없음
- **실행**:
  ```javascript
  // Cron Trigger: 분기 마지막 날 10:00
  export default {
    async scheduled(event, env, ctx) {
      const customers = await env.DB.prepare(`
        SELECT * FROM customers WHERE status = 'active'
      `).all();

      for (const customer of customers.results) {
        const surveyUrl = await createSurvey(env, customer);

        await sendEmail({
          to: customer.admin_email,
          subject: '[OpenClaw] 서비스 만족도 조사 (5분 소요)',
          html: `
<p>${customer.company_name}님, 안녕하세요!</p>

<p>더 나은 서비스를 위해 간단한 설문에 참여해주세요.</p>

<a href="${surveyUrl}">설문 시작하기 (5분)</a>

<p>감사 선물: 설문 완료 시 다음 달 10% 할인 쿠폰 증정</p>
          `
        });
      }
    }
  };
  ```
- **예상 소요시간**: 10분
- **성공 기준**: 설문 링크 발송
- **실패 시**: 로그만 남김

## Human Gate 조건

### 자동 진행 가능
- 모든 리인게이지먼트 메시지
- 업셀 제안 메시지
- 월간 리포트 발송

### Human Gate 필요
1. **할인/환불 결정**:
   - 고객이 불만족 표현 시 CS팀 개입

2. **해지 고객 대응**:
   - 14일 이상 미사용 → CS팀 직접 연락
   - 해지 요청 → 유지 협상

## 모니터링
- Grafana 대시보드:
  - 주간 참여도 추이
  - 리인게이지먼트 성공률
  - 업셀 전환율
  - 이탈 위험 고객 목록

## 변경 이력
| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1.0 | 2026-02-08 | 초안 작성 |

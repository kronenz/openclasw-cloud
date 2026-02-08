# 비용 제어 매뉴얼
> 버전: 0.1.0 | 최종 수정: 2026-02-08
> 담당 팀: operations | 관련 파이프라인: operations

## 개요
AI Gateway를 통해 고객별 AI 사용량을 모니터링하고, 요금제별 한도를 자동으로 제어하는 절차입니다.
한도 초과 시 자동 다운그레이드, 알림 발송, 서비스 제한을 수행하며 비용 폭발을 방지합니다.

**목적**: 예측 가능한 AI 비용 관리 + 고객별 공정한 사용량 제어
**적용 범위**: 모든 활성 고객 (크론 작업으로 지속 실행)

## 사전 조건
- Cloudflare AI Gateway 설정 완료
- 고객별 사용량 추적 (D1 `usage_logs` 테이블)
- 요금제별 한도 설정 (KV `plan_limits`)
- 알림 시스템 (이메일/메신저)

## 절차

### Step 1: AI Gateway 대시보드에서 고객별 사용량 수집 (크론: 매 시간)
- **담당**: `usage-collector-agent`
- **도구**: Cloudflare AI Gateway API + Cron Trigger
- **입력**: 없음 (모든 고객 대상)
- **실행**:
  ```javascript
  // Cron Trigger: 매 시간 0분
  export default {
    async scheduled(event, env, ctx) {
      const now = new Date();
      const oneHourAgo = new Date(now - 3600000);

      // 모든 활성 고객 조회
      const customers = await env.DB.prepare(`
        SELECT id, plan, container_url FROM customers WHERE status = 'active'
      `).all();

      for (const customer of customers.results) {
        // AI Gateway에서 사용량 조회
        const usage = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai-gateway/gateways/${customer.id}/usage`,
          {
            headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
            method: 'POST',
            body: JSON.stringify({
              start_time: oneHourAgo.toISOString(),
              end_time: now.toISOString()
            })
          }
        ).then(r => r.json());

        // 사용량 데이터 파싱
        const tokenUsage = usage.result.reduce((sum, req) => {
          return sum + (req.prompt_tokens || 0) + (req.completion_tokens || 0);
        }, 0);

        const requestCount = usage.result.length;
        const estimatedCost = calculateCost(usage.result); // 모델별 단가 적용

        // D1에 사용량 기록
        await env.DB.prepare(`
          INSERT INTO usage_logs (
            customer_id, period_start, period_end,
            token_count, request_count, estimated_cost_usd,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          customer.id,
          oneHourAgo.toISOString(),
          now.toISOString(),
          tokenUsage,
          requestCount,
          estimatedCost,
          now.toISOString()
        ).run();

        console.log(`[${customer.id}] Tokens: ${tokenUsage}, Cost: $${estimatedCost}`);
      }
    }
  };

  function calculateCost(requests) {
    // 모델별 단가 (2026년 기준)
    const pricing = {
      'claude-opus-4': { input: 15, output: 75 }, // per 1M tokens (USD)
      'claude-sonnet-4': { input: 3, output: 15 },
      'claude-haiku-3': { input: 0.25, output: 1.25 }
    };

    return requests.reduce((sum, req) => {
      const modelPrice = pricing[req.model] || pricing['claude-sonnet-4'];
      const inputCost = (req.prompt_tokens / 1000000) * modelPrice.input;
      const outputCost = (req.completion_tokens / 1000000) * modelPrice.output;
      return sum + inputCost + outputCost;
    }, 0);
  }
  ```
- **예상 소요시간**: 2-5분 (고객 수에 비례)
- **성공 기준**:
  - 모든 활성 고객의 사용량 기록 완료
  - `usage_logs` 테이블에 레코드 삽입 성공
- **실패 시**:
  - AI Gateway API 실패 → 재시도 3회
  - DB 삽입 실패 → 로그 파일에 백업 기록

### Step 2: 일일 한도 체크
- **담당**: `limit-checker-agent`
- **도구**: D1 Database
- **입력**: 없음 (Step 1에서 수집된 데이터 사용)
- **실행**:
  ```javascript
  // Cron Trigger: 매 시간 5분 (Step 1 완료 후)
  export default {
    async scheduled(event, env, ctx) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 모든 고객의 오늘 사용량 집계
      const dailyUsage = await env.DB.prepare(`
        SELECT
          customer_id,
          SUM(estimated_cost_usd) as daily_cost,
          SUM(token_count) as daily_tokens
        FROM usage_logs
        WHERE DATE(period_start) = ?
        GROUP BY customer_id
      `).bind(today).all();

      for (const usage of dailyUsage.results) {
        // 고객 플랜 조회
        const customer = await env.DB.prepare(`
          SELECT id, plan, company_name, admin_email, current_model
          FROM customers WHERE id = ?
        `).bind(usage.customer_id).first();

        // 플랜별 일일 한도
        const limits = {
          starter: { daily_usd: 10, monthly_usd: 300 },
          pro: { daily_usd: 50, monthly_usd: 1500 },
          enterprise: { daily_usd: 200, monthly_usd: 6000 }
        };

        const limit = limits[customer.plan];
        const usagePercent = (usage.daily_cost / limit.daily_usd) * 100;

        console.log(`[${customer.id}] Daily usage: ${usagePercent.toFixed(1)}%`);

        // 한도 도달 시 모델 자동 다운그레이드
        if (usagePercent >= 100) {
          await downgradeModel(env, customer);
        } else if (usagePercent >= 80) {
          // 80% 도달 → 경고 알림
          await sendWarningNotification(env, customer, usagePercent);
        }
      }
    }
  };

  async function downgradeModel(env, customer) {
    const modelTiers = ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3'];
    const currentIndex = modelTiers.indexOf(customer.current_model);

    if (currentIndex < modelTiers.length - 1) {
      const newModel = modelTiers[currentIndex + 1];

      // 고객 컨테이너 설정 업데이트
      await fetch(`${customer.container_url}/config/model`, {
        method: 'PUT',
        headers: { 'X-Admin-Token': env.ADMIN_SECRET },
        body: JSON.stringify({ model: newModel })
      });

      // DB 업데이트
      await env.DB.prepare(`
        UPDATE customers SET current_model = ? WHERE id = ?
      `).bind(newModel, customer.id).run();

      // 고객에게 알림
      await sendEmail({
        to: customer.admin_email,
        subject: '[OpenClaw] AI 모델 자동 다운그레이드',
        template: 'model-downgraded',
        data: {
          from_model: customer.current_model,
          to_model: newModel,
          reason: '일일 사용 한도 도달',
          reset_time: 'UTC 00:00 (한국시간 오전 9시)'
        }
      });

      console.log(`[${customer.id}] Downgraded: ${customer.current_model} → ${newModel}`);
    } else {
      // 이미 최하위 모델 → 서비스 일시 중지
      await suspendService(env, customer);
    }
  }

  async function sendWarningNotification(env, customer, usagePercent) {
    await sendEmail({
      to: customer.admin_email,
      subject: '[OpenClaw] 일일 사용량 80% 도달',
      template: 'usage-warning',
      data: {
        usage_percent: usagePercent.toFixed(1),
        plan: customer.plan,
        upgrade_url: `https://openclaw.com/billing/upgrade?customer_id=${customer.id}`
      }
    });
  }

  async function suspendService(env, customer) {
    // 컨테이너 일시 중지
    await fetch(`${customer.container_url}/admin/suspend`, {
      method: 'POST',
      headers: { 'X-Admin-Token': env.ADMIN_SECRET }
    });

    // DB 상태 업데이트
    await env.DB.prepare(`
      UPDATE customers SET status = 'suspended', suspended_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), customer.id).run();

    // 긴급 알림
    await sendEmail({
      to: customer.admin_email,
      subject: '[긴급] OpenClaw 서비스 일시 중지',
      template: 'service-suspended',
      data: {
        reason: '일일 사용 한도 초과',
        resume_time: 'UTC 00:00에 자동 재개',
        support_url: 'https://openclaw.com/support'
      }
    });
  }
  ```
- **예상 소요시간**: 3-10분 (고객 수에 비례)
- **성공 기준**:
  - 모든 고객의 한도 체크 완료
  - 초과 고객에게 알림 발송 성공
- **실패 시**:
  - 모델 다운그레이드 실패 → 운영자 알림 + 수동 처리
  - 이메일 발송 실패 → 메신저로 재시도

### Step 3: 월간 한도 80% 도달 → 알림 메시지 발송
- **담당**: `limit-checker-agent`
- **도구**: D1 Database + Email/Messenger
- **입력**: 없음
- **실행**:
  ```javascript
  // Cron Trigger: 매일 00:05 (일일 집계 후)
  export default {
    async scheduled(event, env, ctx) {
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // 월간 사용량 집계
      const monthlyUsage = await env.DB.prepare(`
        SELECT
          customer_id,
          SUM(estimated_cost_usd) as monthly_cost
        FROM usage_logs
        WHERE period_start >= ?
        GROUP BY customer_id
      `).bind(firstDayOfMonth).all();

      const limits = {
        starter: 300,
        pro: 1500,
        enterprise: 6000
      };

      for (const usage of monthlyUsage.results) {
        const customer = await env.DB.prepare(`
          SELECT * FROM customers WHERE id = ?
        `).bind(usage.customer_id).first();

        const limit = limits[customer.plan];
        const usagePercent = (usage.monthly_cost / limit) * 100;

        // 80% 도달 체크
        if (usagePercent >= 80 && usagePercent < 100) {
          await sendEmail({
            to: customer.admin_email,
            subject: '[OpenClaw] 월간 사용량 80% 도달',
            template: 'monthly-usage-80',
            data: {
              usage_percent: usagePercent.toFixed(1),
              cost_used: usage.monthly_cost.toFixed(2),
              cost_limit: limit,
              remaining_days: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()
            }
          });

          // 중복 알림 방지를 위한 플래그 설정
          await env.KV_CONFIG.put(
            `customer:${customer.id}:monthly_80_notified`,
            'true',
            { expirationTtl: 86400 * 7 } // 7일 후 만료
          );
        }
      }
    }
  };
  ```
- **예상 소요시간**: 2분
- **성공 기준**: 80% 도달 고객에게 알림 발송
- **실패 시**: 재시도 후 운영자 알림

### Step 4: 월간 한도 100% → 서비스 제한 또는 추가 과금 처리
- **담당**: `limit-checker-agent`
- **도구**: D1 Database + Stripe API (결제)
- **입력**: 없음
- **실행**:
  ```javascript
  // Cron Trigger: 매 시간 10분
  export default {
    async scheduled(event, env, ctx) {
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const monthlyUsage = await env.DB.prepare(`
        SELECT customer_id, SUM(estimated_cost_usd) as monthly_cost
        FROM usage_logs
        WHERE period_start >= ?
        GROUP BY customer_id
      `).bind(firstDayOfMonth).all();

      const limits = {
        starter: 300,
        pro: 1500,
        enterprise: 6000
      };

      for (const usage of monthlyUsage.results) {
        const customer = await env.DB.prepare(`
          SELECT * FROM customers WHERE id = ?
        `).bind(usage.customer_id).first();

        const limit = limits[customer.plan];
        const usagePercent = (usage.monthly_cost / limit) * 100;

        if (usagePercent >= 100) {
          // 고객 설정 확인: 자동 과금 vs 서비스 중지
          const billingConfig = await env.KV_CONFIG.get(`customer:${customer.id}:billing_config`, 'json');

          if (billingConfig && billingConfig.auto_billing_enabled) {
            // 자동 추가 과금
            const overage = usage.monthly_cost - limit;
            const overageCharge = overage * 1.5; // 초과 사용 시 50% 할증

            await chargeOverage(env, customer, overageCharge);
          } else {
            // 서비스 제한
            await limitService(env, customer);
          }
        }
      }
    }
  };

  async function chargeOverage(env, customer, amount) {
    // Stripe로 추가 과금
    const charge = await fetch('https://api.stripe.com/v1/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        amount: Math.ceil(amount * 100), // cents
        currency: 'usd',
        customer: customer.stripe_customer_id,
        description: `Overage charge for ${customer.company_name}`
      })
    }).then(r => r.json());

    if (charge.paid) {
      await sendEmail({
        to: customer.admin_email,
        subject: '[OpenClaw] 초과 사용량 자동 결제 완료',
        template: 'overage-charged',
        data: { amount: amount.toFixed(2) }
      });
    }
  }

  async function limitService(env, customer) {
    // 서비스 읽기 전용 모드로 전환
    await fetch(`${customer.container_url}/admin/limit`, {
      method: 'POST',
      headers: { 'X-Admin-Token': env.ADMIN_SECRET },
      body: JSON.stringify({ mode: 'read_only' })
    });

    await env.DB.prepare(`
      UPDATE customers SET status = 'limited' WHERE id = ?
    `).bind(customer.id).run();

    await sendEmail({
      to: customer.admin_email,
      subject: '[OpenClaw] 월간 사용 한도 초과',
      template: 'service-limited',
      data: {
        upgrade_url: `https://openclaw.com/billing/upgrade?customer_id=${customer.id}`
      }
    });
  }
  ```
- **예상 소요시간**: 5분
- **성공 기준**: 100% 초과 고객 처리 완료
- **실패 시**: 결제 실패 시 운영자 개입

### Step 5: 이상 사용 패턴 감지
- **담당**: `anomaly-detector-agent`
- **도구**: AI 모델 (이상 탐지) + D1 Database
- **입력**: 실시간 사용량 로그
- **실행**:
  ```javascript
  // Cron Trigger: 매 15분
  export default {
    async scheduled(event, env, ctx) {
      const fifteenMinutesAgo = new Date(Date.now() - 900000).toISOString();

      // 최근 15분 사용량 조회
      const recentUsage = await env.DB.prepare(`
        SELECT
          customer_id,
          COUNT(*) as request_count,
          SUM(token_count) as total_tokens,
          AVG(token_count) as avg_tokens_per_request
        FROM usage_logs
        WHERE period_start >= ?
        GROUP BY customer_id
      `).bind(fifteenMinutesAgo).all();

      for (const usage of recentUsage.results) {
        // 이상 패턴 감지 규칙
        const anomalies = [];

        // 1. 과도한 요청 빈도 (분당 10회 이상)
        if (usage.request_count / 15 > 10) {
          anomalies.push('high_frequency');
        }

        // 2. 비정상적으로 큰 토큰 사용 (평균 50k 이상)
        if (usage.avg_tokens_per_request > 50000) {
          anomalies.push('large_token_usage');
        }

        // 3. 루프 패턴 감지 (동일 요청 반복)
        const repeatPattern = await detectRepeatPattern(env, usage.customer_id);
        if (repeatPattern) {
          anomalies.push('repeat_loop');
        }

        if (anomalies.length > 0) {
          // 운영자 알림
          await sendOperatorAlert(env, usage.customer_id, anomalies);

          // 임시 Rate Limit 적용
          await applyRateLimit(env, usage.customer_id);
        }
      }
    }
  };

  async function detectRepeatPattern(env, customerId) {
    const logs = await env.DB.prepare(`
      SELECT message_hash FROM request_logs
      WHERE customer_id = ? AND timestamp >= datetime('now', '-15 minutes')
      ORDER BY timestamp DESC LIMIT 20
    `).bind(customerId).all();

    const hashes = logs.results.map(l => l.message_hash);
    const uniqueHashes = new Set(hashes);

    // 20개 요청 중 고유 메시지가 5개 미만 → 루프 의심
    return uniqueHashes.size < 5;
  }

  async function applyRateLimit(env, customerId) {
    await env.KV_CONFIG.put(
      `customer:${customerId}:rate_limit`,
      JSON.stringify({
        requests_per_minute: 5,
        applied_at: new Date().toISOString(),
        expires_in: 3600 // 1시간
      }),
      { expirationTtl: 3600 }
    );
  }
  ```
- **예상 소요시간**: 1-2분
- **성공 기준**: 이상 패턴 감지 및 Rate Limit 적용
- **실패 시**: 로그만 남기고 계속 진행

### Step 6: 일일 비용 리포트 생성
- **담당**: `reporting-agent`
- **도구**: D1 Database + 차트 생성 라이브러리
- **입력**: 없음
- **실행**:
  ```javascript
  // Cron Trigger: 매일 01:00
  export default {
    async scheduled(event, env, ctx) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // 전일 비용 집계
      const dailyReport = await env.DB.prepare(`
        SELECT
          SUM(estimated_cost_usd) as total_cost,
          COUNT(DISTINCT customer_id) as active_customers,
          SUM(token_count) as total_tokens,
          SUM(request_count) as total_requests
        FROM usage_logs
        WHERE DATE(period_start) = ?
      `).bind(yesterday).first();

      // 모델별 비용 분해
      const byModel = await env.DB.prepare(`
        SELECT
          model,
          SUM(estimated_cost_usd) as model_cost,
          COUNT(*) as request_count
        FROM usage_logs
        WHERE DATE(period_start) = ?
        GROUP BY model
      `).bind(yesterday).all();

      // 운영자에게 이메일 발송
      await sendEmail({
        to: env.OPERATIONS_EMAIL,
        subject: `[OpenClaw] 일일 비용 리포트 ${yesterday}`,
        template: 'daily-cost-report',
        data: {
          date: yesterday,
          total_cost: dailyReport.total_cost.toFixed(2),
          active_customers: dailyReport.active_customers,
          total_tokens: dailyReport.total_tokens.toLocaleString(),
          by_model: byModel.results
        }
      });

      // R2에 리포트 저장
      await env.R2_STORAGE.put(
        `reports/daily/${yesterday}.json`,
        JSON.stringify({ dailyReport, byModel: byModel.results })
      );
    }
  };
  ```
- **예상 소요시간**: 30초
- **성공 기준**: 리포트 이메일 발송 및 R2 저장 완료
- **실패 시**: R2 저장 실패 시 로컬 로그에 백업

### Step 7: 월간 비용 리포트 → 경영 보고서 생성
- **담당**: `reporting-agent`
- **도구**: D1 Database + PDF 생성
- **입력**: 없음
- **실행**:
  ```javascript
  // Cron Trigger: 매월 1일 02:00
  export default {
    async scheduled(event, env, ctx) {
      const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1));
      const firstDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString();
      const lastDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString();

      // 월간 비용 집계
      const monthlyReport = await env.DB.prepare(`
        SELECT
          SUM(estimated_cost_usd) as total_cost,
          COUNT(DISTINCT customer_id) as active_customers,
          AVG(estimated_cost_usd) as avg_cost_per_customer
        FROM usage_logs
        WHERE period_start >= ? AND period_start < ?
      `).bind(firstDay, lastDay).first();

      // PDF 생성 (Cloudflare Workers + html2pdf)
      const pdfBuffer = await generatePDF({
        template: 'monthly-executive-report',
        data: monthlyReport
      });

      // R2에 저장
      await env.R2_STORAGE.put(
        `reports/monthly/${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}.pdf`,
        pdfBuffer
      );

      // 경영진에게 이메일 발송
      await sendEmail({
        to: env.EXECUTIVE_EMAIL,
        subject: `[OpenClaw] 월간 경영 리포트 ${lastMonth.getFullYear()}-${lastMonth.getMonth() + 1}`,
        attachments: [{
          filename: 'report.pdf',
          content: pdfBuffer
        }]
      });
    }
  };
  ```
- **예상 소요시간**: 1분
- **성공 기준**: PDF 생성 및 이메일 발송 완료
- **실패 시**: PDF 생성 실패 시 JSON 데이터만 발송

## Human Gate 조건

### 자동 진행 가능 (Human Gate 불필요)
- 일일 한도 내 사용 (< 80%)
- 자동 과금 설정 활성화 고객

### Human Gate 필요 (운영자 승인)
1. **고객 서비스 중지 결정**:
   - 월간 한도 100% 초과 + 자동 과금 비활성화
   - 운영자가 중지 vs 유예 결정

2. **요금제 변경**:
   - 고객 요청 없이 강제 다운그레이드는 불가
   - 고객 동의 필요

3. **이상 사용 패턴 대응**:
   - Rate Limit 적용 후에도 계속되는 이상 패턴
   - 보안 사고 가능성 검토

4. **결제 실패**:
   - 초과 과금 결제 실패 시 수동 연락

## 대시보드
- Grafana 실시간 모니터링:
  - 전체 비용 추이 (시간/일/월)
  - 고객별 사용량 순위
  - 모델별 비용 분포
  - 한도 도달 고객 목록
  - 이상 패턴 알림

## 변경 이력
| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1.0 | 2026-02-08 | 초안 작성 |

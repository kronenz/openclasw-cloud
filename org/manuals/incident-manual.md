# 장애 대응 매뉴얼
> 버전: 0.1.0 | 최종 수정: 2026-02-08
> 담당 팀: operations + platform | 관련 파이프라인: incident-response

## 개요
서비스 장애를 자동으로 감지하고, 심각도에 따라 자동 복구를 시도하거나 운영자에게 에스컬레이션하는 절차입니다.
평균 복구 시간(MTTR) 최소화와 고객 영향 최소화를 목표로 합니다.

**목적**: 빠른 장애 감지 및 복구, 투명한 고객 커뮤니케이션
**적용 범위**: 모든 운영 중인 서비스 (24/7 모니터링)

## 사전 조건
- Cloudflare Workers 로그 모니터링 설정
- 헬스체크 엔드포인트 구현 (모든 컨테이너)
- R2 백업 시스템 활성화
- 운영자 긴급 연락망 (슬랙/카카오톡 웹훅)
- 포스트모템 템플릿 준비

## 심각도 분류

| 레벨 | 범위 | 영향 | 대응 시간 | 예시 |
|------|------|------|-----------|------|
| P0 | 전체 플랫폼 | 모든 고객 서비스 불가 | 즉시 (5분) | AI Gateway 다운, DNS 장애 |
| P1 | 다수 테넌트 | 10+ 고객 영향 | 15분 | 컨테이너 클러스터 장애 |
| P2 | 단일 테넌트 | 1개 고객 영향 | 30분 | 특정 고객 컨테이너 오류 |
| P3 | 기능 제한 | 특정 기능만 제한 | 1시간 | 특정 스킬 오류, 메신저 연동 지연 |

## 절차

### Step 1: 에러 감지
- **담당**: `monitoring-agent`
- **도구**: Cloudflare Workers Logs + Sentry + 헬스체크
- **입력**: 없음 (지속적 모니터링)
- **실행**:
  ```javascript
  // 1. Workers Logs Tail (실시간 스트림)
  export default {
    async tail(events) {
      for (const event of events) {
        // 에러 로그 감지
        if (event.outcome === 'exception' || event.outcome === 'exceededCpu') {
          await handleError({
            type: 'worker_exception',
            customer_id: extractCustomerId(event.scriptName),
            error: event.exceptions[0],
            timestamp: event.eventTimestamp
          });
        }

        // 응답 시간 이상 감지 (>5초)
        if (event.outcome === 'ok' && event.cpuTime > 5000) {
          await handleSlowness({
            customer_id: extractCustomerId(event.scriptName),
            response_time: event.cpuTime,
            endpoint: event.request.url
          });
        }
      }
    }
  };

  // 2. 헬스체크 (Cron: 매 5분)
  export default {
    async scheduled(event, env, ctx) {
      const customers = await env.DB.prepare(`
        SELECT id, container_url FROM customers WHERE status = 'active'
      `).all();

      for (const customer of customers.results) {
        const startTime = Date.now();

        try {
          const response = await fetch(`${customer.container_url}/health`, {
            signal: AbortSignal.timeout(10000) // 10초 타임아웃
          });

          const latency = Date.now() - startTime;

          if (!response.ok) {
            await handleError({
              type: 'healthcheck_failed',
              customer_id: customer.id,
              status_code: response.status,
              latency: latency
            });
          } else if (latency > 3000) {
            await handleSlowness({
              customer_id: customer.id,
              latency: latency
            });
          }

          // 성공 기록
          await env.KV_METRICS.put(
            `health:${customer.id}:last_success`,
            new Date().toISOString()
          );

        } catch (error) {
          await handleError({
            type: 'healthcheck_timeout',
            customer_id: customer.id,
            error: error.message
          });
        }
      }
    }
  };

  async function handleError(errorData) {
    // 에러 중복 제거 (5분 내 동일 에러는 1건으로 처리)
    const errorKey = `error:${errorData.customer_id}:${errorData.type}`;
    const existingError = await env.KV_METRICS.get(errorKey);

    if (existingError) {
      console.log('Duplicate error, skipping...');
      return;
    }

    await env.KV_METRICS.put(errorKey, 'true', { expirationTtl: 300 });

    // Incident 생성
    const incidentId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO incidents (
        id, customer_id, type, status, severity,
        error_data, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      incidentId,
      errorData.customer_id,
      errorData.type,
      'detected',
      classifySeverity(errorData),
      JSON.stringify(errorData),
      new Date().toISOString()
    ).run();

    // 심각도 분류 및 다음 단계로 전달
    await env.INCIDENT_QUEUE.send({
      incident_id: incidentId,
      ...errorData
    });
  }

  function classifySeverity(errorData) {
    // P0: 전체 플랫폼 장애
    if (errorData.type === 'gateway_down' || errorData.type === 'dns_failure') {
      return 'P0';
    }

    // P1: 다수 영향
    if (errorData.affected_customers > 10) {
      return 'P1';
    }

    // P2: 단일 테넌트 완전 장애
    if (errorData.type === 'healthcheck_failed' || errorData.type === 'worker_exception') {
      return 'P2';
    }

    // P3: 기능 제한
    return 'P3';
  }
  ```
- **예상 소요시간**: 실시간 (감지 즉시)
- **성공 기준**: 에러 발생 5초 내 감지 및 Incident 생성
- **실패 시**: 모니터링 시스템 자체 장애 → 외부 Pingdom/UptimeRobot에서 알림

### Step 2: 심각도 분류
- **담당**: `incident-manager-agent`
- **도구**: Queue 리스너 + 분류 로직
- **입력**: Incident 데이터
- **실행**:
  ```javascript
  export default {
    async queue(batch, env, ctx) {
      for (const message of batch.messages) {
        const incident = message.body;

        // Incident 정보 조회
        const incidentRecord = await env.DB.prepare(`
          SELECT * FROM incidents WHERE id = ?
        `).bind(incident.incident_id).first();

        // 심각도별 처리 경로 결정
        const severity = incidentRecord.severity;

        // 메타데이터 수집
        const metadata = await collectIncidentMetadata(env, incident);

        // 업데이트
        await env.DB.prepare(`
          UPDATE incidents
          SET status = 'classified',
              metadata = ?,
              classified_at = ?
          WHERE id = ?
        `).bind(
          JSON.stringify(metadata),
          new Date().toISOString(),
          incident.incident_id
        ).run();

        // 심각도별 처리
        if (severity === 'P0' || severity === 'P1') {
          // 즉시 운영자 알림 + 자동 복구 시도
          await sendUrgentAlert(env, incident, severity);
          await attemptAutoRecovery(env, incident);
        } else if (severity === 'P2') {
          // 자동 복구 시도
          await attemptAutoRecovery(env, incident);
        } else {
          // P3: 로그만 남기고 다음 정기 점검 시 처리
          console.log(`P3 incident logged: ${incident.incident_id}`);
        }
      }
    }
  };

  async function collectIncidentMetadata(env, incident) {
    const customer = await env.DB.prepare(`
      SELECT * FROM customers WHERE id = ?
    `).bind(incident.customer_id).first();

    // 최근 배포 확인 (롤백 판단용)
    const recentDeployments = await env.DB.prepare(`
      SELECT * FROM deployments
      WHERE customer_id = ? AND deployed_at > datetime('now', '-1 hour')
      ORDER BY deployed_at DESC LIMIT 5
    `).bind(incident.customer_id).all();

    // 최근 에러 히스토리
    const errorHistory = await env.DB.prepare(`
      SELECT COUNT(*) as error_count FROM incidents
      WHERE customer_id = ? AND detected_at > datetime('now', '-1 hour')
    `).bind(incident.customer_id).first();

    return {
      customer: customer,
      recent_deployments: recentDeployments.results,
      error_count_last_hour: errorHistory.error_count,
      platform_status: await checkPlatformStatus(env)
    };
  }
  ```
- **예상 소요시간**: 5초
- **성공 기준**: 심각도 분류 완료 및 메타데이터 수집
- **실패 시**: 기본값(P2)로 분류 후 계속 진행

### Step 3: 자동 복구 시도 (최대 3회)
- **담당**: `recovery-agent`
- **도구**: Cloudflare API + 복구 스크립트
- **입력**: Incident 데이터
- **실행**:
  ```javascript
  async function attemptAutoRecovery(env, incident) {
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      console.log(`Recovery attempt ${attempt}/${maxAttempts} for incident ${incident.incident_id}`);

      // 복구 전략 선택
      const strategy = selectRecoveryStrategy(incident.type, attempt);

      try {
        await executeRecoveryStrategy(env, incident, strategy);

        // 복구 확인 (30초 대기 후 헬스체크)
        await sleep(30000);
        const recovered = await verifyRecovery(env, incident.customer_id);

        if (recovered) {
          // 복구 성공
          await env.DB.prepare(`
            UPDATE incidents
            SET status = 'resolved',
                resolution = ?,
                resolved_at = ?
            WHERE id = ?
          `).bind(
            `Auto-recovered using ${strategy} (attempt ${attempt})`,
            new Date().toISOString(),
            incident.incident_id
          ).run();

          // 고객 알림
          await notifyCustomer(env, incident.customer_id, 'recovery_success');

          return true;
        }

      } catch (error) {
        console.error(`Recovery attempt ${attempt} failed:`, error);

        await env.DB.prepare(`
          INSERT INTO recovery_logs (
            incident_id, attempt, strategy, status, error
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
          incident.incident_id,
          attempt,
          strategy,
          'failed',
          error.message
        ).run();
      }

      // 다음 시도 전 대기 (exponential backoff)
      if (attempt < maxAttempts) {
        await sleep(Math.pow(2, attempt) * 5000); // 10s, 20s, 40s
      }
    }

    // 3회 실패 → 에스컬레이션
    return false;
  }

  function selectRecoveryStrategy(errorType, attempt) {
    const strategies = {
      healthcheck_failed: ['container_restart', 'container_recreate', 'restore_backup'],
      worker_exception: ['clear_cache', 'container_restart', 'rollback_deployment'],
      healthcheck_timeout: ['increase_resources', 'container_restart', 'restore_backup'],
      skill_error: ['disable_skill', 'reload_skills', 'restore_backup']
    };

    const strategyList = strategies[errorType] || ['container_restart', 'restore_backup', 'manual_intervention'];
    return strategyList[attempt - 1];
  }

  async function executeRecoveryStrategy(env, incident, strategy) {
    const customer = await env.DB.prepare(`
      SELECT * FROM customers WHERE id = ?
    `).bind(incident.customer_id).first();

    switch (strategy) {
      case 'container_restart':
        console.log('Restarting container...');
        await fetch(`${customer.container_url}/admin/restart`, {
          method: 'POST',
          headers: { 'X-Admin-Token': env.ADMIN_SECRET }
        });
        break;

      case 'container_recreate':
        console.log('Recreating container...');
        // Wrangler API로 컨테이너 재생성
        await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/openclaw-${incident.customer_id}/restart`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`
          }
        });
        break;

      case 'restore_backup':
        console.log('Restoring from backup...');
        // R2에서 최신 백업 복원
        const backupList = await env.R2_STORAGE.list({
          prefix: `customers/${incident.customer_id}/backups/`,
          limit: 1
        });

        if (backupList.objects.length > 0) {
          const latestBackup = backupList.objects[0];
          const backupData = await env.R2_STORAGE.get(latestBackup.key);

          await fetch(`${customer.container_url}/admin/restore`, {
            method: 'POST',
            headers: { 'X-Admin-Token': env.ADMIN_SECRET },
            body: backupData.body
          });
        }
        break;

      case 'clear_cache':
        console.log('Clearing cache...');
        await env.KV_CONFIG.delete(`customer:${incident.customer_id}:*`);
        break;

      case 'rollback_deployment':
        console.log('Rolling back deployment...');
        const previousDeployment = await env.DB.prepare(`
          SELECT * FROM deployments
          WHERE customer_id = ? AND status = 'success'
          ORDER BY deployed_at DESC LIMIT 1 OFFSET 1
        `).bind(incident.customer_id).first();

        if (previousDeployment) {
          // 이전 버전으로 롤백 로직
          await rollbackToDeployment(env, incident.customer_id, previousDeployment.id);
        }
        break;

      case 'dns_reset':
        console.log('Resetting DNS/routing...');
        // Cloudflare DNS API로 레코드 재설정
        break;

      case 'disable_skill':
        console.log('Disabling problematic skill...');
        // 에러 원인 스킬 비활성화
        const errorSkill = extractSkillFromError(incident.error_data);
        if (errorSkill) {
          await fetch(`${customer.container_url}/skills/${errorSkill}/disable`, {
            method: 'POST',
            headers: { 'X-Admin-Token': env.ADMIN_SECRET }
          });
        }
        break;

      default:
        throw new Error(`Unknown recovery strategy: ${strategy}`);
    }
  }

  async function verifyRecovery(env, customerId) {
    const customer = await env.DB.prepare(`
      SELECT container_url FROM customers WHERE id = ?
    `).bind(customerId).first();

    try {
      const response = await fetch(`${customer.container_url}/health`, {
        signal: AbortSignal.timeout(10000)
      });

      return response.ok;
    } catch {
      return false;
    }
  }
  ```
- **예상 소요시간**: 2-5분 (시도당 30-60초)
- **성공 기준**: 헬스체크 통과 (HTTP 200 응답)
- **실패 시**: 3회 실패 시 Step 4로 진행

### Step 4: 3회 실패 → 운영자 에스컬레이션
- **담당**: `incident-manager-agent`
- **도구**: 슬랙/카카오톡 웹훅 + PagerDuty
- **입력**: 복구 실패한 Incident
- **실행**:
  ```javascript
  async function escalateToOperator(env, incident) {
    // Incident 상태 업데이트
    await env.DB.prepare(`
      UPDATE incidents
      SET status = 'escalated',
          escalated_at = ?
      WHERE id = ?
    `).bind(
      new Date().toISOString(),
      incident.incident_id
    ).run();

    // 심각도에 따른 알림 채널 선택
    const severity = incident.severity;
    const alertChannels = {
      P0: ['slack_critical', 'pagerduty', 'sms'],
      P1: ['slack_urgent', 'pagerduty'],
      P2: ['slack_standard'],
      P3: ['email']
    };

    const channels = alertChannels[severity];

    // 에스컬레이션 메시지 구성
    const message = `
🚨 *INCIDENT ESCALATION* 🚨

*Severity*: ${severity}
*Incident ID*: ${incident.incident_id}
*Customer*: ${incident.customer_id}
*Type*: ${incident.type}

*Auto-recovery failed* after 3 attempts.

*Recent attempts*:
${await getRecoveryHistory(env, incident.incident_id)}

*Impact*:
- Customer service: DOWN
- Duration: ${calculateDowntime(incident.detected_at)}

*Actions needed*:
1. Review error logs: ${env.LOGS_URL}/incidents/${incident.incident_id}
2. Check platform status
3. Manual intervention required

*Quick actions*:
- 🔧 Manual recovery: /recover ${incident.incident_id}
- 📞 Contact customer: /notify ${incident.customer_id}
- 📋 View details: ${env.DASHBOARD_URL}/incidents/${incident.incident_id}
    `;

    // 알림 발송
    for (const channel of channels) {
      switch (channel) {
        case 'slack_critical':
        case 'slack_urgent':
        case 'slack_standard':
          await fetch(env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: message,
              channel: channel.replace('slack_', '#'),
              username: 'OpenClaw Incident Bot',
              icon_emoji: ':rotating_light:'
            })
          });
          break;

        case 'pagerduty':
          await fetch('https://events.pagerduty.com/v2/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              routing_key: env.PAGERDUTY_KEY,
              event_action: 'trigger',
              payload: {
                summary: `${severity}: ${incident.type} - Customer ${incident.customer_id}`,
                severity: severity.toLowerCase(),
                source: 'openclaw-monitoring',
                custom_details: incident
              }
            })
          });
          break;

        case 'sms':
          // Twilio SMS 발송
          await sendSMS(env, env.ON_CALL_PHONE, `CRITICAL: ${incident.type} affecting customer ${incident.customer_id}. Check Slack immediately.`);
          break;
      }
    }

    // 운영자 대시보드에 표시
    await env.KV_METRICS.put(
      `dashboard:active_incidents`,
      JSON.stringify(await getActiveIncidents(env)),
      { expirationTtl: 3600 }
    );
  }
  ```
- **예상 소요시간**: 10초
- **성공 기준**: 모든 알림 채널 발송 성공
- **실패 시**: 알림 실패 시 이메일로 대체

### Step 5: 고객 안내 메시지 자동 발송
- **담당**: `customer-communication-agent`
- **도구**: 메신저 통합
- **입력**: Incident 데이터
- **실행**:
  ```javascript
  async function notifyCustomer(env, customerId, status) {
    const customer = await env.DB.prepare(`
      SELECT company_name, admin_email, preferred_messenger
      FROM customers WHERE id = ?
    `).bind(customerId).first();

    const messages = {
      incident_detected: `
안녕하세요, ${customer.company_name}님.

일시적인 서비스 지연이 발생하여 자동 복구를 진행 중입니다.
불편을 드려 죄송합니다.

예상 복구 시간: 5분 이내
상태 확인: https://status.openclaw.com
      `,
      recovery_in_progress: `
복구 작업이 진행 중입니다.
잠시만 기다려 주세요. (${new Date().toLocaleTimeString('ko-KR')})
      `,
      recovery_success: `
✅ 서비스가 정상 복구되었습니다.
이용에 불편을 드려 죄송합니다.

복구 완료 시각: ${new Date().toLocaleTimeString('ko-KR')}
      `,
      escalated: `
기술팀이 문제를 확인 중입니다.
곧 연락드리겠습니다.

긴급 문의: support@openclaw.com
      `
    };

    const message = messages[status];

    // 메신저로 발송
    if (customer.preferred_messenger) {
      await sendMessengerMessage({
        customer_id: customerId,
        messenger: customer.preferred_messenger,
        message: message
      });
    }

    // 이메일로도 발송 (중요 알림)
    await sendEmail({
      to: customer.admin_email,
      subject: `[OpenClaw] 서비스 ${status === 'recovery_success' ? '복구 완료' : '알림'}`,
      text: message
    });
  }
  ```
- **예상 소요시간**: 5초
- **성공 기준**: 메신저 또는 이메일 발송 성공
- **실패 시**: 발송 실패는 로그만 남기고 계속 진행

### Step 6: 복구 완료 후 포스트모템 문서 자동 생성
- **담당**: `postmortem-agent`
- **도구**: AI 모델 (Claude Haiku) + 템플릿
- **입력**: Incident 전체 데이터
- **실행**:
  ```javascript
  async function generatePostmortem(env, incidentId) {
    // Incident 전체 데이터 조회
    const incident = await env.DB.prepare(`
      SELECT * FROM incidents WHERE id = ?
    `).bind(incidentId).first();

    // 복구 로그 조회
    const recoveryLogs = await env.DB.prepare(`
      SELECT * FROM recovery_logs WHERE incident_id = ?
    `).bind(incidentId).all();

    // AI로 포스트모템 생성
    const postmortem = await callAI({
      model: 'claude-3-haiku',
      prompt: `
다음 장애 정보를 바탕으로 포스트모템 문서를 작성하세요.

Incident 정보:
${JSON.stringify(incident, null, 2)}

복구 로그:
${JSON.stringify(recoveryLogs.results, null, 2)}

포스트모템 구조:
# Incident Postmortem: ${incidentId}

## Summary
- Date: ${incident.detected_at}
- Duration: ${calculateDowntime(incident.detected_at, incident.resolved_at)}
- Severity: ${incident.severity}
- Impact: [자동 생성]

## Timeline
[시간순 정리]

## Root Cause
[근본 원인 분석]

## Resolution
[복구 방법]

## Action Items
- [ ] [재발 방지 조치 1]
- [ ] [재발 방지 조치 2]

## Lessons Learned
[교훈]
      `,
      max_tokens: 2000
    });

    // R2에 저장
    await env.R2_STORAGE.put(
      `postmortems/${incidentId}.md`,
      postmortem
    );

    // DB에 기록
    await env.DB.prepare(`
      UPDATE incidents
      SET postmortem_url = ?
      WHERE id = ?
    `).bind(
      `https://storage.openclaw.com/postmortems/${incidentId}.md`,
      incidentId
    ).run();

    // 운영팀에 공유
    await sendSlackMessage(env, `
📋 *Postmortem generated*

Incident: ${incidentId}
View: https://storage.openclaw.com/postmortems/${incidentId}.md
    `);

    return postmortem;
  }
  ```
- **예상 소요시간**: 15초
- **성공 기준**: 포스트모템 파일 생성 및 R2 저장
- **실패 시**: 템플릿 기본값 사용

## Human Gate 조건

### 자동 진행 가능 (Human Gate 불필요)
- P3 장애 (기능 제한)
- 자동 복구 성공 (3회 시도 내)

### Human Gate 필수 (운영자 개입)
1. **P0/P1 장애**:
   - 전체 플랫폼 또는 다수 고객 영향
   - 즉시 운영자 호출 (PagerDuty)

2. **3회 자동 복구 실패**:
   - 모든 심각도에서 운영자 개입 필요
   - 수동 복구 또는 디버깅

3. **데이터 관련 이슈**:
   - 데이터 손실 가능성
   - 백업 복원 전 운영자 승인

4. **보안 사고 의심**:
   - 비정상적인 접근 패턴
   - DDoS 공격 감지

## 모니터링
- Grafana 대시보드:
  - 활성 Incident 목록
  - 심각도별 분포
  - 평균 복구 시간(MTTR)
  - 자동 복구 성공률
  - 월간 Incident 추이

## 변경 이력
| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1.0 | 2026-02-08 | 초안 작성 |

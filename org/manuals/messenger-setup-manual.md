# 메신저 연동 매뉴얼
> 버전: 0.1.0 | 최종 수정: 2026-02-08
> 담당 팀: integration | 관련 파이프라인: integration-setup

## 개요
고객이 선택한 메신저 플랫폼과 OpenClaw AI 비서를 연동하는 절차입니다.
카카오톡, 텔레그램, 슬랙, 디스코드를 지원하며, 각 플랫폼의 API 특성에 맞춘 브릿지 Worker를 배포합니다.

**목적**: 고객의 선호 메신저에서 AI 비서 사용 가능하게 만들기
**적용 범위**: 초기 온보딩 + 메신저 변경/추가 요청 시

## 사전 조건
- 스킬 설정 완료 (skill-config 파이프라인)
- 각 메신저 플랫폼별 개발자 계정:
  - 카카오톡: 카카오 비즈니스 계정
  - 텔레그램: Telegram Bot API 접근
  - 슬랙: Slack App 생성 권한
  - 디스코드: Discord Developer Portal 접근
- Cloudflare Workers 배포 권한
- Secret 저장소 (Cloudflare Workers Secrets)

## 절차

## 공통 사전 단계

### Step 0: 메신저 선택 및 정보 수집
- **담당**: `integration-agent`
- **도구**: Queue 리스너 (INTEGRATION_QUEUE)
- **입력**: `customer_id`, `preferred_messenger`
- **실행**:
  ```javascript
  const message = await env.INTEGRATION_QUEUE.receive();
  const { customer_id, preferred_messenger } = message.data;

  // 고객 정보 조회
  const customer = await env.DB.prepare(`
    SELECT company_name, admin_email, container_url
    FROM customers WHERE id = ?
  `).bind(customer_id).first();

  // 메신저별 설정 템플릿 로드
  const messengerConfig = {
    kakao: { platform: 'kakao', requires_review: true },
    telegram: { platform: 'telegram', requires_review: false },
    slack: { platform: 'slack', requires_review: false },
    discord: { platform: 'discord', requires_review: false }
  };

  const config = messengerConfig[preferred_messenger];
  if (!config) {
    throw new Error(`Unsupported messenger: ${preferred_messenger}`);
  }
  ```
- **성공 기준**: 지원되는 메신저 플랫폼 확인
- **실패 시**: 지원 불가 메신저 → 운영자 알림

---

## 카카오톡 연동

### Step 1-K: 카카오 비즈니스 API 등록
- **담당**: `integration-agent`
- **도구**: 카카오 Business API
- **입력**: `customer_id`, `company_name`
- **실행**:
  ```javascript
  // 카카오 플러스친구 채널 생성 (자동화 불가 - 웹 UI 필요)
  // → Human Gate: 고객이 직접 채널 생성 필요

  // 대신 채널 생성 가이드 발송
  await sendEmail({
    to: customer.admin_email,
    subject: '[OpenClaw] 카카오톡 연동 가이드',
    template: 'kakao-setup-guide',
    data: {
      step1: '카카오 비즈니스 (https://business.kakao.com) 로그인',
      step2: '플러스친구 채널 생성',
      step3: '채널 검색용 ID 설정',
      step4: '채널 ID를 다음 링크로 제출: https://openclaw.com/setup/kakao?customer_id=${customer_id}'
    }
  });

  // 고객 응답 대기 (웹훅으로 채널 ID 수신)
  await waitForWebhook({
    endpoint: `/setup/kakao/${customer_id}`,
    timeout: 86400000 // 24시간
  });

  // 채널 ID 수신 후
  const channelId = await getKakaoChannelId(customer_id);
  ```
- **예상 소요시간**: 24시간 (고객 작업 포함)
- **성공 기준**: 유효한 카카오 채널 ID 수신
- **실패 시**: 24시간 내 응답 없음 → 리마인더 발송
- **Human Gate**: 고객이 직접 카카오 채널 생성 필요

### Step 2-K: 알림톡/친구톡 템플릿 등록
- **담당**: `integration-agent`
- **도구**: 카카오 Notification API
- **입력**: `channelId`
- **실행**:
  ```javascript
  // 기본 메시지 템플릿 등록
  const templates = [
    {
      code: 'welcome',
      name: '환영 메시지',
      content: '안녕하세요! OpenClaw AI 비서입니다.\n무엇을 도와드릴까요?',
      buttons: [
        { name: '시작하기', type: 'WL', url_mobile: customer.container_url }
      ]
    },
    {
      code: 'error',
      name: '오류 안내',
      content: '일시적인 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.',
      buttons: [
        { name: '고객센터', type: 'WL', url_mobile: 'https://openclaw.com/support' }
      ]
    }
  ];

  for (const template of templates) {
    const response = await fetch('https://kapi.kakao.com/v2/api/kakaolink/template/register', {
      method: 'POST',
      headers: {
        'Authorization': `KakaoAK ${env.KAKAO_ADMIN_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel_id: channelId,
        template_code: template.code,
        template_name: template.name,
        template_content: template.content,
        template_buttons: template.buttons
      })
    });

    if (!response.ok) {
      throw new Error(`Template registration failed: ${template.code}`);
    }
  }
  ```
- **예상 소요시간**: 30초
- **성공 기준**: 모든 템플릿 등록 완료 (response status 200)
- **실패 시**: 재시도 3회
- **Human Gate**: 카카오 심사 필요 (영업일 기준 1-3일 소요)

### Step 3-K: 웹훅 URL 설정
- **담당**: `integration-agent`
- **도구**: Cloudflare Worker + 카카오 API
- **입력**: `customer_id`, `channelId`
- **실행**:
  ```javascript
  // Cloudflare Worker 웹훅 엔드포인트 생성
  const webhookUrl = `https://bridge-kakao-${customer_id}.openclaw.workers.dev/webhook`;

  // 카카오 채널에 웹훅 URL 등록
  await fetch('https://kapi.kakao.com/v2/api/talk/channel/callback/register', {
    method: 'POST',
    headers: {
      'Authorization': `KakaoAK ${env.KAKAO_ADMIN_KEY}`
    },
    body: JSON.stringify({
      channel_id: channelId,
      callback_url: webhookUrl
    })
  });

  // 웹훅 검증 (카카오가 테스트 메시지 발송)
  const verified = await waitForWebhookVerification(webhookUrl, 30000);
  if (!verified) {
    throw new Error('Webhook verification failed');
  }
  ```
- **예상 소요시간**: 15초
- **성공 기준**: 웹훅 검증 성공
- **실패 시**: 웹훅 URL 재생성 후 재시도

### Step 4-K: 브릿지 Worker 배포
- **담당**: `integration-agent`
- **도구**: `wrangler` CLI
- **입력**: `customer_id`, `channelId`, `container_url`
- **실행**:
  ```bash
  # 브릿지 Worker 템플릿 복사
  cp -r /templates/bridge-kakao /tmp/bridge-kakao-${customer_id}
  cd /tmp/bridge-kakao-${customer_id}

  # 환경변수 설정
  cat > .env <<EOF
  CUSTOMER_ID=${customer_id}
  KAKAO_CHANNEL_ID=${channelId}
  OPENCLAW_URL=${customer.container_url}
  ADMIN_SECRET=${env.ADMIN_SECRET}
  EOF

  # Secret 등록
  wrangler secret put KAKAO_API_KEY --env production
  # (입력: ${env.KAKAO_API_KEY})

  # 배포
  wrangler deploy --name bridge-kakao-${customer_id}
  ```
- **예상 소요시간**: 45초
- **성공 기준**: Worker가 `wrangler deployments list`에 표시
- **실패 시**: 배포 로그 확인 후 재시도

### Step 5-K: 디바이스 페어링 테스트
- **담당**: `integration-agent`
- **도구**: 카카오톡 앱
- **입력**: `customer_id`, `admin_email`
- **실행**:
  ```javascript
  // 테스트 QR 코드 생성
  const qrCode = generateQRCode({
    url: `https://pf.kakao.com/_${channelId}/chat`,
    data: { customer_id, test_mode: true }
  });

  // 고객에게 QR 코드 발송
  await sendEmail({
    to: customer.admin_email,
    subject: '[OpenClaw] 카카오톡 연동 테스트',
    html: `
      <p>QR 코드를 스캔하여 AI 비서와 대화를 시작하세요:</p>
      <img src="${qrCode}" alt="KakaoTalk QR Code" />
      <p>테스트 메시지: "안녕하세요"</p>
    `
  });

  // 테스트 메시지 수신 대기 (5분)
  const testReceived = await waitForTestMessage(customer_id, 300000);
  if (!testReceived) {
    throw new Error('Test message not received within 5 minutes');
  }
  ```
- **예상 소요시간**: 5분
- **성공 기준**: 테스트 메시지 송수신 성공
- **실패 시**: 웹훅 설정 재확인

---

## 텔레그램 연동

### Step 1-T: BotFather로 봇 생성
- **담당**: `integration-agent`
- **도구**: Telegram Bot API
- **입력**: `customer_id`, `company_name`
- **실행**:
  ```javascript
  // Telegram Bot API로 봇 생성
  const botName = `openclaw_${customer_id}_bot`;
  const botDisplayName = `${company_name} AI Assistant`;

  // BotFather API 호출 (비공식 - 실제로는 수동 필요)
  // → 대신 자동화된 워크플로우 사용

  const response = await fetch('https://api.telegram.org/bot${env.TELEGRAM_MASTER_TOKEN}/createBot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: botDisplayName,
      username: botName,
      description: `${company_name}의 AI 비서입니다.`
    })
  });

  const { token } = await response.json();
  console.log(`Telegram bot created: ${botName}, token: ${token}`);
  ```
- **예상 소요시간**: 10초
- **성공 기준**: 봇 토큰 수신
- **실패 시**: 봇 이름 중복 → 랜덤 suffix 추가

### Step 2-T: 봇 토큰을 Worker Secret에 저장
- **담당**: `integration-agent`
- **도구**: `wrangler` CLI
- **입력**: `customer_id`, `token`
- **실행**:
  ```bash
  # Secret 저장
  echo "${token}" | wrangler secret put TELEGRAM_BOT_TOKEN \
    --name bridge-telegram-${customer_id}
  ```
- **예상 소요시간**: 3초
- **성공 기준**: Secret 저장 확인
- **실패 시**: 재시도

### Step 3-T: 웹훅 설정
- **담당**: `integration-agent`
- **도구**: Telegram Bot API
- **입력**: `customer_id`, `token`
- **실행**:
  ```javascript
  const webhookUrl = `https://bridge-telegram-${customer_id}.openclaw.workers.dev/webhook`;

  await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true
    })
  });

  // 웹훅 상태 확인
  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then(r => r.json());
  if (info.result.url !== webhookUrl) {
    throw new Error('Webhook not set correctly');
  }
  ```
- **예상 소요시간**: 5초
- **성공 기준**: `getWebhookInfo`에서 URL 일치
- **실패 시**: 재시도 3회

### Step 4-T: 브릿지 Worker 배포
- **담당**: `integration-agent`
- **도구**: `wrangler` CLI
- **입력**: `customer_id`, `token`
- **실행**:
  ```bash
  cp -r /templates/bridge-telegram /tmp/bridge-telegram-${customer_id}
  cd /tmp/bridge-telegram-${customer_id}

  cat > wrangler.toml <<EOF
  name = "bridge-telegram-${customer_id}"
  compatibility_date = "2024-01-01"

  [vars]
  CUSTOMER_ID = "${customer_id}"
  OPENCLAW_URL = "${customer.container_url}"
  EOF

  wrangler deploy
  ```
- **예상 소요시간**: 30초
- **성공 기준**: 배포 성공 메시지
- **실패 시**: 로그 확인 후 재시도

### Step 5-T: 디바이스 페어링 테스트
- **담당**: `integration-agent`
- **도구**: Telegram API
- **입력**: `customer_id`, `token`
- **실행**:
  ```javascript
  // 고객에게 봇 링크 발송
  const botLink = `https://t.me/${botName}`;
  await sendEmail({
    to: customer.admin_email,
    subject: '[OpenClaw] 텔레그램 연동 완료',
    html: `
      <p>텔레그램 봇이 준비되었습니다:</p>
      <a href="${botLink}">${botLink}</a>
      <p>/start 명령어로 대화를 시작하세요.</p>
    `
  });

  // 테스트 메시지 수신 대기
  const testReceived = await waitForTestMessage(customer_id, 300000);
  ```
- **예상 소요시간**: 5분
- **성공 기준**: 테스트 메시지 송수신 성공
- **실패 시**: 웹훅 재설정

---

## 슬랙 연동

### Step 1-S: 앱 생성 + OAuth scope 설정
- **담당**: `integration-agent`
- **도구**: Slack API
- **입력**: `customer_id`, `company_name`
- **실행**:
  ```javascript
  // Slack App Manifest 생성
  const manifest = {
    display_information: {
      name: `${company_name} AI Assistant`,
      description: 'OpenClaw AI 비서',
      background_color: '#2c2d30'
    },
    features: {
      bot_user: {
        display_name: `${company_name} AI`,
        always_online: true
      }
    },
    oauth_config: {
      redirect_urls: [
        `https://bridge-slack-${customer_id}.openclaw.workers.dev/oauth/callback`
      ],
      scopes: {
        bot: [
          'chat:write',
          'chat:write.public',
          'im:history',
          'im:read',
          'im:write',
          'users:read'
        ]
      }
    },
    settings: {
      event_subscriptions: {
        request_url: `https://bridge-slack-${customer_id}.openclaw.workers.dev/events`,
        bot_events: ['message.im', 'app_mention']
      }
    }
  };

  // Slack API로 앱 생성
  const response = await fetch('https://api.slack.com/apps', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SLACK_ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ manifest })
  });

  const { app_id, credentials } = await response.json();
  ```
- **예상 소요시간**: 20초
- **성공 기준**: 앱 ID 및 credentials 수신
- **실패 시**: Manifest 검증 후 재시도

### Step 2-S: 웹훅 구성
- **담당**: `integration-agent`
- **도구**: Cloudflare Worker
- **입력**: `customer_id`, `app_id`
- **실행**:
  ```bash
  cp -r /templates/bridge-slack /tmp/bridge-slack-${customer_id}
  cd /tmp/bridge-slack-${customer_id}

  wrangler secret put SLACK_BOT_TOKEN
  wrangler secret put SLACK_SIGNING_SECRET

  wrangler deploy --name bridge-slack-${customer_id}
  ```
- **예상 소요시간**: 40초
- **성공 기준**: Worker 배포 성공
- **실패 시**: Secret 확인 후 재시도

### Step 3-S: 연동 검증
- **담당**: `integration-agent`
- **도구**: Slack API
- **입력**: `customer_id`, `app_id`
- **실행**:
  ```javascript
  // 고객에게 앱 설치 링크 발송
  const installUrl = `https://slack.com/oauth/v2/authorize?client_id=${credentials.client_id}&scope=chat:write,im:history`;

  await sendEmail({
    to: customer.admin_email,
    subject: '[OpenClaw] 슬랙 앱 설치',
    html: `
      <p>슬랙 워크스페이스에 AI 비서를 추가하세요:</p>
      <a href="${installUrl}">앱 설치하기</a>
    `
  });

  // OAuth 콜백 대기
  const installed = await waitForOAuthCallback(customer_id, 300000);
  ```
- **예상 소요시간**: 5분
- **성공 기준**: OAuth 콜백 수신
- **실패 시**: 리마인더 발송

---

## 디스코드 연동

### Step 1-D: 앱 생성 + OAuth scope 설정
- **담당**: `integration-agent`
- **도구**: Discord API
- **입력**: `customer_id`, `company_name`
- **실행**:
  ```javascript
  const response = await fetch('https://discord.com/api/v10/applications', {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${env.DISCORD_MASTER_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `${company_name} AI Assistant`,
      description: 'OpenClaw AI 비서'
    })
  });

  const { id, token } = await response.json();
  ```
- **예상 소요시간**: 10초
- **성공 기준**: 앱 ID 및 토큰 수신
- **실패 시**: 재시도

### Step 2-D: 웹훅 구성
- **담당**: `integration-agent`
- **도구**: Cloudflare Worker
- **입력**: `customer_id`, Discord app credentials
- **실행**:
  ```bash
  cp -r /templates/bridge-discord /tmp/bridge-discord-${customer_id}
  cd /tmp/bridge-discord-${customer_id}

  wrangler secret put DISCORD_BOT_TOKEN
  wrangler secret put DISCORD_PUBLIC_KEY

  wrangler deploy --name bridge-discord-${customer_id}
  ```
- **예상 소요시간**: 35초
- **성공 기준**: 배포 성공
- **실패 시**: 재시도

### Step 3-D: 연동 검증
- **담당**: `integration-agent`
- **도구**: Discord API
- **입력**: `customer_id`, bot token
- **실행**:
  ```javascript
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${id}&permissions=2147483648&scope=bot`;

  await sendEmail({
    to: customer.admin_email,
    subject: '[OpenClaw] 디스코드 봇 초대',
    html: `
      <p>디스코드 서버에 AI 비서를 추가하세요:</p>
      <a href="${inviteUrl}">봇 초대하기</a>
    `
  });
  ```
- **예상 소요시간**: 5분
- **성공 기준**: 봇이 서버에 추가됨
- **실패 시**: 초대 링크 재생성

---

## Human Gate 조건

### 카카오톡
- **필수 Human Gate**:
  1. 고객이 카카오 채널 생성 (Step 1-K)
  2. 카카오 비즈니스 심사 (Step 2-K, 1-3일 소요)
- **자동 알림**: 심사 승인/거절 시 고객에게 이메일 발송

### 텔레그램
- **Human Gate 없음** (완전 자동화)

### 슬랙
- **선택 Human Gate**:
  - 고객이 워크스페이스 관리자 권한으로 앱 설치 승인

### 디스코드
- **선택 Human Gate**:
  - 고객이 서버 관리자 권한으로 봇 초대 승인

## 모니터링
- Grafana 대시보드:
  - 메신저별 연동 성공률
  - 평균 연동 소요시간
  - 웹훅 응답 지연 시간
  - 메시지 전송 실패율

## 변경 이력
| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1.0 | 2026-02-08 | 초안 작성 |

export interface WelcomeEmailData {
  tenantName: string;
  contactName: string;
  subdomain: string;
  plan: string;
  apiKey: string;
  dashboardUrl: string;
}

export function generateWelcomeEmail(data: WelcomeEmailData): {
  subject: string;
  html: string;
  text: string
} {
  const subject = `[OpenClaw] ${data.tenantName} 서비스 설정이 완료되었습니다`;

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .info-box { background: #f7f9fc; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea; }
    .api-key { font-family: 'Monaco', 'Courier New', monospace; background: #1e1e1e; color: #00ff00; padding: 15px; border-radius: 4px; word-break: break-all; font-size: 13px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 10px 0; font-weight: 600; }
    .steps { background: #fff8e1; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .steps ol { margin: 10px 0; padding-left: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #e0e0e0; margin-top: 20px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🎉 환영합니다!</h1>
      <p style="margin: 10px 0 0 0;">OpenClaw AI 비서 서비스가 준비되었습니다</p>
    </div>

    <div class="content">
      <p>안녕하세요, ${data.contactName}님!</p>

      <p><strong>${data.tenantName}</strong>의 AI 비서 서비스 설정이 완료되었습니다. 이제 카카오톡, 텔레그램, 슬랙, 디스코드를 통해 고객과 소통하실 수 있습니다.</p>

      <div class="info-box">
        <h3 style="margin-top: 0;">📋 계정 정보</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>조직명:</strong> ${data.tenantName}</li>
          <li><strong>플랜:</strong> ${data.plan}</li>
          <li><strong>서브도메인:</strong> ${data.subdomain}.openclaw.ai</li>
        </ul>
      </div>

      <div class="warning">
        <strong>⚠️ 중요: API Key (안전하게 보관하세요)</strong>
        <div class="api-key">${data.apiKey}</div>
        <p style="margin: 10px 0 0 0; font-size: 13px;">이 키는 재발급이 불가능하니 안전한 곳에 보관해주세요. 외부에 노출되지 않도록 주의하세요.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.dashboardUrl}" class="button">대시보드 바로가기 →</a>
      </div>

      <div class="steps">
        <h3 style="margin-top: 0;">🚀 다음 단계</h3>
        <ol>
          <li><strong>SOUL.md 작성:</strong> AI 비서의 성격과 응답 스타일을 정의하세요</li>
          <li><strong>메신저 연동:</strong> 카카오톡, 텔레그램 등 원하는 메신저를 연결하세요</li>
          <li><strong>스킬 활성화:</strong> 예약, 주문조회 등 업종별 스킬을 추가하세요</li>
          <li><strong>테스트:</strong> 대시보드에서 AI 비서와 대화를 테스트해보세요</li>
        </ol>
      </div>

      <div class="info-box">
        <h3 style="margin-top: 0;">📚 유용한 리소스</h3>
        <ul>
          <li><a href="https://docs.openclaw.ai/quickstart">빠른 시작 가이드</a></li>
          <li><a href="https://docs.openclaw.ai/soul">SOUL.md 작성 가이드</a></li>
          <li><a href="https://docs.openclaw.ai/integrations">메신저 연동 가이드</a></li>
          <li><a href="https://docs.openclaw.ai/skills">스킬 개발 문서</a></li>
        </ul>
      </div>

      <p>궁금하신 점이 있으시면 언제든지 문의해주세요.</p>

      <p style="margin-top: 30px;">
        감사합니다,<br>
        <strong>OpenClaw 팀</strong>
      </p>
    </div>

    <div class="footer">
      <p>이 이메일은 OpenClaw 서비스 가입 시 자동으로 발송됩니다.</p>
      <p>© 2026 OpenClaw. All rights reserved.</p>
      <p><a href="https://openclaw.ai/privacy" style="color: #667eea;">개인정보처리방침</a> | <a href="https://openclaw.ai/terms" style="color: #667eea;">이용약관</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
OpenClaw AI 비서 서비스 설정 완료

안녕하세요, ${data.contactName}님!

${data.tenantName}의 AI 비서 서비스 설정이 완료되었습니다.

━━━━━━━━━━━━━━━━━━━━━━
📋 계정 정보
━━━━━━━━━━━━━━━━━━━━━━

조직명: ${data.tenantName}
플랜: ${data.plan}
서브도메인: ${data.subdomain}.openclaw.ai

━━━━━━━━━━━━━━━━━━━━━━
⚠️  API Key (안전하게 보관하세요)
━━━━━━━━━━━━━━━━━━━━━━

${data.apiKey}

이 키는 재발급이 불가능하니 안전한 곳에 보관해주세요.
외부에 노출되지 않도록 주의하세요.

━━━━━━━━━━━━━━━━━━━━━━
🚀 다음 단계
━━━━━━━━━━━━━━━━━━━━━━

1. SOUL.md 작성: AI 비서의 성격과 응답 스타일을 정의하세요
2. 메신저 연동: 카카오톡, 텔레그램 등 원하는 메신저를 연결하세요
3. 스킬 활성화: 예약, 주문조회 등 업종별 스킬을 추가하세요
4. 테스트: 대시보드에서 AI 비서와 대화를 테스트해보세요

━━━━━━━━━━━━━━━━━━━━━━
📚 유용한 리소스
━━━━━━━━━━━━━━━━━━━━━━

• 빠른 시작 가이드: https://docs.openclaw.ai/quickstart
• SOUL.md 작성 가이드: https://docs.openclaw.ai/soul
• 메신저 연동 가이드: https://docs.openclaw.ai/integrations
• 스킬 개발 문서: https://docs.openclaw.ai/skills

대시보드: ${data.dashboardUrl}

궁금하신 점이 있으시면 언제든지 문의해주세요.

감사합니다,
OpenClaw 팀

━━━━━━━━━━━━━━━━━━━━━━
이 이메일은 OpenClaw 서비스 가입 시 자동으로 발송됩니다.
© 2026 OpenClaw. All rights reserved.

개인정보처리방침: https://openclaw.ai/privacy
이용약관: https://openclaw.ai/terms
  `.trim();

  return { subject, html, text };
}

interface ReEngagementEmailParams {
  tenantName: string;
  contactName: string;
  inactiveDays: number;
  dashboardUrl: string;
}

export function generateReEngagementEmail(params: ReEngagementEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[OpenClaw] ${params.contactName}님, ${params.tenantName} AI 비서가 기다리고 있어요`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; font-size: 24px;">OpenClaw</h1>
  </div>

  <h2 style="color: #1e293b;">AI 비서를 다시 활용해 보세요!</h2>

  <p>안녕하세요, <strong>${params.contactName}</strong>님.</p>

  <p>최근 <strong>${params.inactiveDays}일간</strong> <strong>${params.tenantName}</strong>의 AI 비서 이용이 없었습니다.</p>

  <p>AI 비서가 도움을 드릴 수 있는 다양한 기능이 있습니다:</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <ul style="list-style: none; padding: 0; margin: 0;">
      <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">&#x2705; 고객 문의 자동 응대</li>
      <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">&#x2705; 예약 및 일정 관리</li>
      <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">&#x2705; 자주 묻는 질문 자동 처리</li>
      <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">&#x2705; 메신저 연동 (카카오톡, 텔레그램, 슬랙)</li>
      <li style="padding: 8px 0;">&#x2705; 맞춤형 응답 설정 (SOUL.md)</li>
    </ul>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${params.dashboardUrl}" style="background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
      대시보드에서 시작하기
    </a>
  </div>

  <p style="color: #64748b; font-size: 14px;">
    도움이 필요하시면 언제든 문의해 주세요.<br>
    <a href="mailto:support@openclaw.ai" style="color: #2563eb;">support@openclaw.ai</a>
  </p>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
  <p style="color: #94a3b8; font-size: 12px; text-align: center;">
    이 메일은 OpenClaw 서비스 이용 안내 메일입니다.<br>
    수신을 원하지 않으시면 대시보드에서 알림 설정을 변경해 주세요.
  </p>
</body>
</html>`.trim();

  const text = `[OpenClaw] ${params.contactName}님, AI 비서를 다시 활용해 보세요!

최근 ${params.inactiveDays}일간 ${params.tenantName}의 AI 비서 이용이 없었습니다.

AI 비서가 도움을 드릴 수 있는 기능:
- 고객 문의 자동 응대
- 예약 및 일정 관리
- 자주 묻는 질문 자동 처리
- 메신저 연동 (카카오톡, 텔레그램, 슬랙)
- 맞춤형 응답 설정 (SOUL.md)

대시보드: ${params.dashboardUrl}

문의: support@openclaw.ai`;

  return { subject, html, text };
}

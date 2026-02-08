interface UpsellEmailParams {
  tenantName: string;
  contactName: string;
  currentPlan: string;
  nextPlan: string;
  usagePercent: number;
  currentTokens: number;
  currentLimit: number;
  nextPlanPrice: number;
  nextPlanLimit: number;
  dashboardUrl: string;
}

export function generateUpsellEmail(params: UpsellEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[OpenClaw] ${params.tenantName} 플랜 업그레이드 안내`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; font-size: 24px;">OpenClaw</h1>
  </div>

  <h2 style="color: #1e293b;">더 많은 AI 비서 활용을 위한 업그레이드 안내</h2>

  <p>안녕하세요, <strong>${params.contactName}</strong>님.</p>

  <p><strong>${params.tenantName}</strong>의 AI 비서 사용량이 현재 플랜 한도의 <strong style="color: #dc2626;">${params.usagePercent.toFixed(0)}%</strong>에 도달했습니다.</p>

  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; font-weight: bold; color: #991b1b;">현재 사용량</p>
    <div style="background: #e5e7eb; border-radius: 4px; height: 20px; margin: 10px 0; overflow: hidden;">
      <div style="background: ${params.usagePercent >= 90 ? '#dc2626' : '#f59e0b'}; height: 100%; width: ${Math.min(params.usagePercent, 100)}%; border-radius: 4px;"></div>
    </div>
    <p style="margin: 0; font-size: 14px; color: #64748b;">
      ${params.currentTokens.toLocaleString()} / ${params.currentLimit.toLocaleString()} 토큰 (${params.currentPlan})
    </p>
  </div>

  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p style="margin: 0 0 10px; font-weight: bold; color: #166534;">${params.nextPlan} 플랜으로 업그레이드하면</p>
    <ul style="margin: 0; padding-left: 20px; color: #15803d;">
      <li>토큰 한도 ${params.nextPlanLimit.toLocaleString()}으로 확대</li>
      <li>더 높은 품질의 AI 모델 사용 가능</li>
      <li>우선 지원 서비스</li>
    </ul>
    <p style="margin: 10px 0 0; font-size: 18px; font-weight: bold; color: #166534;">
      월 ${params.nextPlanPrice.toLocaleString()}원
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${params.dashboardUrl}/billing/upgrade" style="background: #16a34a; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
      플랜 업그레이드
    </a>
  </div>

  <p style="color: #64748b; font-size: 14px;">
    플랜 비교 및 자세한 내용은 대시보드에서 확인하실 수 있습니다.<br>
    문의: <a href="mailto:support@openclaw.ai" style="color: #2563eb;">support@openclaw.ai</a>
  </p>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
  <p style="color: #94a3b8; font-size: 12px; text-align: center;">
    이 메일은 OpenClaw 서비스 이용 안내 메일입니다.<br>
    수신을 원하지 않으시면 대시보드에서 알림 설정을 변경해 주세요.
  </p>
</body>
</html>`.trim();

  const text = `[OpenClaw] ${params.tenantName} 플랜 업그레이드 안내

${params.contactName}님, ${params.tenantName}의 AI 비서 사용량이 현재 플랜의 ${params.usagePercent.toFixed(0)}%에 도달했습니다.

현재: ${params.currentTokens.toLocaleString()} / ${params.currentLimit.toLocaleString()} 토큰 (${params.currentPlan})

${params.nextPlan} 플랜 (월 ${params.nextPlanPrice.toLocaleString()}원):
- 토큰 한도 ${params.nextPlanLimit.toLocaleString()}으로 확대
- 더 높은 품질의 AI 모델 사용 가능
- 우선 지원 서비스

업그레이드: ${params.dashboardUrl}/billing/upgrade
문의: support@openclaw.ai`;

  return { subject, html, text };
}

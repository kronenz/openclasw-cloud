import type { Bindings } from '../types/index.js';
import { generateWelcomeEmail } from '../templates/email/welcome.js';
import { structuredLog, structuredError } from '../utils/log.js';
import { fetchWithTimeout } from '../utils/fetch.js';
import { RESEND_API_URL } from '../config/constants.js';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class EmailSender {
  constructor(private env: Bindings) {}

  private async send(message: EmailMessage): Promise<boolean> {
    // Use Resend API if configured, otherwise log
    const resendApiKey = this.env.RESEND_API_KEY;

    if (!resendApiKey) {
      structuredLog('email_send_skipped', {
        reason: 'RESEND_API_KEY not configured',
        to: message.to,
        subject: message.subject,
      });
      return true; // Don't fail provisioning over missing email config
    }

    try {
      const res = await fetchWithTimeout(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'OpenClaw <noreply@openclaw.ai>',
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        structuredError('email_send_failed', new Error(err));
        return false;
      }

      structuredLog('email_sent', {
        to: message.to,
        subject: message.subject,
      });
      return true;
    } catch (error) {
      structuredError('email_send_error', error);
      return false;
    }
  }

  async sendWelcomeEmail(params: {
    tenantName: string;
    contactName: string;
    contactEmail: string;
    subdomain: string;
    plan: string;
    apiKey: string;
  }): Promise<boolean> {
    const { subject, html, text } = generateWelcomeEmail({
      tenantName: params.tenantName,
      contactName: params.contactName,
      subdomain: params.subdomain,
      plan: params.plan,
      apiKey: params.apiKey,
      dashboardUrl: `https://${params.subdomain}.openclaw.ai/dashboard`,
    });

    return this.send({
      to: params.contactEmail,
      subject,
      html,
      text,
    });
  }

  async sendPaymentFailedEmail(params: {
    contactEmail: string;
    contactName: string;
    tenantName: string;
  }): Promise<boolean> {
    const subject = `[OpenClaw] ${params.tenantName} 결제 실패 안내`;
    const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>결제 처리에 실패했습니다</h2>
  <p>안녕하세요, ${params.contactName}님.</p>
  <p><strong>${params.tenantName}</strong>의 정기 결제가 실패했습니다.</p>
  <p>결제 수단을 확인하고 업데이트해 주세요. 7일 이내에 결제가 완료되지 않으면 서비스가 일시 중지될 수 있습니다.</p>
  <p>문의: support@openclaw.ai</p>
</div>`.trim();

    return this.send({
      to: params.contactEmail,
      subject,
      html,
      text: `결제 실패 안내 - ${params.tenantName}\n결제 수단을 확인해 주세요.`,
    });
  }

  async sendReEngagementEmail(params: {
    contactEmail: string;
    contactName: string;
    tenantName: string;
    inactiveDays: number;
  }): Promise<boolean> {
    const subject = `[OpenClaw] ${params.contactName}님, ${params.tenantName} AI 비서가 기다리고 있어요`;
    const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>AI 비서를 다시 활용해 보세요!</h2>
  <p>안녕하세요, ${params.contactName}님.</p>
  <p>최근 ${params.inactiveDays}일간 <strong>${params.tenantName}</strong>의 AI 비서 이용이 없었습니다.</p>
  <p>AI 비서가 도움을 드릴 수 있는 다양한 기능이 있습니다:</p>
  <ul>
    <li>고객 문의 자동 응대</li>
    <li>예약 및 일정 관리</li>
    <li>자주 묻는 질문 처리</li>
  </ul>
  <p>대시보드에서 바로 시작해 보세요!</p>
</div>`.trim();

    return this.send({
      to: params.contactEmail,
      subject,
      html,
      text: `${params.contactName}님, ${params.inactiveDays}일간 미사용 - AI 비서를 다시 활용해 보세요!`,
    });
  }
}

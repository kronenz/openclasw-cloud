import type { Bindings } from '../types/index.js';
import { fetchWithTimeout } from '../utils/fetch.js';
import { structuredError } from '../utils/log.js';
import { nowISO } from '../utils/id.js';

export class SlackNotifier {
  constructor(private env: Bindings) {}

  private async send(payload: Record<string, unknown>): Promise<boolean> {
    if (!this.env.SLACK_WEBHOOK_URL) {
      return false;
    }

    try {
      const res = await fetchWithTimeout(this.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (error) {
      structuredError('slack_notification_failed', error);
      return false;
    }
  }

  async sendAlert(params: {
    severity: string;
    title: string;
    message: string;
    tenantId?: string;
  }): Promise<boolean> {
    const emoji = params.severity === 'P0' || params.severity === 'P1' ? '🚨' : '⚠️';
    return this.send({
      text: `${emoji} [${params.severity}] ${params.title}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *[${params.severity}]* ${params.title}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: params.message,
          },
        },
        ...(params.tenantId ? [{
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `Tenant: \`${params.tenantId}\` | ${nowISO()}`,
          }],
        }] : []),
      ],
    });
  }

  async sendIncidentAlert(params: {
    tenantId: string;
    status: string;
    details: Record<string, unknown>;
  }): Promise<boolean> {
    return this.sendAlert({
      severity: 'P2',
      title: `Tenant ${params.tenantId} health: ${params.status}`,
      message: `Health check details:\n\`\`\`${JSON.stringify(params.details, null, 2)}\`\`\``,
      tenantId: params.tenantId,
    });
  }

  async sendEscalation(params: {
    tenantId: string;
    reason: string;
    attempts: number;
  }): Promise<boolean> {
    return this.sendAlert({
      severity: 'P1',
      title: `Tenant ${params.tenantId} 자동 복구 실패 (${params.attempts}회 시도)`,
      message: `*에스컬레이션 사유:* ${params.reason}\n*조치 필요:* Operator 수동 확인 필요`,
      tenantId: params.tenantId,
    });
  }
}

import type { Bindings } from '../types/index.js';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; first_name: string; username?: string };
    text?: string;
    date: number;
  };
}

interface TelegramSendResult {
  ok: boolean;
  result?: unknown;
  description?: string;
}

export class TelegramBot {
  constructor(private env: Bindings) {}

  // Get bot token for a tenant from KV
  private async getBotToken(tenantId: string): Promise<string | null> {
    return this.env.CACHE.get(`telegram:bot:${tenantId}`);
  }

  // Store bot token for a tenant
  async setBotToken(tenantId: string, token: string): Promise<void> {
    await this.env.CACHE.put(`telegram:bot:${tenantId}`, token);
  }

  // Send a message via Telegram Bot API
  private async sendMessage(botToken: string, chatId: number, text: string): Promise<boolean> {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    const result = await res.json() as TelegramSendResult;
    if (!result.ok) {
      console.error('Telegram sendMessage failed:', result.description);
    }
    return result.ok;
  }

  // Process incoming Telegram update
  async handleUpdate(tenantId: string, update: TelegramUpdate): Promise<void> {
    if (!update.message?.text) return;

    const botToken = await this.getBotToken(tenantId);
    if (!botToken) {
      console.error(`No bot token for tenant ${tenantId}`);
      return;
    }

    const chatId = update.message.chat.id;
    const userMessage = update.message.text;

    try {
      // Get SOUL.md for this tenant's persona
      const soulContent = await this.env.STORAGE.get(`tenants/${tenantId}/SOUL.md`);
      const systemPrompt = soulContent
        ? await soulContent.text()
        : '당신은 친절한 AI 비서입니다. 한국어로 응답하세요.';

      // Call AI Gateway
      const aiResult = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1000,
      });

      const responseText = (aiResult as any).response || '죄송합니다. 잠시 후 다시 시도해 주세요.';
      await this.sendMessage(botToken, chatId, responseText);
    } catch (error) {
      console.error('Telegram AI processing failed:', error);
      await this.sendMessage(botToken, chatId, '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  // Register webhook URL with Telegram
  async registerWebhook(botToken: string, webhookUrl: string): Promise<boolean> {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const result = await res.json() as TelegramSendResult;
    return result.ok;
  }
}

import type { Bindings, AiTextResponse, AiModelId } from '../types/index.js';
import { fetchWithTimeout } from '../utils/fetch.js';
import { DEFAULT_AI_MODEL, AI_MAX_TOKENS_DEFAULT, TELEGRAM_API_BASE, API_TIMEOUT_STANDARD, DEFAULT_AI_SYSTEM_PROMPT, soulR2Key } from '../config/constants.js';
import { structuredError } from '../utils/log.js';

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
    const res = await fetchWithTimeout(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    }, API_TIMEOUT_STANDARD);

    const result = await res.json() as TelegramSendResult;
    if (!result.ok) {
      structuredError('telegram_send_failed', new Error(result.description || 'Unknown error'));
    }
    return result.ok;
  }

  // Process incoming Telegram update
  async handleUpdate(tenantId: string, update: TelegramUpdate): Promise<void> {
    if (!update.message?.text) return;

    const botToken = await this.getBotToken(tenantId);
    if (!botToken) {
      structuredError('telegram_no_bot_token', new Error('Missing bot token'), { tenantId });
      return;
    }

    const chatId = update.message.chat.id;
    const userMessage = update.message.text;

    try {
      // Get SOUL.md for this tenant's persona
      const soulContent = await this.env.STORAGE.get(soulR2Key(tenantId));
      const systemPrompt = soulContent
        ? await soulContent.text()
        : DEFAULT_AI_SYSTEM_PROMPT;

      // Call AI Gateway
      const aiResult = await this.env.AI.run(DEFAULT_AI_MODEL as AiModelId, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: AI_MAX_TOKENS_DEFAULT,
      });

      const responseText = (aiResult as AiTextResponse).response || '죄송합니다. 잠시 후 다시 시도해 주세요.';
      await this.sendMessage(botToken, chatId, responseText);
    } catch (error) {
      structuredError('telegram_ai_failed', error);
      await this.sendMessage(botToken, chatId, '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  // Register webhook URL with Telegram
  async registerWebhook(botToken: string, webhookUrl: string): Promise<boolean> {
    const res = await fetchWithTimeout(`${TELEGRAM_API_BASE}${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    }, API_TIMEOUT_STANDARD);

    const result = await res.json() as TelegramSendResult;
    return result.ok;
  }
}

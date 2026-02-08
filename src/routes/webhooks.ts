import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings, ApiResponse, AiTextResponse } from '../types/index.js';
import { DEFAULT_AI_MODEL } from '../types/index.js';
import { TelegramBot } from '../services/telegram-bot.js';
import { getTenant } from '../db/queries.js';
import { MAX_MESSAGE_LENGTH, AI_MAX_TOKENS_DEFAULT } from '../config/constants.js';
import { structuredLog } from '../utils/log.js';
import { fetchWithTimeout } from '../utils/fetch.js';

const webhooks = new Hono<{ Bindings: Bindings }>();

// Telegram webhook types
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

// KakaoTalk skill webhook types
interface KakaoTalkRequest {
  userRequest: {
    utterance: string;
    user: {
      id: string;
      properties?: Record<string, unknown>;
    };
  };
  bot?: { id: string };
  action?: { name: string };
}

// Slack Events API types
interface SlackEvent {
  type?: string;
  challenge?: string;
  event?: {
    type: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
  };
}

// Discord Interaction types
interface DiscordInteraction {
  type: number; // 1 = PING, 2 = APPLICATION_COMMAND, 3 = MESSAGE_COMPONENT
  id?: string;
  application_id?: string;
  data?: {
    name?: string;
    content?: string;
  };
  channel_id?: string;
  member?: {
    user?: { id: string; username?: string };
  };
}

// POST /messenger - receive webhook from messenger platforms
webhooks.post('/messenger', async (c) => {
  try {
    // Parse platform type from header or body
    const platformHeader = c.req.header('X-Platform-Type');
    const body = await c.req.json();
    const platform = platformHeader || body.platform || 'unknown';

    // Log webhook receipt
    structuredLog('messenger_webhook_received', {
      platform,
      body,
    });

    // Route to appropriate handler based on platform
    switch (platform) {
      case 'kakao':
      case 'kakaotalk':
        return await handleKakaoTalk(c, body as KakaoTalkRequest);

      case 'telegram':
        return await handleTelegram(c, body as TelegramUpdate);

      case 'slack':
        return await handleSlack(c, body as SlackEvent);

      case 'discord':
        return await handleDiscord(c, body as DiscordInteraction);

      default:
        console.warn('Unknown messenger platform:', platform);
        return c.json<ApiResponse>({
          success: true,
          data: { received: true },
        });
    }
  } catch (e) {
    console.error('Failed to process messenger webhook:', e);

    // Still return 200 to avoid webhook retries
    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  }
});

// KakaoTalk webhook handler
async function handleKakaoTalk(c: Context<{ Bindings: Bindings }>, body: KakaoTalkRequest) {
  try {
    // Validate request structure
    if (!body.userRequest?.utterance) {
      return c.json({
        version: '2.0',
        template: {
          outputs: [{
            simpleText: {
              text: '메시지를 인식할 수 없습니다.',
            },
          }],
        },
      });
    }

    const userMessage = body.userRequest.utterance.slice(0, MAX_MESSAGE_LENGTH);

    // Extract tenant ID from bot ID or use default
    const tenantId = body.bot?.id || 'default';

    // Validate tenant
    const tenant = await getTenant(c.env.DB, tenantId);
    if (!tenant || tenant.status !== 'active') {
      return c.json({
        version: '2.0',
        template: {
          outputs: [{
            simpleText: {
              text: '서비스를 사용할 수 없습니다. 관리자에게 문의하세요.',
            },
          }],
        },
      });
    }

    // Get SOUL.md for this tenant
    const soulContent = await c.env.STORAGE.get(`tenants/${tenantId}/SOUL.md`);
    const systemPrompt = soulContent
      ? await soulContent.text()
      : '당신은 친절한 AI 비서입니다. 한국어로 응답하세요.';

    // Call AI Gateway with error handling
    let responseText: string;
    try {
      const aiResult = await c.env.AI.run(DEFAULT_AI_MODEL as Parameters<Ai['run']>[0], {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: AI_MAX_TOKENS_DEFAULT,
      });
      responseText = (aiResult as AiTextResponse).response || '죄송합니다. 응답을 생성할 수 없습니다.';
    } catch (error) {
      console.error('AI inference failed:', error);
      responseText = '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }

    // Return KakaoTalk skill response format
    return c.json({
      version: '2.0',
      template: {
        outputs: [{
          simpleText: {
            text: responseText,
          },
        }],
      },
    });
  } catch (error) {
    console.error('KakaoTalk handler error:', error);
    return c.json({
      version: '2.0',
      template: {
        outputs: [{
          simpleText: {
            text: '죄송합니다. 일시적인 오류가 발생했습니다.',
          },
        }],
      },
    });
  }
}

// Telegram webhook handler
async function handleTelegram(c: Context<{ Bindings: Bindings }>, body: TelegramUpdate) {
  try {
    // Validate Telegram update structure
    if (!body.message?.text || !body.message?.chat?.id) {
      return c.json<ApiResponse>({
        success: true,
        data: { received: true },
      });
    }

    // Extract tenant ID from URL path or header
    const tenantId = c.req.header('X-Tenant-ID') || 'default';

    // Validate tenant
    const tenant = await getTenant(c.env.DB, tenantId);
    if (!tenant || tenant.status !== 'active') {
      return c.json<ApiResponse>({
        success: false,
        error: 'Tenant not found or inactive',
        code: 'TENANT_INACTIVE',
      }, 403);
    }

    // Use TelegramBot service for processing
    const telegramBot = new TelegramBot(c.env);

    // Process update asynchronously (don't await to respond quickly)
    c.executionCtx.waitUntil(telegramBot.handleUpdate(tenantId, body));

    // Return 200 OK immediately
    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  } catch (error) {
    console.error('Telegram handler error:', error);
    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  }
}

// Slack webhook handler
async function handleSlack(c: Context<{ Bindings: Bindings }>, body: SlackEvent) {
  try {
    // Handle URL verification challenge
    if (body.type === 'url_verification' && body.challenge) {
      return c.json({ challenge: body.challenge });
    }

    // Handle message events
    if (body.event?.type === 'message' && body.event.text) {
      const userMessage = body.event.text.slice(0, MAX_MESSAGE_LENGTH);
      const channelId = body.event.channel;

      // Extract tenant ID from request
      const tenantId = c.req.header('X-Tenant-ID') || 'default';

      // Validate tenant
      const tenant = await getTenant(c.env.DB, tenantId);
      if (!tenant || tenant.status !== 'active') {
        return c.json<ApiResponse>({
          success: false,
          error: 'Tenant not found or inactive',
          code: 'TENANT_INACTIVE',
        }, 403);
      }

      // Get SOUL.md for this tenant
      const soulContent = await c.env.STORAGE.get(`tenants/${tenantId}/SOUL.md`);
      const systemPrompt = soulContent
        ? await soulContent.text()
        : '당신은 친절한 AI 비서입니다. 한국어로 응답하세요.';

      // Call AI Gateway with error handling
      let responseText: string;
      try {
        const aiResult = await c.env.AI.run(DEFAULT_AI_MODEL as Parameters<Ai['run']>[0], {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: AI_MAX_TOKENS_DEFAULT,
        });
        responseText = (aiResult as AiTextResponse).response || '죄송합니다. 응답을 생성할 수 없습니다.';
      } catch (error) {
        console.error('AI inference failed:', error);
        responseText = '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }

      // Send response via Slack Web API (requires bot token in KV)
      const slackBotToken = await c.env.CACHE.get(`slack:bot:${tenantId}`);
      if (slackBotToken) {
        c.executionCtx.waitUntil(
          fetchWithTimeout('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${slackBotToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: channelId,
              text: responseText,
            }),
          }).catch((error) => {
            console.error('Failed to send Slack message:', error);
          })
        );
      }
    }

    // Return 200 OK
    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  } catch (error) {
    console.error('Slack handler error:', error);
    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  }
}

// Discord webhook handler
async function handleDiscord(c: Context<{ Bindings: Bindings }>, body: DiscordInteraction) {
  try {
    // Handle PING verification (type 1)
    if (body.type === 1) {
      return c.json({ type: 1 }); // PONG
    }

    // Handle application commands or message components
    if (body.type === 2 || body.type === 3) {
      const userMessage = (body.data?.content || body.data?.name || '').slice(0, MAX_MESSAGE_LENGTH);

      // Extract tenant ID from request
      const tenantId = c.req.header('X-Tenant-ID') || 'default';

      // Validate tenant
      const tenant = await getTenant(c.env.DB, tenantId);
      if (!tenant || tenant.status !== 'active') {
        return c.json({
          type: 4,
          data: {
            content: '서비스를 사용할 수 없습니다. 관리자에게 문의하세요.',
          },
        });
      }

      // Get SOUL.md for this tenant
      const soulContent = await c.env.STORAGE.get(`tenants/${tenantId}/SOUL.md`);
      const systemPrompt = soulContent
        ? await soulContent.text()
        : '당신은 친절한 AI 비서입니다. 한국어로 응답하세요.';

      // Call AI Gateway with error handling
      let responseText: string;
      try {
        const aiResult = await c.env.AI.run(DEFAULT_AI_MODEL as Parameters<Ai['run']>[0], {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: AI_MAX_TOKENS_DEFAULT,
        });
        responseText = (aiResult as AiTextResponse).response || '죄송합니다. 응답을 생성할 수 없습니다.';
      } catch (error) {
        console.error('AI inference failed:', error);
        responseText = '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }

      // Return Discord interaction response
      return c.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: responseText,
        },
      });
    }

    // Unknown interaction type
    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  } catch (error) {
    console.error('Discord handler error:', error);
    return c.json({
      type: 4,
      data: {
        content: '죄송합니다. 일시적인 오류가 발생했습니다.',
      },
    });
  }
}

export { webhooks };

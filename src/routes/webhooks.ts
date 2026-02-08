import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings, Variables, ApiResponse, AiTextResponse } from '../types/index.js';
import { TelegramBot } from '../services/telegram-bot.js';
import { getTenant } from '../db/queries.js';
import { DEFAULT_AI_MODEL, MAX_MESSAGE_LENGTH, AI_MAX_TOKENS_DEFAULT, SLACK_API_BASE, ERROR_CODES, DEFAULT_AI_SYSTEM_PROMPT, soulR2Key } from '../config/constants.js';
import { structuredLog, structuredWarn, structuredError } from '../utils/log.js';
import { fetchWithTimeout } from '../utils/fetch.js';
import { withErrorHandler } from '../utils/error-handler.js';

const webhooks = new Hono<{ Bindings: Bindings }>();

// Helper function to run AI inference with error handling
async function runAiInference(
  ai: Ai,
  userMessage: string,
  soulContent: string | null,
): Promise<string> {
  const systemPrompt = soulContent || DEFAULT_AI_SYSTEM_PROMPT;
  try {
    const aiResult = await ai.run(DEFAULT_AI_MODEL, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: AI_MAX_TOKENS_DEFAULT,
    });
    return (aiResult as AiTextResponse).response || '죄송합니다. 응답을 생성할 수 없습니다.';
  } catch (error) {
    structuredError('ai_inference_failed', error);
    return '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
}

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

// Platform-specific response types
interface KakaoTalkResponse {
  version: '2.0';
  template: {
    outputs: Array<{ simpleText: { text: string } }>;
  };
}

interface DiscordInteractionResponse {
  type: number;
  data?: { content: string };
}

// POST /messenger - receive webhook from messenger platforms
webhooks.post('/messenger', withErrorHandler('messenger_webhook_failed', async (c) => {
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
      structuredWarn('unknown_messenger_platform', { platform });
      return c.json<ApiResponse>({
        success: true,
        data: { received: true },
      });
  }
}));

// KakaoTalk webhook handler
async function handleKakaoTalk(c: Context<{ Bindings: Bindings; Variables: Variables }>, body: KakaoTalkRequest) {
  try {
    // Validate request structure
    if (!body.userRequest?.utterance) {
      return c.json<KakaoTalkResponse>({
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

    // Extract tenant ID from bot ID
    const tenantId = body.bot?.id;
    if (!tenantId) {
      structuredWarn('kakaotalk_missing_tenant_id', { body });
      return c.json<KakaoTalkResponse>({
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: '서비스 설정이 필요합니다. 관리자에게 문의하세요.' } }],
        },
      });
    }

    // Validate tenant
    const tenant = await getTenant(c.env.DB, tenantId);
    if (!tenant || tenant.status !== 'active') {
      return c.json<KakaoTalkResponse>({
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
    const soulContent = await c.env.STORAGE.get(soulR2Key(tenantId));
    const soulText = soulContent ? await soulContent.text() : null;

    // Call AI Gateway with error handling
    const responseText = await runAiInference(c.env.AI, userMessage, soulText);

    // Return KakaoTalk skill response format
    return c.json<KakaoTalkResponse>({
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
    structuredError('kakaotalk_handler_error', error);
    return c.json<KakaoTalkResponse>({
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
async function handleTelegram(c: Context<{ Bindings: Bindings; Variables: Variables }>, body: TelegramUpdate) {
  try {
    // Validate Telegram update structure
    if (!body.message?.text || !body.message?.chat?.id) {
      return c.json<ApiResponse>({
        success: true,
        data: { received: true },
      });
    }

    // Extract tenant ID from URL path or header
    const tenantId = c.req.header('X-Tenant-ID');
    if (!tenantId) {
      structuredWarn('telegram_missing_tenant_id', {});
      return c.json<ApiResponse>({
        success: false,
        error: 'Missing X-Tenant-ID header',
        code: ERROR_CODES.MISSING_TENANT_ID,
      }, 400);
    }

    // Validate tenant
    const tenant = await getTenant(c.env.DB, tenantId);
    if (!tenant || tenant.status !== 'active') {
      return c.json<ApiResponse>({
        success: false,
        error: 'Tenant not found or inactive',
        code: ERROR_CODES.TENANT_INACTIVE,
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
    structuredError('telegram_handler_error', error);
    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  }
}

// Slack webhook handler
async function handleSlack(c: Context<{ Bindings: Bindings; Variables: Variables }>, body: SlackEvent) {
  try {
    // Handle URL verification challenge
    if (body.type === 'url_verification' && body.challenge) {
      return c.json<{ challenge: string }>({ challenge: body.challenge });
    }

    // Handle message events
    if (body.event?.type === 'message' && body.event.text) {
      const userMessage = body.event.text.slice(0, MAX_MESSAGE_LENGTH);
      const channelId = body.event.channel;

      // Extract tenant ID from request
      const tenantId = c.req.header('X-Tenant-ID');
      if (!tenantId) {
        structuredWarn('slack_missing_tenant_id', {});
        return c.json<ApiResponse>({
          success: false,
          error: 'Missing X-Tenant-ID header',
          code: ERROR_CODES.MISSING_TENANT_ID,
        }, 400);
      }

      // Validate tenant
      const tenant = await getTenant(c.env.DB, tenantId);
      if (!tenant || tenant.status !== 'active') {
        return c.json<ApiResponse>({
          success: false,
          error: 'Tenant not found or inactive',
          code: ERROR_CODES.TENANT_INACTIVE,
        }, 403);
      }

      // Get SOUL.md for this tenant
      const soulContent = await c.env.STORAGE.get(soulR2Key(tenantId));
      const soulText = soulContent ? await soulContent.text() : null;

      // Call AI Gateway with error handling
      const responseText = await runAiInference(c.env.AI, userMessage, soulText);

      // Send response via Slack Web API (requires bot token in KV)
      const slackBotToken = await c.env.CACHE.get(`slack:bot:${tenantId}`);
      if (slackBotToken) {
        c.executionCtx.waitUntil(
          fetchWithTimeout(`${SLACK_API_BASE}/chat.postMessage`, {
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
            structuredError('slack_message_send_failed', error);
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
    structuredError('slack_handler_error', error);
    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  }
}

// Discord webhook handler
async function handleDiscord(c: Context<{ Bindings: Bindings; Variables: Variables }>, body: DiscordInteraction) {
  try {
    // Handle PING verification (type 1)
    if (body.type === 1) {
      return c.json<DiscordInteractionResponse>({ type: 1 }); // PONG
    }

    // Handle application commands or message components
    if (body.type === 2 || body.type === 3) {
      const userMessage = (body.data?.content || body.data?.name || '').slice(0, MAX_MESSAGE_LENGTH);

      // Extract tenant ID from request
      const tenantId = c.req.header('X-Tenant-ID');
      if (!tenantId) {
        structuredWarn('discord_missing_tenant_id', {});
        return c.json<ApiResponse>({
          success: false,
          error: 'Missing X-Tenant-ID header',
          code: ERROR_CODES.MISSING_TENANT_ID,
        }, 400);
      }

      // Validate tenant
      const tenant = await getTenant(c.env.DB, tenantId);
      if (!tenant || tenant.status !== 'active') {
        return c.json<DiscordInteractionResponse>({
          type: 4,
          data: {
            content: '서비스를 사용할 수 없습니다. 관리자에게 문의하세요.',
          },
        });
      }

      // Get SOUL.md for this tenant
      const soulContent = await c.env.STORAGE.get(soulR2Key(tenantId));
      const soulText = soulContent ? await soulContent.text() : null;

      // Call AI Gateway with error handling
      const responseText = await runAiInference(c.env.AI, userMessage, soulText);

      // Return Discord interaction response
      return c.json<DiscordInteractionResponse>({
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
    structuredError('discord_handler_error', error);
    return c.json<DiscordInteractionResponse>({
      type: 4,
      data: {
        content: '죄송합니다. 일시적인 오류가 발생했습니다.',
      },
    });
  }
}

export { webhooks };

import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, ApiResponse } from '../types/index.js';
import { getTenant } from '../db/queries.js';
import { TelegramBot } from '../services/telegram-bot.js';
import { ERROR_CODES } from '../config/constants.js';
import { withErrorHandler, validationError } from '../utils/error-handler.js';
import { tenantScope } from '../middleware/tenant-scope.js';

const integrations = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const telegramIntegrationSchema = z.object({
  bot_token: z.string()
    .min(1, 'Bot token is required')
    .regex(/^\d+:[A-Za-z0-9_-]+$/, 'Invalid Telegram bot token format'),
});

const slackIntegrationSchema = z.object({
  bot_token: z.string()
    .min(1, 'Bot token is required')
    .regex(/^xoxb-/, 'Invalid Slack bot token format (must start with xoxb-)'),
  signing_secret: z.string().optional(),
});

const discordIntegrationSchema = z.object({
  bot_token: z.string().min(1, 'Bot token is required'),
  application_id: z.string().min(1, 'Application ID is required'),
});

const kakaotalkIntegrationSchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  bot_id: z.string().optional(),
});

const whatsappIntegrationSchema = z.object({
  phone_number_id: z.string().min(1, 'Phone number ID is required'),
  access_token: z.string().min(1, 'Access token is required'),
});

// PUT /:id/integrations/telegram - save Telegram bot token and set webhook
integrations.put('/:id/integrations/telegram', tenantScope, withErrorHandler('telegram_integration_failed', async (c) => {
  const tenantId = c.req.param('id');

  // Verify tenant exists
  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  // Parse and validate request body
  const body = await c.req.json();
  const parsed = telegramIntegrationSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Validation failed', parsed.error.errors);
  }

  const { bot_token } = parsed.data;

  // Initialize TelegramBot service
  const telegramBot = new TelegramBot(c.env);

  // Construct webhook URL
  const webhookUrl = `https://${c.req.header('host') || 'openclasw-cloud.dron199939-4a0.workers.dev'}/webhook/telegram/${tenantId}`;

  // Set webhook with Telegram API
  const webhookSet = await telegramBot.setWebhook(bot_token, webhookUrl);

  if (!webhookSet) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to set webhook with Telegram',
      code: ERROR_CODES.INTERNAL_ERROR,
    }, 500);
  }

  // Store bot token in KV
  await telegramBot.setBotToken(tenantId, bot_token);

  return c.json<ApiResponse>({
    success: true,
    data: {
      webhook_set: true,
      webhook_url: webhookUrl,
    },
  });
}));

// DELETE /:id/integrations/telegram - delete Telegram bot token and remove webhook
integrations.delete('/:id/integrations/telegram', tenantScope, withErrorHandler('telegram_integration_delete_failed', async (c) => {
  const tenantId = c.req.param('id');

  // Verify tenant exists
  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  // Initialize TelegramBot service
  const telegramBot = new TelegramBot(c.env);

  // Get existing bot token
  const botToken = await c.env.CACHE.get(`telegram:bot:${tenantId}`);
  if (!botToken) {
    return c.json<ApiResponse>({
      success: false,
      error: 'No Telegram integration found for this tenant',
      code: ERROR_CODES.NOT_FOUND,
    }, 404);
  }

  // Delete webhook from Telegram
  const webhookDeleted = await telegramBot.deleteWebhook(botToken);

  // Delete bot token from KV (even if webhook deletion fails)
  await telegramBot.deleteBotToken(tenantId);

  return c.json<ApiResponse>({
    success: true,
    data: {
      webhook_deleted: webhookDeleted,
    },
  });
}));

// GET /:id/integrations - list all integrations for a tenant
integrations.get('/:id/integrations', tenantScope, withErrorHandler('integrations_list_failed', async (c) => {
  const tenantId = c.req.param('id');

  // Verify tenant exists
  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  // Check for each integration type in KV
  const integrationsList: Array<{ platform: string; status: string }> = [];

  // Check Telegram
  const telegramToken = await c.env.CACHE.get(`telegram:bot:${tenantId}`);
  if (telegramToken) {
    integrationsList.push({
      platform: 'telegram',
      status: 'active',
    });
  }

  // Check Slack
  const slackToken = await c.env.CACHE.get(`slack:bot:${tenantId}`);
  if (slackToken) {
    integrationsList.push({
      platform: 'slack',
      status: 'active',
    });
  }

  // Check Discord
  const discordToken = await c.env.CACHE.get(`discord:bot:${tenantId}`);
  if (discordToken) {
    integrationsList.push({
      platform: 'discord',
      status: 'active',
    });
  }

  // Check KakaoTalk
  const kakaotalkToken = await c.env.CACHE.get(`kakaotalk:api:${tenantId}`);
  if (kakaotalkToken) {
    integrationsList.push({
      platform: 'kakaotalk',
      status: 'active',
    });
  }

  // Check WhatsApp
  const whatsappToken = await c.env.CACHE.get(`whatsapp:token:${tenantId}`);
  if (whatsappToken) {
    integrationsList.push({
      platform: 'whatsapp',
      status: 'active',
    });
  }

  return c.json<ApiResponse>({
    success: true,
    data: {
      integrations: integrationsList,
    },
  });
}));

// PUT /:id/integrations/slack - save Slack bot token
integrations.put('/:id/integrations/slack', tenantScope, withErrorHandler('slack_integration_failed', async (c) => {
  const tenantId = c.req.param('id');

  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  const body = await c.req.json();
  const parsed = slackIntegrationSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Validation failed', parsed.error.errors);
  }

  const { bot_token, signing_secret } = parsed.data;

  // Store bot token in KV
  await c.env.CACHE.put(`slack:bot:${tenantId}`, bot_token);

  // Store signing secret if provided
  if (signing_secret) {
    await c.env.CACHE.put(`slack:signing:${tenantId}`, signing_secret);
  }

  return c.json<ApiResponse>({
    success: true,
    data: { connected: true },
  });
}));

// DELETE /:id/integrations/slack - delete Slack bot token
integrations.delete('/:id/integrations/slack', tenantScope, withErrorHandler('slack_integration_delete_failed', async (c) => {
  const tenantId = c.req.param('id');

  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  const botToken = await c.env.CACHE.get(`slack:bot:${tenantId}`);
  if (!botToken) {
    return c.json<ApiResponse>({
      success: false,
      error: 'No Slack integration found for this tenant',
      code: ERROR_CODES.NOT_FOUND,
    }, 404);
  }

  await c.env.CACHE.delete(`slack:bot:${tenantId}`);
  await c.env.CACHE.delete(`slack:signing:${tenantId}`);

  return c.json<ApiResponse>({
    success: true,
    data: { disconnected: true },
  });
}));

// PUT /:id/integrations/discord - save Discord bot token
integrations.put('/:id/integrations/discord', tenantScope, withErrorHandler('discord_integration_failed', async (c) => {
  const tenantId = c.req.param('id');

  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  const body = await c.req.json();
  const parsed = discordIntegrationSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Validation failed', parsed.error.errors);
  }

  const { bot_token, application_id } = parsed.data;

  await c.env.CACHE.put(`discord:bot:${tenantId}`, bot_token);
  await c.env.CACHE.put(`discord:app:${tenantId}`, application_id);

  return c.json<ApiResponse>({
    success: true,
    data: { connected: true },
  });
}));

// DELETE /:id/integrations/discord - delete Discord bot token
integrations.delete('/:id/integrations/discord', tenantScope, withErrorHandler('discord_integration_delete_failed', async (c) => {
  const tenantId = c.req.param('id');

  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  const botToken = await c.env.CACHE.get(`discord:bot:${tenantId}`);
  if (!botToken) {
    return c.json<ApiResponse>({
      success: false,
      error: 'No Discord integration found for this tenant',
      code: ERROR_CODES.NOT_FOUND,
    }, 404);
  }

  await c.env.CACHE.delete(`discord:bot:${tenantId}`);
  await c.env.CACHE.delete(`discord:app:${tenantId}`);

  return c.json<ApiResponse>({
    success: true,
    data: { disconnected: true },
  });
}));

// PUT /:id/integrations/kakaotalk - save KakaoTalk API key
integrations.put('/:id/integrations/kakaotalk', tenantScope, withErrorHandler('kakaotalk_integration_failed', async (c) => {
  const tenantId = c.req.param('id');

  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  const body = await c.req.json();
  const parsed = kakaotalkIntegrationSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Validation failed', parsed.error.errors);
  }

  const { api_key, bot_id } = parsed.data;

  await c.env.CACHE.put(`kakaotalk:api:${tenantId}`, api_key);

  if (bot_id) {
    await c.env.CACHE.put(`kakaotalk:bot:${tenantId}`, bot_id);
  }

  return c.json<ApiResponse>({
    success: true,
    data: { connected: true },
  });
}));

// DELETE /:id/integrations/kakaotalk - delete KakaoTalk API key
integrations.delete('/:id/integrations/kakaotalk', tenantScope, withErrorHandler('kakaotalk_integration_delete_failed', async (c) => {
  const tenantId = c.req.param('id');

  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  const apiKey = await c.env.CACHE.get(`kakaotalk:api:${tenantId}`);
  if (!apiKey) {
    return c.json<ApiResponse>({
      success: false,
      error: 'No KakaoTalk integration found for this tenant',
      code: ERROR_CODES.NOT_FOUND,
    }, 404);
  }

  await c.env.CACHE.delete(`kakaotalk:api:${tenantId}`);
  await c.env.CACHE.delete(`kakaotalk:bot:${tenantId}`);

  return c.json<ApiResponse>({
    success: true,
    data: { disconnected: true },
  });
}));

// PUT /:id/integrations/whatsapp - save WhatsApp credentials
integrations.put('/:id/integrations/whatsapp', tenantScope, withErrorHandler('whatsapp_integration_failed', async (c) => {
  const tenantId = c.req.param('id');

  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  const body = await c.req.json();
  const parsed = whatsappIntegrationSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(c, 'Validation failed', parsed.error.errors);
  }

  const { phone_number_id, access_token } = parsed.data;

  await c.env.CACHE.put(`whatsapp:token:${tenantId}`, access_token);
  await c.env.CACHE.put(`whatsapp:phone:${tenantId}`, phone_number_id);

  return c.json<ApiResponse>({
    success: true,
    data: { connected: true },
  });
}));

// DELETE /:id/integrations/whatsapp - delete WhatsApp credentials
integrations.delete('/:id/integrations/whatsapp', tenantScope, withErrorHandler('whatsapp_integration_delete_failed', async (c) => {
  const tenantId = c.req.param('id');

  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  const accessToken = await c.env.CACHE.get(`whatsapp:token:${tenantId}`);
  if (!accessToken) {
    return c.json<ApiResponse>({
      success: false,
      error: 'No WhatsApp integration found for this tenant',
      code: ERROR_CODES.NOT_FOUND,
    }, 404);
  }

  await c.env.CACHE.delete(`whatsapp:token:${tenantId}`);
  await c.env.CACHE.delete(`whatsapp:phone:${tenantId}`);

  return c.json<ApiResponse>({
    success: true,
    data: { disconnected: true },
  });
}));

export { integrations };

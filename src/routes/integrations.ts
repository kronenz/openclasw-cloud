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

  return c.json<ApiResponse>({
    success: true,
    data: {
      integrations: integrationsList,
    },
  });
}));

export { integrations };

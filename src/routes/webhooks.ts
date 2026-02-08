import { Hono } from 'hono';
import type { Bindings, ApiResponse } from '../types/index.js';

const webhooks = new Hono<{ Bindings: Bindings }>();

// POST /messenger - receive webhook from messenger platforms
webhooks.post('/messenger', async (c) => {
  try {
    // Parse platform type from header or body
    const platformHeader = c.req.header('X-Platform-Type');
    const body = await c.req.json();
    const platform = platformHeader || body.platform || 'unknown';

    // Log webhook receipt
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'messenger_webhook_received',
      platform,
      body,
    }));

    // Route to appropriate handler based on platform
    switch (platform) {
      case 'kakao':
      case 'kakaotalk':
        // TODO: Handle KakaoTalk webhook
        // - Parse message structure
        // - Route to OpenClaw AI agent
        // - Return response to user
        console.log('KakaoTalk webhook:', body);
        break;

      case 'telegram':
        // TODO: Handle Telegram webhook
        console.log('Telegram webhook:', body);
        break;

      case 'slack':
        // TODO: Handle Slack webhook
        console.log('Slack webhook:', body);
        break;

      case 'discord':
        // TODO: Handle Discord webhook
        console.log('Discord webhook:', body);
        break;

      default:
        console.warn('Unknown messenger platform:', platform);
    }

    // Return 200 OK quickly (async processing should happen in background)
    return c.json<ApiResponse>({
      success: true,
      data: { received: true },
    });
  } catch (e) {
    console.error('Failed to process messenger webhook:', e);

    // Still return 200 to avoid webhook retries
    return c.json<ApiResponse>({
      success: true,
      data: { received: true, error: String(e) },
    });
  }
});

export { webhooks };

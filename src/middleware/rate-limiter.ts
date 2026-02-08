import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../types/index.js';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS, ERROR_CODES } from '../config/constants.js';
import { structuredError } from '../utils/log.js';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  windowMs: RATE_LIMIT_WINDOW_MS,
};

export const rateLimiterMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return next();
  }

  try {
    const config = DEFAULT_CONFIG;
    const windowKey = Math.floor(Date.now() / config.windowMs);
    const key = `ratelimit:${tenantId}:${windowKey}`;

    const currentStr = await c.env.CACHE.get(key);
    const parsed = currentStr ? parseInt(currentStr, 10) : 0;
    const current = Number.isNaN(parsed) ? 0 : parsed;

    if (current >= config.maxRequests) {
      return c.json({
        success: false,
        error: 'Rate limit exceeded',
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      }, 429);
    }

    await c.env.CACHE.put(key, String(current + 1), {
      expirationTtl: Math.ceil(config.windowMs / 1000),
    });

    c.header('X-RateLimit-Limit', String(config.maxRequests));
    c.header('X-RateLimit-Remaining', String(config.maxRequests - current - 1));

    await next();
  } catch (error) {
    structuredError('rate_limiter_cache_error', error);
    await next(); // Allow request on cache failure
  }
});

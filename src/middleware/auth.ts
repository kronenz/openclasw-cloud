import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../types/index.js';
import { verifyJWT } from '../utils/crypto.js';
import { extractBearerToken } from '../utils/jwt-helpers.js';
import { ERROR_CODES } from '../config/constants.js';

// Auth middleware - verifies Bearer token
// Sets c.set('tenantId', ...) on success
// Skips auth for /health routes
export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  // Skip auth for health endpoints
  if (c.req.path.startsWith('/health')) {
    return next();
  }

  const token = extractBearerToken(c.req.header('Authorization'));
  if (!token) {
    return c.json({ success: false, error: 'Missing authorization', code: ERROR_CODES.AUTH_REQUIRED }, 401);
  }
  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    c.set('tenantId', payload.sub as string);
    c.set('jwtPayload', payload);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid token', code: ERROR_CODES.AUTH_INVALID }, 401);
  }
});

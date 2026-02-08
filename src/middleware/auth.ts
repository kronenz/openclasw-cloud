import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../types/index.js';
import { verifyJWT } from '../utils/crypto.js';

// Auth middleware - verifies Bearer token
// Sets c.set('tenantId', ...) on success
// Skips auth for /health routes
export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  // Skip auth for health endpoints
  if (c.req.path.startsWith('/health')) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Missing authorization', code: 'AUTH_REQUIRED' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    c.set('tenantId', payload.sub as string);
    c.set('jwtPayload', payload);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid token', code: 'AUTH_INVALID' }, 401);
  }
});

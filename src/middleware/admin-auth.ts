import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../types/index.js';
import { verifyJWT } from '../utils/crypto.js';

// Admin auth middleware - verifies Bearer token and checks for admin role
// Returns 401 if token is missing/invalid, 403 if not admin
export const adminAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Missing authorization', code: 'AUTH_REQUIRED' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);

    // Check for admin role
    if (payload.role !== 'admin') {
      return c.json({ success: false, error: 'Admin access required', code: 'FORBIDDEN' }, 403);
    }

    c.set('jwtPayload', payload);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid token', code: 'AUTH_INVALID' }, 401);
  }
});

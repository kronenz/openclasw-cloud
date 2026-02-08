import { createMiddleware } from 'hono/factory';
import type { ApiResponse, Bindings, Variables } from '../types/index.js';
import { verifyJWT } from '../utils/crypto.js';
import { extractBearerToken } from '../utils/jwt-helpers.js';
import { ERROR_CODES } from '../config/constants.js';

// Admin auth middleware - verifies Bearer token and checks for admin role
// Returns 401 if token is missing/invalid, 403 if not admin
export const adminAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const token = extractBearerToken(c.req.header('Authorization'));
  if (!token) {
    return c.json<ApiResponse>({ success: false, error: 'Missing authorization', code: ERROR_CODES.AUTH_REQUIRED }, 401);
  }
  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);

    // Check for admin role
    if (payload.role !== 'admin') {
      return c.json<ApiResponse>({ success: false, error: 'Admin access required', code: ERROR_CODES.FORBIDDEN }, 403);
    }

    c.set('jwtPayload', payload);
    await next();
  } catch {
    return c.json<ApiResponse>({ success: false, error: 'Invalid token', code: ERROR_CODES.AUTH_INVALID }, 401);
  }
});

import { createMiddleware } from 'hono/factory';
import type { ApiResponse, Bindings, Variables } from '../types/index.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * Middleware that checks if the authenticated user has access to the requested tenant.
 * Admin users (role: 'admin') can access any tenant.
 * Regular users can only access their own tenant (JWT sub must match :tenantId/:id param).
 */
export const tenantScope = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const jwtPayload = c.get('jwtPayload') || {};
  const requestedTenantId = c.req.param('tenantId') || c.req.param('id');

  // Admin users bypass tenant scope check
  if (jwtPayload.role === 'admin') {
    return next();
  }

  // Check if the JWT subject matches the requested tenant
  if (requestedTenantId && jwtPayload.sub !== requestedTenantId) {
    return c.json<ApiResponse>({ success: false, error: 'Forbidden', code: ERROR_CODES.FORBIDDEN }, 403);
  }

  return next();
});

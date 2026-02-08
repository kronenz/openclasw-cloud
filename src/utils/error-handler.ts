import type { Context } from 'hono';
import type { Bindings, ApiResponse } from '../types/index.js';
import { structuredError } from './log.js';

/**
 * Wraps a route handler with standardized error handling.
 * Catches errors, logs them with structuredError, and returns a consistent 500 response.
 */
export function withErrorHandler<B extends Bindings = Bindings>(
  eventName: string,
  handler: (c: Context<{ Bindings: B }>) => Promise<Response>,
) {
  return async (c: Context<{ Bindings: B }>) => {
    try {
      return await handler(c);
    } catch (e) {
      structuredError(eventName, e);
      return c.json<ApiResponse>(
        { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
        500
      );
    }
  };
}

/**
 * Returns a standardized validation error response.
 */
export function validationError(c: Context, message: string, details?: unknown) {
  return c.json<ApiResponse>(
    { success: false, error: message, code: 'VALIDATION_ERROR', details },
    400
  );
}

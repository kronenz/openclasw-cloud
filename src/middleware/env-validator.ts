import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../types/index.js';
import { ERROR_CODES } from '../config/constants.js';
import { structuredError } from '../utils/log.js';

const REQUIRED_BINDINGS = ['DB', 'STORAGE', 'CACHE'] as const;

export const envValidatorMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const missing = REQUIRED_BINDINGS.filter((key) => !c.env[key]);

  if (missing.length > 0) {
    structuredError('missing_required_bindings', new Error(`Missing bindings: ${missing.join(', ')}`));
    return c.json({
      success: false,
      error: 'Service configuration error',
      code: ERROR_CODES.CONFIGURATION_ERROR,
    }, 503);
  }

  await next();
});

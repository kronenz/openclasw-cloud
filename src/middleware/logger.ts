import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../types/index.js';

export const loggerMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);

  await next();

  const duration = Date.now() - start;
  const log = {
    timestamp: new Date().toISOString(),
    request_id: requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration_ms: duration,
    env: c.env.ENVIRONMENT,
  };

  console.log(JSON.stringify(log));
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { withErrorHandler, validationError } from '../../../src/utils/error-handler.js';
import { parseApiResponse } from '../../helpers/types.js';

// Mock the log utility
vi.mock('../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredWarn: vi.fn(),
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

import { structuredError } from '../../../src/utils/log.js';

describe('Error Handler Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withErrorHandler', () => {
    it('returns handler result on success', async () => {
      const app = new Hono();
      app.get('/test', withErrorHandler('test_event', async (c) => {
        return c.json({ success: true, data: 'ok' });
      }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(true);
      expect(body.data).toBe('ok');
    });

    it('catches errors and returns 500 with INTERNAL_ERROR code', async () => {
      const app = new Hono();
      app.get('/test', withErrorHandler('test_event', async () => {
        throw new Error('Something went wrong');
      }));

      const res = await app.request('/test');
      expect(res.status).toBe(500);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error');
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('logs the error with structuredError using the eventName', async () => {
      const app = new Hono();
      const testError = new Error('Test error');
      app.get('/test', withErrorHandler('custom_event', async () => {
        throw testError;
      }));

      await app.request('/test');

      expect(structuredError).toHaveBeenCalledTimes(1);
      expect(structuredError).toHaveBeenCalledWith('custom_event', testError);
    });

    it('returns 400 for SyntaxError (malformed JSON)', async () => {
      const app = new Hono();
      app.post('/test', withErrorHandler('json_event', async (c) => {
        await c.req.json();
        return c.json({ success: true });
      }));

      const res = await app.request('/test', {
        method: 'POST',
        body: '{bad json',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid JSON payload');
      expect(body.code).toBe('INVALID_PAYLOAD');
      // Should NOT log as structuredError since it's a client error
      expect(structuredError).not.toHaveBeenCalled();
    });

    it('handles different types of thrown values', async () => {
      const app = new Hono();

      // Test with string error
      app.get('/string-error', withErrorHandler('string_event', async () => {
        throw 'String error';
      }));

      const res = await app.request('/string-error');
      expect(res.status).toBe(500);
      const body = await parseApiResponse(res);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(structuredError).toHaveBeenCalledWith('string_event', 'String error');
    });

    it('preserves handler context and response types', async () => {
      const app = new Hono();
      app.get('/test', withErrorHandler('test_event', async (c) => {
        const url = c.req.url;
        return c.json({ success: true, url });
      }));

      const res = await app.request('http://localhost/test');
      expect(res.status).toBe(200);
      const body = await parseApiResponse(res);
      expect(body.url).toBe('http://localhost/test');
    });

    it('handles async errors correctly', async () => {
      const app = new Hono();
      app.get('/test', withErrorHandler('async_event', async () => {
        await Promise.resolve();
        throw new Error('Async error');
      }));

      const res = await app.request('/test');
      expect(res.status).toBe(500);
      expect(structuredError).toHaveBeenCalledTimes(1);
    });

    it('allows multiple wrapped handlers with different event names', async () => {
      const app = new Hono();

      app.get('/route1', withErrorHandler('event1', async () => {
        throw new Error('Error 1');
      }));

      app.get('/route2', withErrorHandler('event2', async () => {
        throw new Error('Error 2');
      }));

      await app.request('/route1');
      expect(structuredError).toHaveBeenLastCalledWith('event1', expect.any(Error));

      await app.request('/route2');
      expect(structuredError).toHaveBeenLastCalledWith('event2', expect.any(Error));
    });
  });

  describe('validationError', () => {
    it('returns 400 with VALIDATION_ERROR code', async () => {
      const app = new Hono();
      app.get('/test', async (c) => {
        return validationError(c, 'Invalid input');
      });

      const res = await app.request('/test');
      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid input');
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('includes details when provided', async () => {
      const app = new Hono();
      const details = { field: 'email', reason: 'invalid format' };

      app.get('/test', async (c) => {
        return validationError(c, 'Validation failed', details);
      });

      const res = await app.request('/test');
      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toEqual(details);
    });

    it('works without details parameter', async () => {
      const app = new Hono();
      app.get('/test', async (c) => {
        return validationError(c, 'Missing required field');
      });

      const res = await app.request('/test');
      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Missing required field');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toBeUndefined();
    });

    it('handles complex details objects', async () => {
      const app = new Hono();
      const complexDetails = {
        errors: [
          { field: 'email', message: 'Invalid format' },
          { field: 'age', message: 'Must be positive' }
        ],
        timestamp: new Date().toISOString()
      };

      app.get('/test', async (c) => {
        return validationError(c, 'Multiple validation errors', complexDetails);
      });

      const res = await app.request('/test');
      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.details).toEqual(complexDetails);
    });

    it('handles array details', async () => {
      const app = new Hono();
      const arrayDetails = ['error1', 'error2', 'error3'];

      app.get('/test', async (c) => {
        return validationError(c, 'Multiple errors', arrayDetails);
      });

      const res = await app.request('/test');
      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.details).toEqual(arrayDetails);
    });

    it('can be used within withErrorHandler', async () => {
      const app = new Hono();
      app.get('/test', withErrorHandler('validation_test', async (c) => {
        const valid = false;
        if (!valid) {
          return validationError(c, 'Validation failed');
        }
        return c.json({ success: true });
      }));

      const res = await app.request('/test');
      expect(res.status).toBe(400);
      const body = await parseApiResponse(res);
      expect(body.code).toBe('VALIDATION_ERROR');
      // Should not call structuredError since no exception was thrown
      expect(structuredError).not.toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('handles validation errors before potential exceptions', async () => {
      const app = new Hono();
      app.post('/create', withErrorHandler('create_resource', async (c) => {
        const body = await c.req.json() as any;

        if (!body.name) {
          return validationError(c, 'Name is required', { field: 'name' });
        }

        // Simulated database operation that could throw
        if (body.name === 'error') {
          throw new Error('Database error');
        }

        return c.json({ success: true, data: { id: 1, name: body.name } });
      }));

      // Test validation error path
      const validationRes = await app.request('/create', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(validationRes.status).toBe(400);

      // Test exception path
      const errorRes = await app.request('/create', {
        method: 'POST',
        body: JSON.stringify({ name: 'error' }),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(errorRes.status).toBe(500);

      // Test success path
      const successRes = await app.request('/create', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(successRes.status).toBe(200);
    });

    it('maintains proper response structure across all error types', async () => {
      const app = new Hono();

      app.get('/validation', async (c) => validationError(c, 'Bad request'));
      app.get('/exception', withErrorHandler('exception', async () => {
        throw new Error('Internal error');
      }));

      const validationRes = await app.request('/validation');
      const validationBody = await parseApiResponse(validationRes);
      expect(validationBody).toHaveProperty('success', false);
      expect(validationBody).toHaveProperty('error');
      expect(validationBody).toHaveProperty('code');

      const exceptionRes = await app.request('/exception');
      const exceptionBody = await parseApiResponse(exceptionRes);
      expect(exceptionBody).toHaveProperty('success', false);
      expect(exceptionBody).toHaveProperty('error');
      expect(exceptionBody).toHaveProperty('code');
    });
  });
});

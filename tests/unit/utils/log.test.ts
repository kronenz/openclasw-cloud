import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { structuredLog, structuredWarn, structuredError } from '../../../src/utils/log';

describe('structuredLog', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('outputs JSON with timestamp, level:info, and event name', () => {
    structuredLog('test_event');

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output).toHaveProperty('timestamp');
    expect(output.level).toBe('info');
    expect(output.event).toBe('test_event');
    expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
  });

  it('includes additional data fields', () => {
    structuredLog('user_action', { userId: '123', action: 'click' });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output.userId).toBe('123');
    expect(output.action).toBe('click');
    expect(output.event).toBe('user_action');
  });

  it('handles default empty data when none provided', () => {
    structuredLog('simple_event');

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output.timestamp).toBeDefined();
    expect(output.level).toBe('info');
    expect(output.event).toBe('simple_event');
    expect(Object.keys(output)).toEqual(['timestamp', 'level', 'event']);
  });
});

describe('structuredWarn', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('outputs with level:warn', () => {
    structuredWarn('warning_event', { reason: 'rate_limit' });

    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

    expect(output.level).toBe('warn');
    expect(output.event).toBe('warning_event');
    expect(output.reason).toBe('rate_limit');
  });
});

describe('structuredError', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('includes error_message from Error object', () => {
    const error = new Error('Something went wrong');
    structuredError('error_event', error, { context: 'api_call' });

    const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

    expect(output.level).toBe('error');
    expect(output.event).toBe('error_event');
    expect(output.error_message).toBe('Something went wrong');
    expect(output.context).toBe('api_call');
  });

  it('handles non-Error values', () => {
    structuredError('error_event', 'string error');

    const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

    expect(output.error_message).toBe('string error');
  });

  it('handles non-Error object values', () => {
    structuredError('error_event', { code: 500 });

    const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

    expect(output.error_message).toBe('[object Object]');
  });

  it('includes additional data fields with error', () => {
    const error = new Error('Failed');
    structuredError('db_error', error, { table: 'users', operation: 'insert' });

    const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

    expect(output.error_message).toBe('Failed');
    expect(output.table).toBe('users');
    expect(output.operation).toBe('insert');
  });
});

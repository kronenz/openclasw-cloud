import { describe, it, expect } from 'vitest';
import { safeJsonParse } from '../../../src/utils/json.js';

describe('safeJsonParse', () => {
  it('parses valid JSON string', () => {
    const result = safeJsonParse('{"key":"value"}', {});
    expect(result).toEqual({ key: 'value' });
  });

  it('returns fallback for invalid JSON', () => {
    const fallback = { default: true };
    const result = safeJsonParse('not valid json', fallback);
    expect(result).toBe(fallback);
  });

  it('returns fallback for null input', () => {
    const fallback = { default: true };
    const result = safeJsonParse(null, fallback);
    expect(result).toBe(fallback);
  });

  it('returns fallback for undefined input', () => {
    const fallback = { default: true };
    const result = safeJsonParse(undefined, fallback);
    expect(result).toBe(fallback);
  });

  it('returns fallback for empty string', () => {
    const fallback = { default: true };
    const result = safeJsonParse('', fallback);
    expect(result).toBe(fallback);
  });

  it('parses JSON arrays', () => {
    const result = safeJsonParse('[1,2,3]', []);
    expect(result).toEqual([1, 2, 3]);
  });

  it('parses JSON objects', () => {
    const result = safeJsonParse('{"a":1,"b":2}', {});
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('parses JSON numbers', () => {
    const result = safeJsonParse('42', 0);
    expect(result).toBe(42);
  });

  it('parses JSON booleans', () => {
    const result = safeJsonParse('true', false);
    expect(result).toBe(true);
  });

  it('preserves type information with generics', () => {
    interface TestType {
      name: string;
      value: number;
    }
    const fallback: TestType = { name: 'default', value: 0 };
    const result = safeJsonParse<TestType>('{"name":"test","value":123}', fallback);
    expect(result.name).toBe('test');
    expect(result.value).toBe(123);
  });
});

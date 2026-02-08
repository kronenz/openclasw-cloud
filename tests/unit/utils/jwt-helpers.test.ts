import { describe, it, expect } from 'vitest';
import { extractBearerToken } from '../../../src/utils/jwt-helpers.js';

describe('extractBearerToken', () => {
  it('returns null for undefined header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for empty string header', () => {
    expect(extractBearerToken('')).toBeNull();
  });

  it('returns null for header without "Bearer " prefix', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('returns null for header that is just "Bearer " (no token)', () => {
    expect(extractBearerToken('Bearer ')).toBe('');
  });

  it('returns token for valid "Bearer <token>" header', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(extractBearerToken(`Bearer ${token}`)).toBe(token);
  });

  it('returns token with special characters', () => {
    const token = 'abc-123_xyz.456+789=';
    expect(extractBearerToken(`Bearer ${token}`)).toBe(token);
  });

  it('case-sensitive: "bearer " (lowercase) returns null', () => {
    expect(extractBearerToken('bearer token123')).toBeNull();
  });

  it('returns token for very long token string', () => {
    const longToken = 'a'.repeat(1000);
    expect(extractBearerToken(`Bearer ${longToken}`)).toBe(longToken);
  });

  it('returns null for "BearerToken" (no space)', () => {
    expect(extractBearerToken('BearerToken123')).toBeNull();
  });

  it('returns null for header with extra prefix', () => {
    expect(extractBearerToken('X-Bearer token123')).toBeNull();
  });

  it('returns token even if it contains spaces', () => {
    // This is technically malformed but the function does not validate
    const token = 'token with spaces';
    expect(extractBearerToken(`Bearer ${token}`)).toBe(token);
  });
});

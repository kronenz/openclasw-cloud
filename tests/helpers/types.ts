/**
 * Type-safe API response for tests.
 * Use instead of `as any` when parsing JSON responses.
 */
export interface TestApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

/**
 * Helper to parse a Response as a typed API response.
 */
export async function parseApiResponse<T = unknown>(res: Response): Promise<TestApiResponse<T>> {
  return await res.json() as TestApiResponse<T>;
}

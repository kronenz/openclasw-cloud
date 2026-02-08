/**
 * Extract Bearer token from Authorization header.
 * Returns the token string or null if header is missing/malformed.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

// JWT functions using Web Crypto API (Cloudflare Workers compatible)

// Helper: base64url encode
function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Helper: base64url decode
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// HMAC-SHA256 sign
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(signature);
}

// HMAC-SHA256 verify
async function verify(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await sign(data, secret);
  return signature === expectedSignature;
}

// Create JWT
export async function createJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerEncoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadEncoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;
  const signature = await sign(dataToSign, secret);

  return `${dataToSign}.${signature}`;
}

// Verify JWT
export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [headerEncoded, payloadEncoded, signature] = parts;
  const dataToVerify = `${headerEncoded}.${payloadEncoded}`;

  const isValid = await verify(dataToVerify, signature, secret);
  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }

  const payloadBytes = base64UrlDecode(payloadEncoded);
  const payloadStr = new TextDecoder().decode(payloadBytes);
  const payload = JSON.parse(payloadStr) as Record<string, unknown>;

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    throw new Error('JWT expired');
  }

  return payload;
}

// Generate a secure random API key
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

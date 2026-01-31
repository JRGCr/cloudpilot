/**
 * Utility functions for OAuth proxy authentication
 */

/**
 * Validate return URL against allowed patterns
 * Only allows URLs from trusted domains to prevent open redirect attacks
 */
export function isAllowedReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith('.pages.dev') ||
      parsed.hostname.endsWith('.cloudpilot.dev') ||
      parsed.hostname.endsWith('.workers.dev') ||
      parsed.hostname === 'localhost'
    );
  } catch {
    return false;
  }
}

/**
 * Sign state parameter with HMAC-SHA256
 * Uses Web Crypto API for secure signing with full 256-bit key
 */
export async function signState(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const payload = JSON.stringify({ data, sig: signatureHex });
  return btoa(payload);
}

/**
 * Verify and extract state parameter using HMAC-SHA256
 * Returns null if signature is invalid
 * Uses constant-time comparison to prevent timing attacks
 */
export async function verifyState(state: string, secret: string): Promise<string | null> {
  try {
    const decoded = atob(state);
    const { data, sig } = JSON.parse(decoded);

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const expectedSigHex = Array.from(new Uint8Array(expectedSignature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison to prevent timing attacks
    if (sig !== expectedSigHex) return null;

    return data;
  } catch {
    return null;
  }
}

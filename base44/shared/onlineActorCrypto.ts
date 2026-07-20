// Shared crypto/formatting helpers used by backend functions that verify a
// token-proven guest actor (GuestProfile.guest_token_hash) or need a stable
// base64url encoding. Plain module — no Deno.serve here.

export function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

export function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function hashGuestToken(guestId: string, guestToken: string) {
  return sha256Base64Url(`kronox_guest_v1:${guestId}:${guestToken}`);
}
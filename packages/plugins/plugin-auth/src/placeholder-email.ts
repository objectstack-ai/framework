// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Placeholder emails for users without a real address (#2766 V1.5).
 *
 * better-auth's user model requires a unique email, so employees who sign in
 * with a phone number (or, later, an imported username) still need one. The
 * placeholder is designed to be safe on three axes:
 *
 * 1. **Never deliverable.** The domain is under `.invalid` — an RFC 2606
 *    reserved TLD that can never resolve — so even if a send-guard is missed,
 *    no mail can physically leave for a real mailbox.
 * 2. **Never leaks the phone number.** `sys_user` has `exportCsv` enabled and
 *    the email column shows up in Console lists, exports, and logs. The local
 *    part is a random opaque token, NOT derived from the phone number (or any
 *    other PII), so nothing spreads with it.
 * 3. **Cheaply recognizable.** Every auth email callback (reset password,
 *    invitation, magic link) checks `isPlaceholderEmail()` and refuses with an
 *    explicit error instead of attempting delivery.
 */

export const PLACEHOLDER_EMAIL_DOMAIN = 'placeholder.invalid';

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'; // base32, lowercase
const TOKEN_LENGTH = 20;

/**
 * Mint a fresh placeholder address: `u-<random base32 token>@placeholder.invalid`.
 * The token is random (not user-derived) — see the module doc for why.
 */
export function generatePlaceholderEmail(): string {
  const bytes = new Uint32Array(TOKEN_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let token = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return `u-${token}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** Is this address one of ours (or anything else that can never deliver)? */
export function isPlaceholderEmail(email: unknown): boolean {
  return (
    typeof email === 'string' &&
    email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
  );
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Pluggable adapter for at-rest encryption of `Specifier.encrypted: true`
 * values. The default {@link NoopCryptoAdapter} provides a transparent
 * base64 wrapping suitable for development and tests; production
 * deployments MUST inject a real KMS-backed adapter.
 *
 * encrypt/decrypt are async to leave room for KMS round-trips.
 */
export interface CryptoAdapter {
  /** Returns the ciphertext blob to store in `sys_setting.value_enc`. */
  encrypt(plaintext: string, ctx: { namespace: string; key: string }): Promise<string>;
  /** Returns the plaintext used by the resolver. */
  decrypt(ciphertext: string, ctx: { namespace: string; key: string }): Promise<string>;
  /**
   * Stable, short, non-reversible digest used for audit-log entries so
   * operators can correlate value changes without leaking secrets.
   */
  digest(plaintext: string): string;
}

/**
 * Development / test default. Base64-wraps the plaintext so the column
 * isn't a literal mirror but provides no real confidentiality.
 *
 * Operators are expected to override this via
 * `SettingsServicePluginOptions.crypto`.
 */
export class NoopCryptoAdapter implements CryptoAdapter {
  async encrypt(plaintext: string): Promise<string> {
    return 'b64:' + Buffer.from(plaintext, 'utf8').toString('base64');
  }
  async decrypt(ciphertext: string): Promise<string> {
    if (!ciphertext.startsWith('b64:')) {
      // Tolerate legacy plaintext rows during the dev rollout.
      return ciphertext;
    }
    return Buffer.from(ciphertext.slice(4), 'base64').toString('utf8');
  }
  digest(plaintext: string): string {
    // FNV-1a 32-bit — short, stable, non-cryptographic. Audit-only.
    let h = 0x811c9dc5;
    for (let i = 0; i < plaintext.length; i++) {
      h ^= plaintext.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return 'fnv32:' + h.toString(16).padStart(8, '0');
  }
}

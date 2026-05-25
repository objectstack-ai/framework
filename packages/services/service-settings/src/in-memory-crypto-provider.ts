// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  CryptoContext,
  CryptoHandle,
  ICryptoProvider,
} from '@objectstack/spec/contracts';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

/**
 * InMemoryCryptoProvider — default ICryptoProvider used by the
 * SettingsService when the host application does not wire a real KMS.
 *
 * Encryption: AES-256-GCM with a per-process random data key. The data
 * key lives only in memory; restarting the process loses the ability
 * to decrypt previously-written rows. This is intentional — operators
 * MUST replace this with a KMS-backed provider before relying on
 * `sys_secret` for production secrets. The provider's purpose is to:
 *
 *  - exercise the round-trip in unit tests and dev kernels;
 *  - provide a "real-looking" handle format so consumers don't depend
 *    on accidental implementation details of a no-op adapter;
 *  - serve as a reference for what AwsKmsCryptoProvider /
 *    GcpKmsCryptoProvider implementations need to satisfy.
 *
 * Handle format:
 *   id        — `sec_` + 32 hex chars (122 bits of entropy)
 *   kmsKeyId  — `local:in-memory:v<version>`
 *   alg       — `aes-256-gcm`
 *   version   — bumps on rotateKey()
 *   ciphertext— base64(iv (12) || authTag (16) || cipher)
 *
 * AAD binding: the CryptoContext (namespace + key + tenantId) is
 * folded into AES-GCM AAD so a ciphertext rewrapped from a different
 * (ns, key) tuple fails decryption — guards against operators
 * accidentally copying rows between namespaces.
 *
 * WebContainer (StackBlitz) note: `node:crypto.createCipheriv('aes-256-gcm', …)`
 * is not implemented in WebContainer. When we detect that runtime, we
 * swap to a pure-JS AES-GCM from `@noble/ciphers/aes.js`, producing the
 * same `iv || tag || ciphertext` byte layout so the handle shape is
 * unchanged. The swap is best-effort: if the dependency is missing,
 * we fall back to the Node implementation and let it throw, surfacing
 * the configuration problem clearly.
 */
const isWebContainerRuntime = (): boolean => {
  const g = globalThis as any;
  return (
    typeof g !== 'undefined' &&
    (Boolean(g.process?.versions?.webcontainer) ||
      Boolean(g.process?.env?.SHELL?.includes?.('jsh')) ||
      Boolean(g.process?.env?.STACKBLITZ))
  );
};

type GcmFactory = (key: Uint8Array, nonce: Uint8Array, aad?: Uint8Array) => {
  encrypt: (plain: Uint8Array) => Uint8Array;
  decrypt: (cipher: Uint8Array) => Uint8Array;
};

let nobleGcmPromise: Promise<GcmFactory | undefined> | undefined;
const loadNobleGcm = (): Promise<GcmFactory | undefined> => {
  if (!nobleGcmPromise) {
    nobleGcmPromise = (async () => {
      try {
        const mod = await import('@noble/ciphers/aes.js');
        return mod.gcm as unknown as GcmFactory;
      } catch (err: any) {
        console.warn(
          `[InMemoryCryptoProvider] WebContainer detected but @noble/ciphers not installed: ${err?.message ?? err}. Falling back to node:crypto (will throw).`,
        );
        return undefined;
      }
    })();
  }
  return nobleGcmPromise;
};

export class InMemoryCryptoProvider implements ICryptoProvider {
  private readonly key: Buffer;
  private readonly useNoble: boolean;

  constructor(opts: { key?: Buffer } = {}) {
    this.key = opts.key ?? randomBytes(32);
    this.useNoble = isWebContainerRuntime();
  }

  async encrypt(plain: string, ctx: CryptoContext): Promise<CryptoHandle> {
    const iv = randomBytes(12);
    const aad = Buffer.from(this.aadOf(ctx), 'utf8');
    const plainBytes = Buffer.from(plain, 'utf8');

    let blob: string;
    if (this.useNoble) {
      const gcm = await loadNobleGcm();
      if (gcm) {
        const cipher = gcm(this.key, iv, aad);
        const ctWithTag = cipher.encrypt(plainBytes); // ciphertext || tag(16)
        const ct = ctWithTag.subarray(0, ctWithTag.length - 16);
        const tag = ctWithTag.subarray(ctWithTag.length - 16);
        blob = Buffer.concat([iv, Buffer.from(tag), Buffer.from(ct)]).toString('base64');
      } else {
        blob = this.encryptNode(plainBytes, iv, aad);
      }
    } else {
      blob = this.encryptNode(plainBytes, iv, aad);
    }

    return {
      id: 'sec_' + randomBytes(16).toString('hex'),
      kmsKeyId: 'local:in-memory:v1',
      alg: 'aes-256-gcm',
      version: 1,
      ciphertext: blob,
    };
  }

  async decrypt(handle: CryptoHandle, ctx: CryptoContext): Promise<string> {
    const buf = Buffer.from(handle.ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const aad = Buffer.from(this.aadOf(ctx), 'utf8');

    if (this.useNoble) {
      const gcm = await loadNobleGcm();
      if (gcm) {
        const cipher = gcm(this.key, iv, aad);
        const ctWithTag = Buffer.concat([data, tag]); // noble expects ciphertext || tag
        const out = cipher.decrypt(ctWithTag);
        return Buffer.from(out).toString('utf8');
      }
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  async rotateKey(handle: CryptoHandle, ctx: CryptoContext): Promise<CryptoHandle> {
    const plain = await this.decrypt(handle, ctx);
    const next = await this.encrypt(plain, ctx);
    return {
      ...next,
      id: handle.id,
      kmsKeyId: `local:in-memory:v${handle.version + 1}`,
      version: handle.version + 1,
    };
  }

  digest(plain: string): string {
    return 'sha256:' + createHash('sha256').update(plain, 'utf8').digest('hex');
  }

  private encryptNode(plainBytes: Buffer, iv: Buffer, aad: Buffer): string {
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(aad);
    const enc = Buffer.concat([cipher.update(plainBytes), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  private aadOf(ctx: CryptoContext): string {
    // Bind ciphertext to (namespace,key) so a row cannot be moved across
    // specifiers. Tenant binding is intentionally omitted because the
    // handle is dereferenced from a `sys_setting` row already scoped to
    // its tenant — adding tenant here would force the decrypt path to
    // re-read that scope.
    return [ctx.namespace, ctx.key].join('|');
  }
}

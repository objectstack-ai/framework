// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Default datasource SecretBinder — persists a runtime datasource's cleartext
 * credential into the `sys_secret` cipher store and returns an opaque
 * `credentialsRef` handle (ADR-0015 Addendum, security invariant).
 *
 * Mirrors the SettingsService Phase-3 split: the cleartext is wrapped by an
 * {@link ICryptoProvider} into a {@link CryptoHandle}, the ciphertext lands in a
 * `sys_secret` row keyed by `handle.id`, and only the handle id (wrapped as
 * `sys_secret:<id>`) is ever stored on the datasource artefact. Cleartext never
 * touches metadata.
 *
 * This is the dev/self-host wiring; production hosts swap the
 * `InMemoryCryptoProvider` for a KMS-backed `ICryptoProvider` and pass it here.
 */

import type { CryptoHandle, ICryptoProvider } from '@objectstack/spec/contracts';

/** Prefix used to recognise a datasource credential handle. */
const REF_PREFIX = 'sys_secret:';

/** Minimal data-engine surface used to read/write the `sys_secret` store. */
export interface SecretStoreEngineLike {
  insert(object: string, data: Record<string, unknown>, options?: unknown): Promise<unknown>;
  delete(object: string, options: { where: Record<string, unknown> }): Promise<unknown>;
}

export interface DatasourceSecretBinderDeps {
  /** Data engine (ObjectQL) used to persist the `sys_secret` row. */
  engine: SecretStoreEngineLike;
  /** Crypto provider that wraps cleartext into a {@link CryptoHandle}. */
  cryptoProvider: ICryptoProvider;
  /** Settings namespace recorded on the secret row (default `'datasource'`). */
  namespace?: string;
}

export interface DatasourceSecretBinder {
  bind(input: { value: string; namespace?: string; key?: string }, hint: { name: string }): Promise<string>;
  unbind(credentialsRef: string): Promise<void>;
}

/** Build a `credentialsRef` from a crypto handle id. */
export function toCredentialsRef(handleId: string): string {
  return `${REF_PREFIX}${handleId}`;
}

/** Extract the `sys_secret` handle id from a credentialsRef, if it is one. */
export function parseCredentialsRef(ref: string): string | undefined {
  return ref?.startsWith(REF_PREFIX) ? ref.slice(REF_PREFIX.length) : undefined;
}

/**
 * Create the default datasource secret binder. Persists into `sys_secret` via
 * the data engine and never returns or logs the cleartext.
 */
export function createDatasourceSecretBinder(deps: DatasourceSecretBinderDeps): DatasourceSecretBinder {
  const { engine, cryptoProvider } = deps;
  const defaultNamespace = deps.namespace ?? 'datasource';

  return {
    async bind(input, hint) {
      const namespace = input.namespace ?? defaultNamespace;
      const key = input.key ?? hint.name;
      const handle: CryptoHandle = await cryptoProvider.encrypt(input.value, { namespace, key });
      await engine.insert('sys_secret', {
        id: handle.id,
        namespace,
        key,
        kms_key_id: handle.kmsKeyId,
        alg: handle.alg,
        version: handle.version,
        ciphertext: handle.ciphertext,
      });
      return toCredentialsRef(handle.id);
    },

    async unbind(credentialsRef) {
      const id = parseCredentialsRef(credentialsRef);
      if (!id) return; // not ours (or already cleared) — nothing to do
      await engine.delete('sys_secret', { where: { id } });
    },
  };
}

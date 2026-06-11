// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared marketplace / cloud control-plane defaults.
 *
 * Centralised so every plugin + the CLI auto-inject path agree on
 * "what cloud URL do we mean when the user didn't set OS_CLOUD_URL?".
 * Until we have a competing public hosted cloud, this points at the
 * ObjectStack-operated control plane so a vanilla `objectstack dev` can
 * browse the marketplace out of the box.
 *
 * @deprecated ADR-0006 — framework's DUPLICATE copy. Canonical implementation
 * lives in cloud `@objectstack/objectos-runtime`
 * (`packages/objectos-runtime/src/cloud-url.ts`), which `apps/objectos` already
 * uses. **Still load-bearing**: the framework CLI `serve.ts` dynamically
 * imports `resolveCloudUrl` for cloud-dev serve mode — DO NOT DELETE until
 * ADR-0006 Phase 4 decouples the CLI (= ADR-0007 ⑤). Phase 1 declaration only.
 */
export const DEFAULT_CLOUD_URL = 'https://cloud.objectos.ai';

/**
 * Resolve the effective control-plane URL from an explicit constructor
 * value, the OS_CLOUD_URL env var, or the default. Returns an empty
 * string when the caller explicitly disabled cloud with
 * `OS_CLOUD_URL=off` / `local` — callers should treat that as
 * "marketplace unavailable on this runtime".
 */
export function resolveCloudUrl(explicit?: string | null): string {
    const raw = (explicit ?? process.env.OS_CLOUD_URL ?? '').trim();
    const lower = raw.toLowerCase();
    if (lower === 'off' || lower === 'none' || lower === 'local' || lower === 'disabled') {
        return '';
    }
    const picked = raw || DEFAULT_CLOUD_URL;
    return picked.replace(/\/+$/, '');
}

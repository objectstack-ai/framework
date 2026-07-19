// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Platform SERVICE capability vocabulary — the canonical tokens accepted in a
 * stack's `requires: [...]` declaration (framework#3265).
 *
 * ONE vocabulary across every runtime that resolves `requires`: the standalone
 * `os serve` / `os start` path (`@objectstack/cli`) and cloud's multi-tenant
 * `objectos-runtime` capability loader. Both loaders key their provider
 * registries by these tokens, so a stack declaration means the same thing
 * wherever it boots. (These are platform SERVICE capabilities — NOT the
 * ADR-0066 authorization capabilities declared in `capabilities: [...]`.)
 *
 * Canonical spelling is lower-case kebab-case (`ai-studio`, `pinyin-search`,
 * `hierarchy-security`). Legacy camelCase spellings that shipped in cloud
 * configs are mapped through {@link DEPRECATED_PLATFORM_CAPABILITY_ALIASES}
 * for one deprecation cycle — `defineStack` normalizes them with a warning at
 * authoring time, and runtimes canonicalize raw artifact input the same way.
 *
 * Growing the platform: when a new `requires`-resolvable service ships, add
 * its token HERE as well as to the runtime's provider registry — the CLI's
 * vocabulary-drift test fails if the registries and this list fall out of
 * sync. Unknown tokens are warn-only for now (`defineStack` and the serve
 * resolver both warn) so third-party experimentation isn't bricked; once the
 * vocabulary has proven complete the warn is intended to become a reject
 * (Prime Directive #12: surface producer mistakes at authoring, loudly).
 */
export const PLATFORM_CAPABILITY_TOKENS: readonly string[] = Object.freeze([
  // Tier-gated capabilities (framework `serve.ts` CAPABILITY_TO_TIER)
  'ai',
  'ai-studio',
  'i18n',
  'ui',
  'auth',
  // Service capabilities (framework `serve.ts` CAPABILITY_PROVIDERS)
  'automation',
  'analytics',
  'audit',
  'cache',
  'storage',
  'queue',
  'job',
  'messaging',
  'triggers',
  'realtime',
  'mcp',
  'marketplace',
  'email',
  'sms',
  'sharing',
  'pinyin-search',
  'reports',
  'approvals',
  'settings',
  'webhooks',
  // Enterprise / cloud-runtime capabilities (no open-edition provider:
  // `hierarchy-security` ships in @objectstack/security-enterprise via
  // `plugins[]`; `ai-seat` / `governance` are resolved by cloud's
  // objectos-runtime loader only)
  'hierarchy-security',
  'ai-seat',
  'governance',
]);

/**
 * Deprecated `requires` spellings → canonical token. One deprecation cycle:
 * authoring (`defineStack`) rewrites these with a warning; runtimes accept
 * them via {@link canonicalizePlatformCapability} so artifacts built by an
 * older spec keep booting. Do not add new aliases — new tokens ship in
 * canonical kebab-case only.
 */
export const DEPRECATED_PLATFORM_CAPABILITY_ALIASES: Readonly<Record<string, string>> =
  Object.freeze({
    aiStudio: 'ai-studio',
    aiSeat: 'ai-seat',
  });

/**
 * Map a `requires` token to its canonical spelling (identity for tokens that
 * are already canonical or unknown).
 */
export function canonicalizePlatformCapability(token: string): string {
  return DEPRECATED_PLATFORM_CAPABILITY_ALIASES[token] ?? token;
}

/**
 * True when the token (after alias canonicalization) is part of the platform
 * capability vocabulary.
 */
export function isKnownPlatformCapability(token: string): boolean {
  return PLATFORM_CAPABILITY_TOKENS.includes(canonicalizePlatformCapability(token));
}

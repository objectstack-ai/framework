// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * api-key — re-export of the shared `sys_api_key` primitives + verifier.
 *
 * The implementation now lives in `@objectstack/core/security` so BOTH inbound
 * surfaces — this runtime's dispatcher/MCP path (`resolveExecutionContext`) and
 * the REST data API (`@objectstack/rest`) — verify keys through the exact same
 * code, with no drift. (`rest` cannot import `runtime` — `runtime` depends on
 * `rest` — so the shared home must be a lower package both depend on: `core`.)
 *
 * This file preserves the historical `@objectstack/runtime` import surface.
 */

export {
  API_KEY_PREFIX,
  hashApiKey,
  generateApiKey,
  extractApiKey,
  parseScopes,
  isExpired,
  resolveApiKeyPrincipal,
  type GeneratedApiKey,
  type ApiKeyPrincipal,
} from '@objectstack/core';

// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0090 D5 (interim wiring, supersedes ADR-0056 D7) — resolve the
 * app-declared default permission-set NAME from a stack's `permissions[]`.
 *
 * A permission set marked `isDefault` declares the app's suggested default
 * access posture. Until the built-in `everyone` position lands (ADR-0090 P2),
 * the CLI keeps using this name as the runtime fallback for users with no
 * explicit grants; P2 replaces the fallback mechanism with an install-time
 * suggestion bound to `everyone`.
 *
 * Returns the first `isDefault` set's `name`, or `undefined` when none is
 * declared (callers then keep the built-in `member_default` fallback).
 */
export function appDefaultPermissionSetName(permissions: unknown): string | undefined {
  if (!Array.isArray(permissions)) return undefined;
  for (const p of permissions) {
    if (p && typeof p === 'object') {
      const ps = p as { name?: unknown; isDefault?: unknown };
      if (ps.isDefault === true && typeof ps.name === 'string' && ps.name.length > 0) {
        return ps.name;
      }
    }
  }
  return undefined;
}

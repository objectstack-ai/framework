// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0056 D7 — resolve the app-declared default profile NAME from a stack's
 * `permissions[]` array.
 *
 * A permission set marked `isProfile && isDefault` declares the app's default
 * access posture for users with no explicit grants. The {@link SecurityPlugin}
 * constructor scans its `defaultPermissionSets` option for that flag — but the
 * CLI constructs `new SecurityPlugin()` with NO options, so an `isDefault`
 * profile declared purely in app METADATA would never be honored. The CLI calls
 * this helper to pull the name out of the stack and pass it as
 * `fallbackPermissionSet`, wiring the declaration through to `pnpm dev`.
 *
 * Returns the first matching profile's `name`, or `undefined` when none is
 * declared (callers then keep the built-in `member_default` fallback).
 */
export function appDefaultProfileName(permissions: unknown): string | undefined {
  if (!Array.isArray(permissions)) return undefined;
  for (const p of permissions) {
    if (p && typeof p === 'object') {
      const ps = p as { name?: unknown; isProfile?: unknown; isDefault?: unknown };
      // `isProfile !== false` mirrors the stack convention where profiles double
      // as the user's baseline; permission-set add-ons set `isProfile: false`.
      if (
        ps.isDefault === true &&
        ps.isProfile !== false &&
        typeof ps.name === 'string' &&
        ps.name.length > 0
      ) {
        return ps.name;
      }
    }
  }
  return undefined;
}

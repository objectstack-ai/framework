// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Object-level API exposure gate (ADR-0049, #1889).
 *
 * Objects declare `apiEnabled` (default true) and an optional `apiMethods`
 * whitelist, but the HTTP/MCP data dispatch previously ignored both — an object
 * could not actually be hidden from the API, nor could its allowed operations
 * be restricted. This module decides, for a given data action, whether the
 * object's declared exposure permits it.
 *
 * Both fields are *additive restrictions* over a default-allow surface
 * (`apiEnabled` defaults true; absent `apiMethods` means "all operations").
 * Therefore an unresolvable object definition fails OPEN here — that matches
 * the schema defaults and avoids breaking traffic when metadata is briefly
 * unavailable. The gate is a no-op for system/internal contexts (callers pass
 * `isSystem` and skip this check entirely).
 */

/** The exposure-relevant slice of an object definition. */
export interface ObjectApiDef {
  apiEnabled?: boolean;
  apiMethods?: string[] | null;
}

export interface ApiExposureDecision {
  allowed: boolean;
  /** HTTP status to return when denied (404 hides, 405 = method not allowed). */
  status?: number;
  reason?: string;
}

/**
 * Map an internal `callData` action onto the spec `ApiMethod` vocabulary
 * (`object.zod.ts` → `ApiMethod`). Actions with no mapping are not gated by
 * `apiMethods` (they still respect `apiEnabled`).
 */
const ACTION_TO_API_METHOD: Record<string, string> = {
  create: 'create',
  get: 'get',
  update: 'update',
  delete: 'delete',
  query: 'list',
  find: 'list',
  batch: 'bulk',
};

export function checkApiExposure(def: ObjectApiDef | null | undefined, action: string): ApiExposureDecision {
  // Unresolvable definition → fall open to the schema defaults.
  if (!def) return { allowed: true };

  // `apiEnabled: false` hides the object from the API entirely → 404.
  if (def.apiEnabled === false) {
    return { allowed: false, status: 404, reason: 'object is not exposed via the API' };
  }

  // `apiMethods` whitelist (when present and non-empty) restricts operations.
  const whitelist = def.apiMethods;
  if (Array.isArray(whitelist) && whitelist.length > 0) {
    const method = ACTION_TO_API_METHOD[action];
    // Only gate actions that map to a known ApiMethod; unmapped actions pass.
    if (method && !whitelist.includes(method)) {
      return {
        allowed: false,
        status: 405,
        reason: `API operation '${method}' is not allowed for this object`,
      };
    }
  }

  return { allowed: true };
}

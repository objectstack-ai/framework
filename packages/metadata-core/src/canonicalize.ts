// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Canonicalization: convert a spec object into a stable JSON
 * representation suitable for content-addressable hashing.
 *
 * Guarantees:
 *
 * 1. **Key order independence.** Object keys are sorted lexicographically.
 *    `{a:1, b:2}` and `{b:2, a:1}` produce the same canonical form.
 * 2. **Whitespace independence.** No incidental whitespace.
 * 3. **Type preservation.** `undefined` properties are dropped (matching
 *    JSON.stringify), `null` is preserved, arrays preserve order.
 * 4. **Number normalisation.** Numbers serialised via `Number.prototype
 *    .toString` (the JSON default). NaN/Infinity are rejected because
 *    they cannot survive a JSON round trip.
 * 5. **Idempotence.** `canonicalize(canonicalize(x))` === `canonicalize(x)`.
 * 6. **Pure.** No side-effects, no mutation of input.
 *
 * Non-goals (deliberately not supported):
 *
 * - Functions, symbols, class instances. These have no canonical JSON
 *   form. Callers must serialise out-of-band (e.g. for formula fields,
 *   use the CEL string, not the compiled function).
 * - BigInt. Rejected because there is no agreed-upon JSON representation.
 */

import { createHash } from 'node:crypto';

/** Stable JSON serialisation. See module-level doc for guarantees. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(normalise(value));
}

/** Convert a value into a canonical, JSON-serialisable form. */
function normalise(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'undefined') return undefined; // caller-dropped
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('canonicalize: NaN/Infinity not representable as JSON');
    }
    return value;
  }
  if (typeof value === 'bigint') {
    throw new Error('canonicalize: BigInt not supported');
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`canonicalize: ${typeof value} cannot be serialised`);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.map(normalise);
  }

  // Plain object: sort keys, drop undefineds.
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const k of keys) {
      const v = normalise(obj[k]);
      if (typeof v === 'undefined') continue;
      out[k] = v;
    }
    return out;
  }

  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}

/**
 * Compute the canonical sha256 hash of a spec, returned as
 * `"sha256:<64-hex>"`. Equal hashes imply equal canonical forms.
 */
export function hashSpec(value: unknown): string {
  const json = canonicalize(value);
  const digest = createHash('sha256').update(json, 'utf8').digest('hex');
  return `sha256:${digest}`;
}

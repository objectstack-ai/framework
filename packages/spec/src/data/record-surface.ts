// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Record-surface derivation — the single source for *how* an object's
 * create / edit / detail record opens by DEFAULT: a full page, or an overlay
 * (drawer / modal). ADR-0085 §5 "one shared derivation, every surface".
 *
 * Why this is a derivation and NOT an authored object key
 * ------------------------------------------------------
 * ADR-0085 §2's admission test rejects per-surface presentation toggles on the
 * object: modal-vs-page is not a business fact a machine cannot infer — it is
 * exactly inferable from how heavy the record is. So the platform derives a
 * sensible default here (field-heavy → full page; otherwise a side drawer),
 * and AI authors write nothing in the common case. Explicit control, when a
 * specific object genuinely needs it, is the sanctioned per-page path: an
 * assigned page. The renderer therefore uses this ONLY as the default and lets
 * an explicit form/navigation config win.
 *
 * The rule is deliberately simple and predictable (a single field-count
 * threshold + a mobile override) because an unpredictable heuristic is its own
 * kind of "silently wrong" for an AI-authored system.
 *
 * Pure and dependency-free, tolerant of bare/un-parsed metadata records (same
 * contract as {@link deriveFieldGroupLayout}) so every consumer can call it.
 */

import { FIELD_GROUP_SYSTEM_FIELDS } from './field-group-layout';

/** The presentation surface a record's create/edit/detail opens on. */
export type RecordSurface = 'page' | 'modal' | 'drawer';

/** Viewport hint; overlays are cramped on phones, so mobile always pages. */
export type RecordSurfaceViewport = 'mobile' | 'desktop';

export interface RecordSurfaceOptions {
  /** Viewport hint. `'mobile'` forces `'page'` (overlays are cramped). */
  viewport?: RecordSurfaceViewport;
  /**
   * Authorable-field count at/above which the record opens as a full page.
   * Defaults to {@link RECORD_SURFACE_PAGE_THRESHOLD}. Exposed so a host can
   * tune the break point without forking the rule.
   */
  pageThreshold?: number;
}

/**
 * Default break point: at/above this many authorable (visible, non-system)
 * fields, a record is "heavy" enough to warrant a full page rather than an
 * overlay. ~12 fields overflow a comfortable two-column modal; beyond it a
 * page (with its own URL, scroll and back button) reads better.
 */
export const RECORD_SURFACE_PAGE_THRESHOLD = 12;

type AnyRec = Record<string, unknown>;

/**
 * Count the fields a user actually fills on a form: visible (not `hidden`) and
 * not an audit/system field. Mirrors the visibility rules of the field-group
 * layout so the two derivations agree on what "the fields" are.
 */
export function countAuthorableFields(def: unknown): number {
  if (!def || typeof def !== 'object' || Array.isArray(def)) return 0;
  const fields = (def as AnyRec).fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return 0;
  let n = 0;
  for (const [name, f] of Object.entries(fields as Record<string, AnyRec | undefined>)) {
    if (f?.hidden === true) continue;
    if (FIELD_GROUP_SYSTEM_FIELDS.has(name)) continue;
    n++;
  }
  return n;
}

/**
 * Derive the DEFAULT record surface for an object definition (or any bare
 * metadata record shaped like one).
 *
 * Rule:
 *   - `viewport: 'mobile'` → `'page'` (overlays are cramped on phones);
 *   - authorable field count ≥ threshold → `'page'` (field-heavy);
 *   - otherwise → `'drawer'` (a light side overlay — the historical default).
 *
 * `'modal'` is never emitted by the heuristic; it remains in the return type
 * because an explicit form config can still select it and consumers switch on
 * the full set. Renderers must treat this as a default only — an explicit
 * `formType` / `navigation.mode` wins.
 */
export function deriveRecordSurface(def: unknown, opts: RecordSurfaceOptions = {}): RecordSurface {
  if (opts.viewport === 'mobile') return 'page';
  const threshold = opts.pageThreshold ?? RECORD_SURFACE_PAGE_THRESHOLD;
  if (countAuthorableFields(def) >= threshold) return 'page';
  return 'drawer';
}

// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Build-time form-layout diagnostics (#2578).
 *
 * Authored form views carry field references and column-layout hints that are
 * Zod-valid but can be silently wrong at render time — the "parsed, unmarked,
 * silently inert" shape ADR-0078 prohibits. This lint catches the two that
 * matter for multi-column, AI-authored forms, uniformly for `os build` /
 * `os validate`, MCP authoring and hand authors (ADR-0019).
 *
 * Both rules are warnings, not errors — nothing is fully broken (an unknown
 * field name is skipped; an over-wide colSpan is clamped) — but each is almost
 * certainly an authoring mistake worth surfacing at author time:
 *
 * - `form-field-unknown` — a section references a field that is not on the
 *   form's bound object, so the field silently does not render.
 * - `absolute-colspan-discouraged` — a field uses the absolute `colSpan`. Under
 *   a per-surface DERIVED column count (mobile 1 / modal 2 / page 3-4) a fixed
 *   span only lines up at the one width the author imagined; the renderer
 *   clamps it. The robust primitive is the relative `span: 'full'`.
 *
 * Scope: top-level form `views` (a `sections` array). Forms embedded inside
 * page component trees are a follow-up — the walker deliberately stays shallow
 * so it never guesses at an arbitrary component's object binding.
 */

export const FORM_FIELD_UNKNOWN = 'form-field-unknown';
export const FORM_COLSPAN_ABSOLUTE = 'absolute-colspan-discouraged';

export type FormLayoutSeverity = 'error' | 'warning';

export interface FormLayoutFinding {
  /** Always `warning` today — both rules are advisory (see module note). */
  severity: FormLayoutSeverity;
  /** Diagnostic rule id, e.g. `form-field-unknown`. */
  rule: string;
  /** Human-readable location, e.g. `view "contract_form"`. */
  where: string;
  /** Config path, e.g. `views[2].sections[0].fields[3]`. */
  path: string;
  /** What is wrong. */
  message: string;
  /** How to fix it. */
  hint: string;
}

type AnyRec = Record<string, unknown>;

/** Coerce a collection (array or name-keyed map) to an array of records. */
function asArray(v: unknown): AnyRec[] {
  if (Array.isArray(v)) return v as AnyRec[];
  if (v && typeof v === 'object') {
    return Object.entries(v as AnyRec).map(([name, def]) => ({ name, ...(def as AnyRec) }));
  }
  return [];
}

/** A section field entry is either a bare field name or `{ field, colSpan, … }`. */
function fieldNameOf(entry: unknown): string | null {
  if (typeof entry === 'string') return entry.length > 0 ? entry : null;
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const f = (entry as AnyRec).field;
    return typeof f === 'string' && f.length > 0 ? f : null;
  }
  return null;
}

/** The object a form view binds to: `data.object` (canonical) or `objectName`. */
function boundObject(view: AnyRec): string | undefined {
  const data = view.data;
  if (data && typeof data === 'object' && typeof (data as AnyRec).object === 'string') {
    return (data as AnyRec).object as string;
  }
  return typeof view.objectName === 'string' ? (view.objectName as string) : undefined;
}

/**
 * Validate authored form-view layout. Returns findings (empty = clean).
 * Advisory only — the caller must never fail the build on these alone.
 */
export function validateFormLayout(stack: AnyRec): FormLayoutFinding[] {
  const findings: FormLayoutFinding[] = [];

  // object name → its field-name set, for reference checking.
  const objectFields = new Map<string, Set<string>>();
  for (const obj of asArray(stack.objects)) {
    const name = typeof obj.name === 'string' ? obj.name : undefined;
    if (!name) continue;
    const fields = (obj.fields && typeof obj.fields === 'object' && !Array.isArray(obj.fields))
      ? Object.keys(obj.fields as AnyRec)
      : [];
    objectFields.set(name, new Set(fields));
  }

  const views = asArray(stack.views);
  for (let i = 0; i < views.length; i++) {
    const view = views[i];
    if (!view || typeof view !== 'object') continue;
    const sections = Array.isArray(view.sections) ? view.sections : null;
    if (!sections) continue; // only form views carry a sections array

    const viewName = typeof view.name === 'string' ? view.name : `(view ${i})`;
    const objName = boundObject(view);
    // Only reference-check when the bound object resolves; otherwise we can't.
    const known = objName ? objectFields.get(objName) : undefined;
    const where = `view "${viewName}"`;
    const base = `views[${i}]`;

    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s];
      const secFields = sec && typeof sec === 'object' && Array.isArray((sec as AnyRec).fields)
        ? ((sec as AnyRec).fields as unknown[])
        : [];
      for (let f = 0; f < secFields.length; f++) {
        const entry = secFields[f];
        const fname = fieldNameOf(entry);
        const fpath = `${base}.sections[${s}].fields[${f}]`;

        // ── (a) section field references a real field on the bound object ──
        if (fname && known && !known.has(fname)) {
          findings.push({
            severity: 'warning',
            rule: FORM_FIELD_UNKNOWN,
            where,
            path: fpath,
            message:
              `${viewName}: field "${fname}" is not a field on object "${objName}" — ` +
              `it is silently skipped and never renders on the form`,
            hint:
              `Fix the field name, or add "${fname}" to ${objName}. Section field ` +
              `references must match the object's field names exactly.`,
          });
        }

        // ── (b) absolute colSpan → steer to the surface-independent span ──
        const colSpan = entry && typeof entry === 'object' && !Array.isArray(entry)
          ? (entry as AnyRec).colSpan
          : undefined;
        if (colSpan != null) {
          findings.push({
            severity: 'warning',
            rule: FORM_COLSPAN_ABSOLUTE,
            where,
            path: `${fpath}.colSpan`,
            message:
              `${viewName}: field "${fname ?? '?'}" sets absolute colSpan ${String(colSpan)} — ` +
              `the form's column count is derived per surface (mobile 1 / modal 2 / page 3-4), ` +
              `so a fixed span only aligns at one width`,
            hint:
              `Prefer span: 'full' (whole row at any column count), or omit for auto ` +
              `width. The renderer clamps colSpan to the current column count.`,
          });
        }
      }
    }
  }

  return findings;
}

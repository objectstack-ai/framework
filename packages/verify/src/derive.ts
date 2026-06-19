// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Metadata-driven proof derivation.
//
// The platform's apps are 100% declarative metadata, so a baseline runtime
// contract can be DERIVED from the metadata itself — no hand-written tests. This
// is the seed of `objectstack verify`: point it at any app (a framework example
// OR a third-party app like hotcrm) and it auto-generates "author this object →
// write it → read it back → assert type fidelity" for every object, then runs
// it against the real in-process stack.
//
// v0 derives per-object CRUD round-trip cases. RLS cross-owner denial (the
// #1994 invariant) is v1 — it needs the multi-user harness + sharing service.

/* eslint-disable @typescript-eslint/no-explicit-any */

const COMPUTED = new Set(['formula', 'summary', 'autonumber', 'rollup', 'vector']);
const RELATIONAL = new Set(['lookup', 'master_detail', 'master-detail', 'masterdetail', 'tree']);
const STRUCTURED = new Set(['composite', 'repeater', 'record', 'location', 'address']);
const MEDIA = new Set(['image', 'file', 'avatar', 'video', 'audio', 'signature', 'qrcode']);
const SYSTEM_NAMES = new Set([
  'id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'owner',
  'space', 'instance_state', 'record_id', 'is_deleted',
]);

export type AssertKind = 'equal' | 'set' | 'none';
export interface DerivedAssert {
  field: string;
  type: string;
  value: unknown;
  kind: AssertKind;
}
export interface CrudCase {
  object: string;
  blocked?: string; // why this object can't be auto-CRUD'd (e.g. required lookup)
  body?: Record<string, unknown>;
  asserts?: DerivedAssert[];
  skippedFields?: Array<{ name: string; type: string; reason: string }>;
}

function clampNum(f: any, fallback: number): number {
  const { min, max, step } = f;
  let v = fallback;
  if (typeof min === 'number' && v < min) v = min;
  if (typeof max === 'number' && v > max) v = max;
  if (typeof step === 'number' && typeof min === 'number') {
    v = min + step * Math.round((v - min) / step);
  }
  return v;
}

/** Synthesize a valid value for a field type, or null if not synthesizable. */
function synth(type: string, f: any): { value: unknown; kind: AssertKind } | null {
  switch (type) {
    case 'text': case 'textarea': case 'string':
    case 'markdown': case 'html': case 'richtext': case 'code':
      return { value: 'verify-sample', kind: 'equal' };
    case 'email': return { value: 'verify@example.com', kind: 'equal' };
    case 'url': return { value: 'https://example.com', kind: 'equal' };
    case 'phone': return { value: '+14155550100', kind: 'equal' };
    case 'color': return { value: '#3366CC', kind: 'equal' };
    case 'number': return { value: clampNum(f, 7), kind: 'equal' };
    case 'currency': return { value: clampNum(f, 100), kind: 'equal' };
    case 'percent': return { value: clampNum(f, 50), kind: 'equal' };
    case 'rating': return { value: clampNum(f, Math.min(3, f.max ?? 5)), kind: 'equal' };
    case 'slider': case 'progress': return { value: clampNum(f, 25), kind: 'equal' };
    case 'boolean': case 'toggle': return { value: true, kind: 'equal' };
    case 'date': return { value: '2024-03-15', kind: 'equal' };
    case 'datetime': return { value: '2024-03-15T08:30:00.000Z', kind: 'equal' };
    case 'time': return { value: '14:30:00', kind: 'equal' };
    case 'json': return { value: { sample: true }, kind: 'equal' };
    case 'select': case 'radio': {
      const opt = f.options?.[0]?.value;
      return opt != null ? { value: opt, kind: 'equal' } : null;
    }
    case 'multiselect': case 'checkboxes': {
      const opt = f.options?.[0]?.value;
      return opt != null ? { value: [opt], kind: 'set' } : null;
    }
    case 'tags': return { value: ['alpha', 'beta'], kind: 'set' };
    // Opaque-on-read: write a value but don't assert a round-trip (hashed/encrypted).
    case 'password': case 'secret': return { value: 'Sample-Secret-123', kind: 'none' };
    default: return null;
  }
}

/**
 * Derive one CRUD round-trip case per authorable object in the config.
 * An object whose REQUIRED fields can't be synthesized (e.g. a required lookup
 * needing a target record) is reported `blocked` rather than silently skipped.
 */
export function deriveCrudCases(config: any): CrudCase[] {
  const cases: CrudCase[] = [];
  for (const obj of config?.objects ?? []) {
    const fields: Record<string, any> = obj?.fields ?? {};
    const body: Record<string, unknown> = {};
    const asserts: DerivedAssert[] = [];
    const skippedFields: Array<{ name: string; type: string; reason: string }> = [];
    let blocked: string | undefined;

    for (const [name, f] of Object.entries(fields)) {
      const type = String((f as any)?.type ?? '').toLowerCase();
      if (SYSTEM_NAMES.has(name) || (f as any)?.system || (f as any)?.readonly) continue;
      if (COMPUTED.has(type)) continue;

      if (RELATIONAL.has(type) || STRUCTURED.has(type) || MEDIA.has(type)) {
        if ((f as any)?.required) { blocked = `required ${type} field "${name}" (needs target/structured value)`; break; }
        skippedFields.push({ name, type, reason: 'unsynthesizable-optional' });
        continue;
      }

      const s = synth(type, f);
      if (!s) {
        if ((f as any)?.required) { blocked = `required field "${name}" of type "${type}" is not synthesizable`; break; }
        skippedFields.push({ name, type, reason: 'no-synth' });
        continue;
      }
      body[name] = s.value;
      if (s.kind !== 'none') asserts.push({ field: name, type, value: s.value, kind: s.kind });
    }

    // Every object needs a name-ish required text; synth already covers `name`.
    if (blocked) cases.push({ object: obj.name, blocked });
    else cases.push({ object: obj.name, body, asserts, skippedFields });
  }
  return cases;
}

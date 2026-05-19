// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SharingCriteriaBuilder — visual editor for sys_sharing_rule.criteria_json.
 *
 * Sharing rules use ObjectQL's native filter shape:
 *   `{ field1: { $op: value }, field2: value, ... }` (AND-combined).
 *
 * The builder renders an array of `{field, op, value}` rows that
 * round-trip to that shape. Multiple conditions on the same field are
 * supported and merge into `{ field: { $gte: 100, $lte: 1000 } }`.
 *
 * Empty rows ⇒ "match all" (criteria_json = '' on disk).
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

export interface SharingCriteriaBuilderProps {
  /** Short object name whose fields are being filtered (e.g. "opportunity"). */
  objectName: string | undefined | null;
  /** Current criteria_json value (JSON string of `{field:{$op:value}}` or ''). */
  value: string;
  /** Returns the new JSON string (or '' for no criteria). */
  onChange: (next: string) => void;
  /** Client with `meta.getItem('object', name)` — passed in to avoid re-import. */
  client: any;
  /** Optional row id seed (test only). */
  testIdSeed?: number;
}

interface FieldDef {
  name: string;
  label: string;
  type: string;
}

interface Row {
  rid: string;
  field: string;
  op: Operator;
  value: string;
}

const OPERATORS = [
  { op: '$eq', label: 'equals', valueRequired: true },
  { op: '$ne', label: 'not equals', valueRequired: true },
  { op: '$gt', label: '>', valueRequired: true, numericish: true },
  { op: '$gte', label: '>=', valueRequired: true, numericish: true },
  { op: '$lt', label: '<', valueRequired: true, numericish: true },
  { op: '$lte', label: '<=', valueRequired: true, numericish: true },
  { op: '$contains', label: 'contains', valueRequired: true, textish: true },
  { op: '$notContains', label: 'not contains', valueRequired: true, textish: true },
  { op: '$in', label: 'in (comma-sep)', valueRequired: true, multi: true },
  { op: '$nin', label: 'not in (comma-sep)', valueRequired: true, multi: true },
  { op: '$null', label: 'is empty', valueRequired: false },
  { op: '$notNull', label: 'is not empty', valueRequired: false },
] as const;
type Operator = (typeof OPERATORS)[number]['op'];

const NUMERIC_TYPES = new Set(['number', 'integer', 'currency', 'percent']);

// ─── Helpers ────────────────────────────────────────────────────────

let _ridSeed = 0;
function newRid(): string { return `_r${++_ridSeed}_${Date.now().toString(36)}`; }

/** Parse criteria JSON string into editable rows. */
function parseValue(raw: string): { rows: Row[]; parseError: string | null } {
  if (!raw || !raw.trim()) return { rows: [], parseError: null };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { rows: [], parseError: 'Top-level criteria must be an object' };
    }
    const rows: Row[] = [];
    for (const [field, expr] of Object.entries(parsed)) {
      if (field.startsWith('$')) {
        // $and/$or — not modelled in v1 builder; surface as parse error so
        // user opens a future advanced editor or fixes by hand.
        return { rows: [], parseError: `Unsupported top-level operator: ${field}` };
      }
      if (expr === null || typeof expr !== 'object' || Array.isArray(expr)) {
        // shorthand: { field: literal } ⇒ $eq
        rows.push({ rid: newRid(), field, op: '$eq', value: scalarToString(expr) });
        continue;
      }
      for (const [op, val] of Object.entries(expr as Record<string, unknown>)) {
        if (!OPERATORS.some((o) => o.op === op)) {
          return { rows: [], parseError: `Unsupported operator: ${op}` };
        }
        let strVal = '';
        if (op === '$in' || op === '$nin') {
          strVal = Array.isArray(val) ? val.map(String).join(', ') : String(val ?? '');
        } else if (op === '$null' || op === '$notNull') {
          strVal = '';
        } else {
          strVal = scalarToString(val);
        }
        rows.push({ rid: newRid(), field, op: op as Operator, value: strVal });
      }
    }
    return { rows, parseError: null };
  } catch (err: any) {
    return { rows: [], parseError: `Invalid JSON: ${err?.message ?? String(err)}` };
  }
}

function scalarToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function coerceValue(raw: string, op: Operator, fieldType: string): unknown {
  if (op === '$null') return null;
  if (op === '$notNull') return null;
  if (op === '$in' || op === '$nin') {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.map((p) => coerceScalar(p, fieldType));
  }
  return coerceScalar(raw, fieldType);
}

function coerceScalar(raw: string, fieldType: string): unknown {
  if (raw === '') return '';
  if (fieldType === 'boolean') {
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return raw;
  }
  if (NUMERIC_TYPES.has(fieldType)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

/** Serialize rows back to ObjectQL filter shape. */
function rowsToJson(rows: Row[], fields: Record<string, FieldDef>): string {
  // Filter incomplete rows. Keep $null/$notNull (no value required).
  const valid = rows.filter((r) => {
    if (!r.field) return false;
    const opDef = OPERATORS.find((o) => o.op === r.op);
    if (!opDef) return false;
    if (!opDef.valueRequired) return true;
    return r.value !== '';
  });
  if (valid.length === 0) return '';

  const out: Record<string, any> = {};
  for (const r of valid) {
    const fdef = fields[r.field];
    const ftype = fdef?.type ?? 'text';
    let exprValue: unknown;
    if (r.op === '$null') exprValue = null;
    else if (r.op === '$notNull') exprValue = null;
    else exprValue = coerceValue(r.value, r.op, ftype);

    // Map $null/$notNull to ObjectQL primitives. ObjectQL treats `field: null`
    // as "is null" and `{$ne: null}` as "is not null".
    if (r.op === '$null') {
      out[r.field] = null;
      continue;
    }
    if (r.op === '$notNull') {
      out[r.field] = { $ne: null };
      continue;
    }

    if (out[r.field] && typeof out[r.field] === 'object' && !Array.isArray(out[r.field])) {
      out[r.field][r.op] = exprValue;
    } else {
      out[r.field] = { [r.op]: exprValue };
    }
  }
  return JSON.stringify(out);
}

// ─── Component ──────────────────────────────────────────────────────

export function SharingCriteriaBuilder(props: SharingCriteriaBuilderProps) {
  const { objectName, value, onChange, client } = props;
  const initial = useMemo(() => parseValue(value), [value]);
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const [parseError, setParseError] = useState<string | null>(initial.parseError);
  const [fields, setFields] = useState<Record<string, FieldDef>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load target object's fields whenever objectName changes.
  useEffect(() => {
    let mounted = true;
    setFields({});
    setLoadError(null);
    if (!objectName) return;
    setLoading(true);
    (async () => {
      try {
        const found: any = await client.meta.getItem('object', objectName);
        if (!mounted) return;
        const resolved = found?.item ?? found ?? {};
        const raw = resolved?.fields ?? {};
        const map: Record<string, FieldDef> = {};
        for (const [k, f] of Object.entries(raw as Record<string, any>)) {
          map[k] = {
            name: k,
            label: f?.label || k,
            type: f?.type || 'text',
          };
        }
        setFields(map);
      } catch (err: any) {
        if (mounted) setLoadError(err?.message ?? String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [client, objectName]);

  // Push changes upstream whenever rows mutate.
  const updateRows = (next: Row[]) => {
    setRows(next);
    setParseError(null);
    onChange(rowsToJson(next, fields));
  };

  const addRow = () => {
    const firstField = Object.keys(fields)[0] ?? '';
    updateRows([
      ...rows,
      { rid: newRid(), field: firstField, op: '$eq', value: '' },
    ]);
  };

  const updateRow = (rid: string, patch: Partial<Row>) => {
    updateRows(rows.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  };

  const removeRow = (rid: string) => {
    updateRows(rows.filter((r) => r.rid !== rid));
  };

  if (!objectName) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Select an <strong>Object</strong> first to start building criteria.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      {parseError && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Existing criteria is too advanced for the builder.</div>
            <div className="opacity-80">{parseError}</div>
            <div className="opacity-80">Edit by clearing and rebuilding, or save raw JSON via the API.</div>
          </div>
        </div>
      )}
      {loadError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Could not load object fields: {loadError}
        </div>
      )}
      {loading && (
        <div className="text-xs text-muted-foreground">Loading fields for {objectName}…</div>
      )}

      {rows.length === 0 ? (
        <div className="py-3 text-center text-xs text-muted-foreground">
          No conditions — rule matches <strong>every record</strong> of <code className="text-[11px]">{objectName}</code>.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => {
            const opDef = OPERATORS.find((o) => o.op === row.op);
            const showValueInput = opDef?.valueRequired !== false;
            return (
              <div key={row.rid} className="flex items-start gap-2">
                <div className="w-12 shrink-0 pt-2 text-[10px] uppercase text-muted-foreground">
                  {idx === 0 ? 'WHERE' : 'AND'}
                </div>
                <div className="flex-1">
                  <Select
                    value={row.field}
                    onValueChange={(v) => updateRow(row.rid, { field: v, value: '' })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="field…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(fields).map((f) => (
                        <SelectItem key={f.name} value={f.name} className="text-xs">
                          {f.label} <span className="opacity-50 ml-1">({f.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40 shrink-0">
                  <Select
                    value={row.op}
                    onValueChange={(v) => updateRow(row.rid, { op: v as Operator })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((o) => (
                        <SelectItem key={o.op} value={o.op} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  {showValueInput ? (
                    <Input
                      className="h-8 text-xs"
                      value={row.value}
                      placeholder={row.op === '$in' || row.op === '$nin' ? 'a, b, c' : 'value'}
                      onChange={(e) => updateRow(row.rid, { value: e.target.value })}
                    />
                  ) : (
                    <Input className="h-8 text-xs" value="" disabled placeholder="—" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => removeRow(row.rid)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={addRow}
          disabled={Object.keys(fields).length === 0}
        >
          <Plus className="h-3.5 w-3.5" /> Add condition
        </Button>
        <div className="text-[10px] text-muted-foreground">
          ObjectQL filter (AND-combined)
        </div>
      </div>
    </div>
  );
}

// Exposed for unit tests.
export const __internal = { parseValue, rowsToJson, coerceValue };

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Filter Normalization for the Analytics Layer
 *
 * The analytics endpoint accepts filters in two equivalent shapes:
 *
 *   1. Cube-style array: `[{ member, operator, values: string[] }]`
 *   2. MongoDB-style FilterCondition: `{ field: value }` /
 *      `{ field: { $op: value } }` / `{ $and: [...] }`  — the
 *      canonical filter grammar defined in `spec/data/filter.zod.ts`
 *      and used elsewhere in the spec (find queries, dashboard widget
 *      `filter`, etc.).
 *
 * `normalizeAnalyticsFilters` flattens either shape into the cube-style
 * array used internally by the SQL/Mongo pipeline strategies. Strategies
 * stay simple — they only need to know one filter shape — and the spec
 * is honoured: dashboard metadata is authored once in the canonical
 * MongoDB form and the server normalizes at the boundary.
 */

export interface NormalizedAnalyticsFilter {
  member: string;
  operator: string;
  values: string[];
}

const MONGO_TO_CUBE_OP: Record<string, string> = {
  $eq: 'equals',
  $ne: 'notEquals',
  $gt: 'gt',
  $gte: 'gte',
  $lt: 'lt',
  $lte: 'lte',
  $in: 'in',
  $nin: 'notIn',
  $contains: 'contains',
  $notContains: 'notContains',
  $exists: 'set',
};

/** Stringify a filter value as the cube spec requires `values: string[]`. */
function stringifyForCube(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function flattenCondition(cond: Record<string, unknown>, out: NormalizedAnalyticsFilter[]): void {
  for (const [key, raw] of Object.entries(cond)) {
    if (raw === undefined) continue;

    if (key === '$and' && Array.isArray(raw)) {
      for (const sub of raw) {
        if (sub && typeof sub === 'object') {
          flattenCondition(sub as Record<string, unknown>, out);
        }
      }
      continue;
    }
    // Logical $or / $not require recursive WHERE building which the
    // current strategies don't yet support; ignore so partial queries
    // still run.
    if (key === '$or' || key === '$not') continue;

    if (raw === null) {
      out.push({ member: key, operator: 'notSet', values: [] });
      continue;
    }

    if (typeof raw === 'object' && !Array.isArray(raw) && !(raw instanceof Date)) {
      const wrapper = raw as Record<string, unknown>;
      const opKeys = Object.keys(wrapper).filter(k => k.startsWith('$'));
      if (opKeys.length > 0) {
        for (const opKey of opKeys) {
          const cubeOp = MONGO_TO_CUBE_OP[opKey];
          if (!cubeOp) continue;
          const v = wrapper[opKey];
          const values = Array.isArray(v)
            ? v.map(stringifyForCube)
            : [stringifyForCube(v)];
          out.push({ member: key, operator: cubeOp, values });
        }
        continue;
      }
      // Nested relation (e.g. {profile: {verified: true}}). Flatten with
      // dot-prefixed keys so cube field path resolution still works.
      for (const [nestedKey, nestedVal] of Object.entries(wrapper)) {
        flattenCondition({ [`${key}.${nestedKey}`]: nestedVal }, out);
      }
      continue;
    }

    // Implicit equality / array → in
    if (Array.isArray(raw)) {
      out.push({ member: key, operator: 'in', values: raw.map(stringifyForCube) });
    } else {
      out.push({ member: key, operator: 'equals', values: [stringifyForCube(raw)] });
    }
  }
}

/**
 * Normalize an analytics query's filters into a uniform cube-style array.
 *
 * Reads BOTH the canonical `where` (FilterCondition per spec/data/
 * filter.zod.ts) AND the legacy `filters` (cube-style array) fields,
 * combining them with logical AND. New code should use `where`; the
 * legacy `filters` shape is kept for backward compatibility.
 */
export function normalizeAnalyticsFilters(query: { where?: unknown; filters?: unknown } | unknown): NormalizedAnalyticsFilter[] {
  if (!query || typeof query !== 'object') return [];

  const out: NormalizedAnalyticsFilter[] = [];
  const q = query as { where?: unknown; filters?: unknown };

  // Canonical: `where` is FilterConditionSchema (MongoDB-style).
  if (q.where && typeof q.where === 'object' && !Array.isArray(q.where)) {
    flattenCondition(q.where as Record<string, unknown>, out);
  }

  // Legacy cube-style array of {member, operator, values}.
  if (Array.isArray(q.filters)) {
    for (const f of q.filters) {
      if (!f || typeof f !== 'object') continue;
      const entry = f as { member?: string; operator?: string; values?: unknown };
      if (!entry.member || !entry.operator) continue;
      const values = Array.isArray(entry.values)
        ? (entry.values as unknown[]).map(v => String(v))
        : entry.values != null ? [String(entry.values)] : [];
      out.push({ member: entry.member, operator: entry.operator, values });
    }
  } else if (q.filters && typeof q.filters === 'object' && !Array.isArray(q.filters)) {
    // Tolerate legacy callers that placed a FilterCondition object in
    // `filters` (the previous transitional spec briefly allowed this).
    flattenCondition(q.filters as Record<string, unknown>, out);
  }

  return out;
}

/**
 * Coerce a stringified filter value back into a runtime type for SQL
 * parameter binding. Better-sqlite3 (and most drivers) bind JS
 * booleans/numbers as their native SQL types, so we recover them here
 * to avoid string-vs-number mismatches against typed columns.
 */
export function coerceFilterValueForSql(s: string): unknown {
  if (s === 'true') return 1;
  if (s === 'false') return 0;
  if (s === 'null') return null;
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return s;
}

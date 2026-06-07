// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { FilterCondition } from '@objectstack/spec/data';

/**
 * Compile an RLS / tenant read-scope `FilterCondition` into a parameterized,
 * alias-qualified SQL predicate (ADR-0021 D-C).
 *
 * This is the single, security-critical translation point between the
 * canonical Mongo-style filter the `RLSCompiler` emits and the raw SQL the
 * analytics `NativeSQLStrategy` runs. It is deliberately:
 *
 *   - **Fail-closed.** Any operator, value shape, or identifier it cannot
 *     translate THROWS. A read-scope predicate must never be silently dropped —
 *     dropping it would run the query unscoped and leak cross-tenant data.
 *   - **Injection-safe.** Field/alias identifiers are validated against a strict
 *     snake_case pattern and every value is bound as a `?` placeholder (the
 *     strategy renumbers `?` → `$N`). No value is ever interpolated into SQL.
 *   - **Alias-qualified.** Bare fields become `"alias"."field"` so the same
 *     predicate applies to the base table or any joined table.
 *
 * Supports the operators the RLS layer and common policies emit: implicit
 * equality, `$eq/$ne/$gt/$gte/$lt/$lte/$in/$nin/$between/$contains/$notContains/
 * $startsWith/$endsWith/$null/$exists`, and `$and/$or/$not` combinators.
 */

const IDENT = /^[a-z_][a-z0-9_]*$/i;

function quoteIdent(name: string, kind: string): string {
  if (typeof name !== 'string' || !IDENT.test(name)) {
    throw new Error(`[read-scope-sql] unsafe ${kind} identifier "${String(name)}" — refusing to build read scope (fail-closed).`);
  }
  return `"${name}"`;
}

export function compileScopedFilterToSql(
  filter: FilterCondition,
  alias: string,
): { sql: string; params: unknown[] } {
  const quotedAlias = quoteIdent(alias, 'alias');
  const params: unknown[] = [];
  const sql = compileNode(filter, quotedAlias, params);
  return { sql, params };
}

/** Compile a filter node into a boolean SQL expression ('' = empty/no constraint). */
function compileNode(node: unknown, qAlias: string, params: unknown[]): string {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error('[read-scope-sql] read scope must be a filter object (fail-closed).');
  }
  const clauses: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === '$and' || key === '$or') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`[read-scope-sql] "${key}" requires a non-empty array (fail-closed).`);
      }
      const parts = (value as unknown[])
        .map((child) => compileNode(child, qAlias, params))
        .filter((s) => s.length > 0);
      if (parts.length === 0) continue;
      const joiner = key === '$and' ? ' AND ' : ' OR ';
      clauses.push(`(${parts.join(joiner)})`);
    } else if (key === '$not') {
      const inner = compileNode(value, qAlias, params);
      if (inner) clauses.push(`NOT (${inner})`);
    } else if (key.startsWith('$')) {
      throw new Error(`[read-scope-sql] unsupported top-level operator "${key}" (fail-closed).`);
    } else {
      clauses.push(compileField(key, value, qAlias, params));
    }
  }
  return clauses.join(' AND ');
}

/** Compile a single `field: value | { $op: ... }` entry. */
function compileField(field: string, value: unknown, qAlias: string, params: unknown[]): string {
  const col = `${qAlias}.${quoteIdent(field, 'field')}`;

  // Scalar / null → implicit equality.
  if (value === null) return `${col} IS NULL`;
  if (typeof value !== 'object' || value instanceof Date) {
    params.push(value);
    return `${col} = ?`;
  }
  if (Array.isArray(value)) {
    throw new Error(`[read-scope-sql] bare array value for "${field}" — use { $in: [...] } (fail-closed).`);
  }

  const ops = value as Record<string, unknown>;
  const keys = Object.keys(ops);
  // A value object must be ALL operators; a non-$ key means a nested relation,
  // which a flat read scope cannot join — fail closed.
  if (keys.length === 0 || keys.some((k) => !k.startsWith('$'))) {
    throw new Error(`[read-scope-sql] "${field}" has a nested/relation value which is not supported in a read scope (fail-closed).`);
  }

  const parts: string[] = [];
  for (const op of keys) {
    parts.push(compileOperator(col, op, ops[op], field, params));
  }
  return parts.length === 1 ? parts[0] : `(${parts.join(' AND ')})`;
}

function bind(params: unknown[], v: unknown): string {
  params.push(v);
  return '?';
}

function compileOperator(col: string, op: string, val: unknown, field: string, params: unknown[]): string {
  switch (op) {
    case '$eq': return val === null ? `${col} IS NULL` : `${col} = ${bind(params, val)}`;
    case '$ne': return val === null ? `${col} IS NOT NULL` : `${col} <> ${bind(params, val)}`;
    case '$gt': return `${col} > ${bind(params, val)}`;
    case '$gte': return `${col} >= ${bind(params, val)}`;
    case '$lt': return `${col} < ${bind(params, val)}`;
    case '$lte': return `${col} <= ${bind(params, val)}`;
    case '$in': {
      if (!Array.isArray(val)) throw new Error(`[read-scope-sql] $in for "${field}" needs an array (fail-closed).`);
      if (val.length === 0) return '1 = 0'; // IN () matches nothing — safe
      return `${col} IN (${val.map((v) => bind(params, v)).join(', ')})`;
    }
    case '$nin': {
      if (!Array.isArray(val)) throw new Error(`[read-scope-sql] $nin for "${field}" needs an array (fail-closed).`);
      if (val.length === 0) return '1 = 1'; // NOT IN () excludes nothing
      return `${col} NOT IN (${val.map((v) => bind(params, v)).join(', ')})`;
    }
    case '$between': {
      if (!Array.isArray(val) || val.length !== 2) throw new Error(`[read-scope-sql] $between for "${field}" needs [min,max] (fail-closed).`);
      return `${col} BETWEEN ${bind(params, val[0])} AND ${bind(params, val[1])}`;
    }
    case '$contains': return `${col} LIKE ${bind(params, `%${String(val)}%`)}`;
    case '$notContains': return `${col} NOT LIKE ${bind(params, `%${String(val)}%`)}`;
    case '$startsWith': return `${col} LIKE ${bind(params, `${String(val)}%`)}`;
    case '$endsWith': return `${col} LIKE ${bind(params, `%${String(val)}`)}`;
    case '$null': return val ? `${col} IS NULL` : `${col} IS NOT NULL`;
    case '$exists': return val ? `${col} IS NOT NULL` : `${col} IS NULL`;
    default:
      throw new Error(`[read-scope-sql] unsupported operator "${op}" on "${field}" (fail-closed).`);
  }
}

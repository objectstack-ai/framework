// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { Cube, Metric, Dimension as CubeDimension, CubeJoin } from '@objectstack/spec/data';
import type { Dataset, DatasetMeasure, DatasetDimension } from '@objectstack/spec/ui';
import type { FilterCondition } from '@objectstack/spec/data';

/**
 * Dataset → Cube compiler (ADR-0021 D-A=(c), WS2).
 *
 * Lowers a declarative `dataset` (base object + included relationships +
 * declared dimensions/measures + derived measures) into the existing Cube
 * analytics runtime model. The author never writes an `ON` clause: joins are
 * DERIVED from the `include` relationship names and the dotted `relationship.field`
 * references on dimensions/measures, matching the NativeSQLStrategy convention
 *   `<parentTable>.<relationship> = <relationship>.id`.
 *
 * Safety (D-C): every dotted field reference must point at a relationship that
 * the dataset explicitly declared in `include`; otherwise the compile fails.
 * The returned `allowedRelationships` set is the join allowlist the strategy
 * enforces at SQL-build time.
 */

/** Operators v1 does NOT compile to the Cube SQL switch — surfaced as a clear error. */
const UNSUPPORTED_AGGREGATES = new Set(['array_agg', 'string_agg']);

export interface DerivedMeasureSpec {
  name: string;
  op: 'ratio' | 'sum' | 'difference' | 'product';
  of: string[];
}

export interface CompiledDataset {
  /** The Cube the dataset compiles to (consumed by the strategy chain). */
  cube: Cube;
  /**
   * Relationship names declared in `include`. The join allowlist (D-C):
   * the NativeSQLStrategy rejects any join alias not in this set.
   */
  allowedRelationships: Set<string>;
  /** Derived measures, computed post-aggregation by the executor (Q1). */
  derived: DerivedMeasureSpec[];
  /** Definition-level filter (the dataset's intrinsic scope). */
  filter?: FilterCondition;
  /** Per-measure scoped filters, keyed by measure name (applied by executor). */
  measureFilters: Record<string, FilterCondition>;
}

/**
 * Resolves a relationship name on a base object to the related object/table
 * name, using the runtime's object graph. Optional: when omitted the compiler
 * trusts the declared `include` names (the NativeSQLStrategy convention assumes
 * the relationship name equals the related table name).
 */
export type RelationshipResolver = (
  baseObject: string,
  relationshipName: string,
) => string | undefined;

/** Map a dataset measure's aggregate to the Cube metric `type`. */
function aggregateToMetricType(m: DatasetMeasure): Metric['type'] {
  if (UNSUPPORTED_AGGREGATES.has(m.aggregate)) {
    throw new Error(
      `[dataset-compiler] measure "${m.name}" uses aggregate "${m.aggregate}" which is ` +
      `not supported by the v1 dataset runtime (supported: count, sum, avg, min, max, count_distinct).`,
    );
  }
  return m.aggregate as Metric['type'];
}

/** Map a dataset dimension type to the Cube dimension `type`. */
function dimensionType(d: DatasetDimension): CubeDimension['type'] {
  switch (d.type) {
    case 'date': return 'time';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'lookup': return 'string';
    case 'string': return 'string';
    default: return 'string';
  }
}

/** The relationship prefix of a dotted `relationship.field` path, or null. */
function relationshipPrefix(field: string): string | null {
  const idx = field.indexOf('.');
  return idx > 0 ? field.slice(0, idx) : null;
}

export function compileDataset(
  dataset: Dataset,
  resolver?: RelationshipResolver,
): CompiledDataset {
  const include = dataset.include ?? [];
  const allowedRelationships = new Set(include);

  // Resolve each declared relationship to its TARGET TABLE and emit a Cube join.
  // The relationship name (a lookup/master_detail field on the base object) is
  // used as the join ALIAS, but the joined TABLE is the related object — these
  // differ when objects are namespaced (e.g. lookup field `account` →
  // table `crm_account`). Without resolving the table, the strategy would join a
  // non-existent `"account"` table. When no resolver is supplied the relationship
  // name is assumed to equal the table name (legacy convention / unit tests).
  const joins: Record<string, CubeJoin> = {};
  for (const rel of include) {
    let targetTable: string = rel;
    if (resolver) {
      const resolved = resolver(dataset.object, rel);
      if (!resolved) {
        throw new Error(
          `[dataset-compiler] dataset "${dataset.name}" includes relationship "${rel}" ` +
          `which does not exist on object "${dataset.object}".`,
        );
      }
      targetTable = resolved;
    }
    // `name` carries the join TABLE; the strategy derives the ON clause from the
    // relationship-name convention (`<base>.<rel> = <rel>.id`).
    joins[rel] = {
      name: targetTable,
      relationship: 'many_to_one',
      sql: `${dataset.object}.${rel} = ${rel}.id`,
    };
  }

  // Assert any dotted field only traverses a DECLARED relationship (D-C).
  const assertDeclared = (field: string, ownerKind: string, ownerName: string) => {
    const prefix = relationshipPrefix(field);
    if (prefix && !allowedRelationships.has(prefix)) {
      throw new Error(
        `[dataset-compiler] ${ownerKind} "${ownerName}" references relationship "${prefix}" ` +
        `via "${field}", but "${prefix}" is not declared in the dataset's \`include\`. ` +
        `v1 only joins along declared relationships.`,
      );
    }
  };

  // Compile dimensions.
  const dimensions: Record<string, CubeDimension> = {};
  for (const d of dataset.dimensions) {
    assertDeclared(d.field, 'dimension', d.name);
    const dim: CubeDimension = {
      name: d.name,
      label: typeof d.label === 'string' ? d.label : d.name,
      type: dimensionType(d),
      sql: d.field,
    };
    if (dim.type === 'time') {
      dim.granularities = d.dateGranularity
        ? [d.dateGranularity]
        : ['day', 'week', 'month', 'quarter', 'year'];
    }
    dimensions[d.name] = dim;
  }

  // Compile measures (non-derived → Cube metrics; derived → sidecar).
  const measures: Record<string, Metric> = {};
  const derived: DerivedMeasureSpec[] = [];
  const measureFilters: Record<string, FilterCondition> = {};

  for (const m of dataset.measures) {
    if (m.derived) {
      derived.push({ name: m.name, op: m.derived.op, of: m.derived.of });
      continue;
    }
    if (m.field) assertDeclared(m.field, 'measure', m.name);
    const metric: Metric = {
      name: m.name,
      label: typeof m.label === 'string' ? m.label : m.name,
      type: aggregateToMetricType(m),
      // `count` with no field aggregates over rows (*).
      sql: m.field ?? '*',
    };
    if (typeof m.format === 'string') metric.format = m.format;
    measures[m.name] = metric;
    if (m.filter) measureFilters[m.name] = m.filter;
  }

  const cube: Cube = {
    name: dataset.name,
    title: typeof dataset.label === 'string' ? dataset.label : dataset.name,
    sql: dataset.object,
    measures,
    dimensions,
    public: false,
  };
  if (Object.keys(joins).length > 0) cube.joins = joins;

  return {
    cube,
    allowedRelationships,
    derived,
    filter: dataset.filter,
    measureFilters,
  };
}

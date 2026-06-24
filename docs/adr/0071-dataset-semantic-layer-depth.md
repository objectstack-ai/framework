# ADR-0071: Dataset semantic-layer depth — multi-hop joins and matrix pivoting

## Status

Proposed

## Context

ADR-0021 established the `dataset` semantic layer: a base `object`, relationships
to `include` (joins **derived** from the object graph — no hand-written `ON`
clauses), and named `dimensions` / `measures` that presentations bind by name.
RLS/tenant scoping is enforced per joined object at runtime (D-C, fail-closed).

Two capability gaps remain, both flagged as follow-ups in ADR-0021:

1. **Single-hop joins only.** `Dataset.include` is `string[]` of relationship
   **names** (lookup / master_detail fields on the *base* object), and a
   dimension/measure `field` uses a one-dot `relationship.field` path.
   `native-sql-strategy.qualifyAndRegisterJoin` splits on the **first** dot:
   `account.region` → `LEFT JOIN account` + column `"account"."region"`. A
   two-hop path like `account.owner.region` is parsed as alias=`account`,
   column=`owner.region` → invalid SQL. You cannot group/aggregate by a field
   two relationships away (e.g. `opportunity → account → owner → region`).

2. **Matrix / "across" is flattened, not pivoted.** `Report` already declares
   `rows` (down) and `columns` (across) for `type: 'matrix'`, and the dataset
   query can group by both. But the dataset report renderer shows a **flat**
   table (rows ∪ columns as combined groupings) — it does not pivot the
   `columns` dimension into a 2-D grid (ADR-0021 D2 follow-up). A true matrix
   (rows × distinct-column-values × measure cells) isn't rendered.

## Decision

### A. Multi-hop joins (framework: spec + compiler + strategy + RLS)

- **Spec.** `Dataset.include` accepts relationship **paths** — dotted chains of
  lookup/master_detail field names from the base object (`'account'`,
  `'account.owner'`). A dimension/measure `field` may reference any field
  reachable along a **declared** path (`account.owner.region`). A depth cap
  (default **3 hops**) bounds join count/perf; undeclared paths are still
  rejected (D-C unchanged — only declared relationships are joinable).
- **Compiler** (`dataset-compiler`). Expand each `include` path into the ordered
  join chain; `cube.joins` is keyed by the full path alias (`account.owner`) and
  carries `{ parentAlias, fkField, targetObject }` so the chain is reconstructable.
- **Strategy** (`native-sql-strategy.qualifyAndRegisterJoin`). For `a.b.c`,
  register the chain (`base → a` on alias `a`; `a → b` on alias `a.b`) and
  qualify the column as `"a.b"."c"`. Emit `LEFT JOIN`s in dependency order. Base
  columns stay qualified with the base table (the fix from objectui#…/framework
  joined-column work) so shared column names remain unambiguous across all hops.
- **RLS (D-C, fail-closed).** Apply the tenant read-scope to **every** object in
  the chain, not just the first hop. The strategy already scopes per joined
  alias; generalize the loop to each hop's target object.
- **UI** (objectui). `useDatasetFieldCatalog` lazily expands a relationship's own
  relationships (one more level on demand) so the field picker offers
  `account.owner.region`; the include editor shows/edits paths; the existing
  `missingRelationship` author-time validation generalizes to paths.

### B. Matrix pivot (mostly objectui renderer)

- **Query unchanged.** Group by `rows ∪ columns` — the across dimension is just
  another `groupBy`.
- **Renderer** (`DatasetReportRenderer`). When `type === 'matrix'` and `columns`
  is non-empty, **pivot** the flat result into a 2-D grid: distinct `columns`
  values become column headers, `rows` go down the side, measure(s) fill the
  cells. Cap distinct column values (default **50**) with a "+N more — refine
  with a filter" notice to avoid column explosion.
- **Spec unchanged** (`rows` / `columns` already exist on `Report`).

## Consequences

- New capability: analytics two-plus relationships deep, and true matrix reports.
- Cost/risk: multi-hop joins multiply `LEFT JOIN`s (perf) and widen the RLS
  surface (each hop scoped) — bounded by the depth cap + declared-path allowlist.
  Matrix column cardinality is bounded by the column cap.
- **Backward compatible.** Single-hop `include` and flat rows keep working
  unchanged; the depth cap and "flat unless `matrix` + `columns`" defaults
  preserve current behaviour.

## Phasing

- **P1 — matrix pivot (objectui-only, lowest risk).** Render the matrix grid from
  the existing `rows`/`columns`. No spec/query change. Ships independently.
- **P2 — multi-hop (framework).** Spec path support + compiler chain + strategy
  chained joins + per-hop RLS, behind the depth cap. Gated by the ADR-0021
  reconciliation harness (old-vs-new numbers).
- **P3 — objectui catalog/UI.** Multi-hop field picker + include-path editor +
  path-aware author-time validation.

## Alternatives considered

- **Arbitrary join predicates / raw SQL** — rejected (ADR-0021 D-C: joins are
  derived from the object graph, no `ON` clauses; keeps datasets reviewable and
  RLS-safe).
- **Materialized / precomputed pivots** — out of scope; query-time pivot is
  sufficient at expected cardinalities (bounded by the column cap).

## Related

- ADR-0021 (analytics dataset semantic layer) — the foundation; D2 / join
  follow-ups this ADR addresses.

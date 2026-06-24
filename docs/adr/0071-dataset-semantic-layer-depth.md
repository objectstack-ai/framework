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

## Prior art / industry alignment

- **Curated join graph, not arbitrary SQL.** Salesforce *report types* pre-wire
  a primary object + up to 3 related objects; Looker *Explores* declare the
  joins a developer blesses; Power BI / Tableau model **relationships** and the
  engine resolves the path; Cube (this platform's runtime) resolves **transitive
  joins** from pairwise relationship declarations. All keep joins governed and
  derived from the object graph — exactly ADR-0021's D-C stance. This ADR stays
  in that lane (no `ON` clauses).
- **Spanning depth.** Salesforce report types reach 4 objects (≈3 to-one hops);
  SOQL allows 5 levels of parent traversal. A small, fixed depth covers the vast
  majority of real reports.
- **The fan-out lesson.** Looker (*symmetric aggregates*) and Tableau (*relationships
  vs. joins*) both exist because joining across a **to-many** edge and then
  aggregating **double-counts**. The robust answer for a governed, AI-authored,
  RLS-scoped layer is to **not** traverse to-many in the join chain at all (see
  Decision A) rather than to build symmetric-aggregate machinery now.
- **Matrix.** Salesforce matrix reports allow ≤2 row groupings + ≤2 column
  groupings; Power BI's matrix visual pivots with overflow handling. P1 targets
  the single-column-grouping MVP with a display-side overflow cap.

## Decision

### A. Multi-hop joins (framework: spec + compiler + strategy + RLS)

- **To-one only (the correctness boundary).** Multi-hop traversal is restricted
  to **to-one** relationships — `lookup` / `master_detail` (child→parent), which
  is exactly what `include` holds today. To-one chains **never fan out**, so
  existing `SUM`/`COUNT`/etc. stay correct with **zero** symmetric-aggregate
  machinery. Traversing a **to-many** (child) relationship inside a dataset's
  join chain is explicitly **out of scope** (it needs symmetric aggregates /
  sub-query rollups — a separate feature). Consequently the depth cap below is a
  **performance/complexity** guard, not a correctness one.
- **Spec.** `Dataset.include` accepts relationship **paths** — dotted chains of
  to-one relationship field names from the base object (`'account'`,
  `'account.owner'`). A dimension/measure `field` may reference any field
  reachable along a **declared** path (`account.owner.region`). The dotted path
  **is** the join alias, so paths are **self-disambiguating** (no named-join
  disambiguation like Power BI active/inactive or Looker aliased joins). A depth
  cap (default **3 hops** → 4 objects, Salesforce-report-type parity) bounds join
  count/perf; undeclared paths are still rejected (D-C unchanged).
- **Compiler** (`dataset-compiler`). Expand each `include` path into the ordered
  join chain; `cube.joins` is keyed by the full path alias (`account.owner`) and
  carries `{ parentAlias, fkField, targetObject }` so the chain is reconstructable.
- **Strategy** (`native-sql-strategy.qualifyAndRegisterJoin`). For `a.b.c`,
  register the chain (`base → a` on alias `a`; `a → b` on alias `a.b`) and
  qualify the column as `"a.b"."c"`. Emit `LEFT JOIN`s (outer — base rows
  without a related record still appear, the report-friendly default) in
  dependency order. Base columns stay qualified with the base table so shared
  column names remain unambiguous across all hops.
- **RLS (D-C, fail-closed).** Apply the tenant read-scope to **every** object in
  the chain, not just the first hop. The strategy already scopes per joined
  alias; generalize the loop to each hop's target object.
- **UI** (objectui). `useDatasetFieldCatalog` lazily expands a relationship's own
  **to-one** relationships (one more level on demand) so the field picker offers
  `account.owner.region`; the include editor shows/edits paths; the existing
  `missingRelationship` author-time validation generalizes to paths.

### B. Matrix pivot (mostly objectui renderer)

- **Query unchanged.** Group by `rows ∪ columns` — the across dimension is just
  another `groupBy`.
- **Renderer** (`DatasetReportRenderer`). When `type === 'matrix'` and `columns`
  is non-empty, **pivot** the flat result into a 2-D grid: distinct `columns`
  values become column headers, `rows` go down the side, measure(s) fill the
  cells. Cap distinct column values at a **display** ceiling (default **50**,
  with a "+N more — refine with a filter" notice) — a render-side guard, not a
  query limit. MVP = a single column grouping; ≤2 row/col groupings (Salesforce
  parity) is a fast-follow.
- **Spec unchanged** (`rows` / `columns` already exist on `Report`).

## Consequences

- New capability: analytics two-plus to-one hops deep, and true matrix reports.
- Cost/risk: multi-hop joins multiply `LEFT JOIN`s (perf) and widen the RLS
  surface (each hop scoped) — bounded by the depth cap + declared-path allowlist.
  No fan-out risk by construction (to-one only). Matrix column cardinality is
  bounded by the display cap.
- **Backward compatible.** Single-hop `include` and flat rows keep working
  unchanged; the depth cap and "flat unless `matrix` + `columns`" defaults
  preserve current behaviour.

## Phasing

- **P1 — matrix pivot (objectui-only, lowest risk).** Render the matrix grid from
  the existing `rows`/`columns`. No spec/query change. Ships independently.
- **P2 — multi-hop (framework).** Spec path support + compiler chain + strategy
  chained joins + per-hop RLS, behind the depth cap, **to-one only**. Gated by
  the ADR-0021 reconciliation harness (old-vs-new numbers).
- **P3 — objectui catalog/UI.** Multi-hop field picker + include-path editor +
  path-aware author-time validation.

## Alternatives considered

- **Arbitrary join predicates / raw SQL** — rejected (ADR-0021 D-C: joins are
  derived from the object graph, no `ON` clauses; keeps datasets reviewable and
  RLS-safe). Matches Salesforce/Cube/Power BI, not the developer-only Looker
  `sql_on`.
- **To-many traversal with symmetric aggregates** — deferred. Correct
  cross-to-many aggregation (Looker-style symmetric aggregates) is a separate,
  larger feature; the to-one boundary delivers the common case safely first.
- **Edge-graph + automatic path resolution** (declare relationship edges, let the
  engine find the path — Cube/Power BI style) — rejected for v1 in favour of
  explicit dotted paths: smaller delta, self-disambiguating, and per-path
  RLS-auditable.
- **Materialized / precomputed pivots** — out of scope; query-time pivot is
  sufficient at expected cardinalities (bounded by the display cap).

## Related

- ADR-0021 (analytics dataset semantic layer) — the foundation; D2 / join
  follow-ups this ADR addresses.

# ADR-0021: Analytics — one semantic `dataset` layer, `report` / `dashboard` become pure presentation

**Status**: Proposed (2026-05-31)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0019](./0019-app-as-consumer-unit.md) + [ADR-0020](./0020-state-machine-converge-and-enforce.md) (the "one engine, fold the parasitic concept into its host" principle — applied here to analytics), [ADR-0017](./0017-object-has-many-view.md) (object-bound ListView is the row-level lens), [ADR-0010](./0010-nl-to-flow-authoring.md) + [ADR-0011](./0011-actions-as-ai-tools.md) (AI authoring is the design center)
**Consumers**: `@objectstack/spec` (`ui/report.zod.ts`, `ui/dashboard.zod.ts`, `ui/view.zod.ts`, `data/query.zod.ts`, `kernel/metadata-type-schemas.ts`), `@objectstack/objectql` (query engine), `@objectstack/analytics-service`, all `examples/*`

> **Migration posture: big-bang, no back-compat.** This ADR redesigns the analytics surface from a clean sheet. The next minor version switches over in one shot — old `Report` / `DashboardWidget` shapes are *removed*, not deprecated-in-parallel. A one-time codemod rewrites existing metadata (see §6). We are explicitly **not** carrying the three legacy inline-query shapes forward.

---

## TL;DR

The platform already owns a **complete query engine** — `QuerySchema` has `joins` (inner/left/right/full + strategies + subquery + cross-datasource), `aggregations`, `groupBy` (with date bucketing), `having`, and `windowFunctions` ([`query.zod.ts:586`](../../packages/spec/src/data/query.zod.ts#L586)).

But **three presentation surfaces each re-implement their own crippled, single-object query inline** instead of using it:

| Surface | Data binding | Joins? | Uses `query.zod`? | Inline query fields |
|---|---|---|---|---|
| `Report` | single `objectName` | ❌ | ❌ | `columns[] + groupingsDown/Across + filter + blocks` |
| `DashboardWidget` | single `object` | ❌ | ❌ | `categoryField + valueField + aggregate + measures[] + filter + compareTo` |
| `ListView` chart (`ListChartConfigSchema`) | single object | ❌ | ❌ | `valueField + groupByField` ("Distinct from the full-featured chart") |

This produces three structural defects that are fatal for an **enterprise core-business** platform:

1. **No joins ⇒ half of real reporting is impossible.** "Revenue by account region" needs `order ⋈ account`. The engine can do it; the presentation layer can't reach it.
2. **Triple double-write ⇒ metric drift.** "Revenue" is defined three times in three different grammars. Finance numbers diverge across a report, a dashboard tile, and a list chart. This is a governance red line.
3. **No single source of truth ⇒ no drill-through, no certification, no reuse.** A dashboard tile cannot drill into the report behind it because there is no shared definition behind either.

**Decision.** Introduce **one semantic layer — `dataset`** — a named, reusable analytical query (a thin wrapper over `QuerySchema`) that declares its **dimensions** and **measures** *by name*. Then **collapse `report` and `dashboard` to pure presentation** that binds to a dataset by reference and selects dimensions/measures *by name* — never re-declaring `object` / `field` / `aggregate`. Chart visualization config (`ChartConfigSchema`) stays shared (it already was). `report` and `dashboard` remain **two metadata types** because their *render grammars* genuinely differ (pivot grid vs. widget canvas) — but neither owns a query anymore.

This is the industry-convergent shape (Looker LookML / Power BI dataset+model / dbt metrics / Salesforce CRM-Analytics dataset): **a governed semantic layer below; thin presentations above.** It keeps Airtable's authoring ergonomics (an inline single-object dataset auto-desugars, see §4) while gaining the governance Airtable lacks.

---

## Context

### Why two presentations is right, but two (three) queries is wrong

The earlier instinct "report and dashboard are two things" is correct — but for the wrong layer. They differ in **how they render**:

- **Report** renders a **pivot grid**: rows × columns × measures, with subtotals, drill-to-record, export. Its grammar is the matrix/pivot.
- **Dashboard** renders a **widget canvas**: a grid of independent charts/KPIs with global filters and refresh. Its grammar is layout + per-tile chart.

These two render grammars do not reduce to one another (a matrix report is not a single chart series). So **two presentation types stay.** What must *not* be duplicated is the layer *below* the render — "which object(s), which joins, which filter, which aggregation, what does `revenue` mean." That is one thing, and today it is three things.

### What "perfect" looks like — the semantic layer

Mature analytics stacks all converge on a three-layer model. We adopt it verbatim:

```
┌─ Presentation   report (pivot)   ·   dashboard (canvas)   ·   listView (row lens)
│                       │ reference by name, select dims/measures
├─ Semantic        dataset  — named query + declared dimensions + declared measures   ← single source of truth
│                       │ compiles to
└─ Engine          QuerySchema (joins / aggregations / groupBy / having / window)      ← already exists
```

- **Engine** (`query.zod.ts`) — exists, untouched. It is the SQL/AST.
- **Semantic** (`dataset`, NEW) — names the query and, crucially, names its **dimensions** (groupable axes) and **measures** (aggregatable values, with format + certification). `revenue` is defined *once* here.
- **Presentation** — `report` / `dashboard` / `listView`-chart reference a dataset and pick dimensions/measures *by name*. Zero query fields.

### Why widgets bind to `dataset`, not to `report`

A reasonable objection: "Salesforce/ServiceNow dashboards reference *reports* — why don't ours?" Because **"dashboard → report" is a symptom of having no semantic layer, not the target architecture.** In Salesforce/ServiceNow there is no `dataset`, so the Report is the only reusable data unit and is forced to double as one. The more mature the stack, the more the tile's dependency moves *off* the report and *onto* a dedicated semantic layer:

| Stack | Tile data source | True source of record |
|---|---|---|
| Salesforce / ServiceNow (no semantic layer) | → **report** | the report itself (doing double duty) |
| Power BI | pinned *from* a report, **but** | **dataset / model** |
| Looker | → Look or Explore | **Explore + LookML measures** |
| dbt / modern stack | → semantic model | **semantic model** |

Binding a *chart* tile to a *report* is actively worse than binding it to a dataset:

1. **Presentation pollution.** A report is a pivot grid (rows/columns/sort/subtotals). A chart wants only dimensions + measures. Sourcing a chart from a report means reverse-engineering a measure out of a presentation ("which report column is my Y-axis?"). A dataset exposes `revenue` by name directly.
2. **Report sprawl.** Different tiles want the same metric grouped differently (by month / region / product). Tile→report breeds one report per grouping (Salesforce's signature disease — half of all reports exist only to back a tile). Tile→dataset: one dataset's measures feed many tiles, and the *grouping is the tile's own `dimensions`* — nothing new is created.
3. **Layering integrity.** `report` and `dashboard` are *siblings* (both presentations). Making one depend on the other inverts the layering — a presentation becomes a data source — and blocks a chart-only metric (no report) or a table-only report (no dashboard) from being first-class. Dataset-below / presentations-beside is a clean DAG.
4. **Drill-through is decoupled, not lost.** The legitimate "click the tile → see detail" need is preserved by `widget.drillTo: reportName` — an *optional navigation link*, not the data dependency. The tile draws data from the dataset and *additionally* may jump to a report for the tabular drill.

The kernel of truth in "reference a report" is **reuse of a fully-specified analysis** — relocated here to its correct layer (the dataset) plus two escape hatches: `drillTo` for navigation, and the report-embed widget below for genuine table-in-dashboard composition.

#### Report-embed widget (presentation composition ≠ data dependency)

When an author literally wants a report's *table* rendered inside a dashboard (not a chart sourced from report data), that is a presentation-layer composition and is allowed via a distinct widget kind:

```ts
// a widget may EITHER source chart data from a dataset (default), OR embed a report for display
widget: { id: 'pipeline_table', report: 'pipeline_by_stage', layout: { x:0, y:0, w:12, h:6 } }
```

`widget.report` (embed a rendered report) and `widget.dataset` (source chart/KPI data) are mutually exclusive. This keeps "show this table here" possible without letting chart data flow *through* a presentation.

### Precedent

| Product | Semantic layer | Pivot/report | Dashboard tile source |
|---|---|---|---|
| Looker | **Explore + LookML measures/dimensions** | Look (table) | tile → Look/Explore |
| Power BI | **Dataset + model (DAX measures)** | Report visual | tile pinned from report |
| dbt | **metrics / semantic models** | downstream BI | downstream BI |
| Salesforce CRM Analytics | **Dataset (recipe)** | Lens | dashboard widget → dataset/lens |
| Airtable (counter-example) | **none** — tile redefines query inline, single table | — | tile → table/view inline |

Airtable's flat model is exactly our current `DashboardWidget`. It suits Airtable's market and **cannot carry enterprise core systems** (no joins, no governed metric). We keep its *ergonomics* (§4) and discard its *architecture*.

### Design center: AI authors this

Per ADR-0010/0011 the author is increasingly an AI. A named `dataset` with declared `measures: [{ name: "revenue", aggregate: "sum", field: "amount" }]` gives the model a **stable vocabulary**: a widget says `measures: ["revenue"]` and the model cannot invent a divergent `valueField/aggregate` pair. The semantic layer is also an **anti-hallucination guardrail** — the legal dimensions/measures are enumerable, so an Agent picks from a closed set instead of guessing field names. This mirrors the ADR-0020 reasoning ("meet the model where its priors are; make the legal set introspectable").

---

## Decision

Three decisions.

### D1 — Introduce `dataset` as the single analytical source of truth

A new top-level metadata type `dataset`. It is a **thin wrapper over `QuerySchema`** plus a declared semantic contract:

```ts
// packages/spec/src/ui/dataset.zod.ts  (NEW)
export const DimensionSchema = z.object({
  name: SnakeCaseIdentifierSchema,            // referenced by presentations
  label: I18nLabelSchema.optional(),
  field: z.string(),                          // resolves within the dataset query (joins included)
  type: z.enum(['string','number','date','boolean','lookup']).optional(),
  dateGranularity: DateGranularity.optional(),// default bucketing for date dims
});

export const MeasureSchema = z.object({
  name: SnakeCaseIdentifierSchema,            // e.g. "revenue" — defined ONCE
  label: I18nLabelSchema.optional(),
  aggregate: AggregationFunction,             // reuse query.zod enum (sum/avg/count/...)
  field: z.string().optional(),               // optional for count(*)
  filter: FilterConditionSchema.optional(),   // measure-scoped filter (e.g. won_amount)
  format: z.string().optional(),              // "$0,0.00", "0.0%"
  certified: z.boolean().default(false),      // governance: blessed metric
});

export const DatasetSchema = z.object({
  name: SnakeCaseIdentifierSchema,
  label: I18nLabelSchema,
  description: I18nLabelSchema.optional(),

  /** The FROM/JOIN/WHERE — the full engine grammar, reused verbatim. */
  query: QuerySchema,                          // joins, filter, having, window — all available

  /** The semantic contract presentations bind to. */
  dimensions: z.array(DimensionSchema),
  measures: z.array(MeasureSchema),

  protection: ProtectionSchema.optional(),
  ...MetadataProtectionFields,
});
```

Security/RLS is inherited from the objects the `query` touches — there is **one** place to reason about access, not three.

### D2 — `report` becomes a pure pivot presentation over a dataset

`ReportSchema` loses `objectName`, `columns`, `groupingsDown/Across`, `filter`, `blocks`, `chart`-as-query. The `tabular / summary / matrix` enum collapses into one pivot grammar (tabular = no groupings; summary = rows only; matrix = rows + columns). `joined` becomes `sections[]` — each section is just another dataset reference.

```ts
export const ReportSchema = z.object({
  name: SnakeCaseIdentifierSchema,
  label: I18nLabelSchema,
  description: I18nLabelSchema.optional(),

  dataset: z.string().describe('Dataset name — the only data binding'),

  /** Pivot layout — dimension/measure NAMES from the dataset, never fields. */
  rows: z.array(z.string()).optional(),        // dimension names down
  columns: z.array(z.string()).optional(),     // dimension names across (matrix)
  values: z.array(z.string()),                 // measure names

  /** Presentation-only. */
  runtimeFilter: FilterConditionSchema.optional(), // user scope, ANDed at render (NOT the definition)
  display: ReportDisplaySchema.optional(),     // totals, conditional formatting, number format overrides
  chart: ChartConfigSchema.optional(),         // optional viz of the same pivot
  drilldown: z.boolean().default(true),        // click a cell → underlying records (free, dataset-backed)

  /** Multi-section ("joined") report = several dataset-backed panels. */
  sections: z.array(ReportSectionSchema).optional(),

  aria: AriaPropsSchema.optional(),
  performance: PerformanceConfigSchema.optional(),
  protection: ProtectionSchema.optional(),
  ...MetadataProtectionFields,
});
```

### D3 — `dashboard` widgets reference a dataset and pick measures/dimensions by name

`DashboardWidgetSchema` loses `object`, `categoryField`, `categoryGranularity`, `valueField`, `aggregate`, `measures[]`, and inline `filter`/`compareTo`-as-query. A widget now **selects** from its dataset's declared semantics:

```ts
export const DashboardWidgetSchema = z.object({
  id: SnakeCaseIdentifierSchema,
  title: I18nLabelSchema.optional(),
  layout: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),

  /** Data binding — EXACTLY ONE of `dataset` (chart/KPI) or `report` (embed a rendered table). */
  dataset: z.union([z.string(), DatasetSchema]).optional(), // name (governed) or inline (sugar, §4)
  report: z.string().optional(),               // embed a rendered report table (presentation composition)

  dimensions: z.array(z.string()).optional(),  // dimension names (X / group / split) — dataset path only
  measures: z.array(z.string()).optional(),    // measure names (Y) — "revenue", not amount+sum

  viz: ChartConfigSchema.optional(),           // chart type + axes mapping (shared, unchanged)
  colorVariant: WidgetColorVariantSchema.optional(),

  /** Presentation directives over the dataset's declared date dimension. */
  compareTo: CompareToSchema.optional(),       // previousPeriod / previousYear / {offset} — engine shifts the query
  drillTo: z.string().optional(),              // report name to open on click (navigation, not data dep)

  requiresObject: z.string().optional(),       // runtime capability gate (kept)
  requiresService: z.string().optional(),
  responsive: ResponsiveConfigSchema.optional(),
  aria: AriaPropsSchema.optional(),
}).superRefine((w, ctx) => {
  // exactly one data binding
  if (!!w.dataset === !!w.report)
    ctx.addIssue({ code: 'custom', message: 'widget requires exactly one of `dataset` or `report`' });
  // dimensions/measures only meaningful on the dataset path
  if (w.report && (w.dimensions || w.measures))
    ctx.addIssue({ code: 'custom', message: '`dimensions`/`measures` are not allowed with `report` (embed) widgets' });
});
```

Dashboard-level `globalFilters` and `dateRange` bind to **dimension names**, not raw fields — so a global filter is valid by construction and applies uniformly because every widget speaks the same dataset vocabulary.

`ListView`'s `type: 'chart'` variant (`ListChartConfigSchema`) is retired the same way: a charted list view references a dataset. The object-bound *row-level* lenses (grid/kanban/calendar/gallery — ADR-0017) are unaffected; they were never analytics.

---

## Consequences

**Gained**
- **Joins everywhere, for free.** Any report/widget can be multi-object because the dataset's `query` is the full engine. The #1 enterprise blocker is gone.
- **One definition of every metric.** `revenue` lives in one dataset measure; every surface references it. No drift; `certified` enables governance.
- **Drill-through is free.** A widget and the report behind it share a dataset, so a tile can `drillTo` a report or expand to underlying records natively.
- **Smaller protocol.** Three inline query grammars (`Report.columns/groupings`, `Widget.category/value/aggregate/measures`, `ListChartConfig`) delete down to one (`dataset.dimensions/measures`). Net schema shrinks.
- **AI authoring is safer.** Closed, enumerable set of legal dimensions/measures per dataset.

**Costs**
- **Big-bang migration** (accepted, §6). Every existing report/dashboard/list-chart is rewritten by codemod.
- **One more indirection** for the trivial "single-object count" case — mitigated by inline desugaring (§4).
- **Engine must support presentation directives** — `compareTo` time-shift and `runtimeFilter` ANDing happen at query compile time against a dataset.

---

## §4 — Keeping Airtable ergonomics: inline desugaring

The objection to a semantic layer is "now a one-number KPI needs a whole dataset file." We remove that cost: a presentation may inline an **anonymous dataset** which the loader desugars into a real (unnamed) dataset at registration:

```ts
// authoring sugar — single object, no named dataset needed
widget: {
  id: 'open_deals', viz: { type: 'metric' },
  dataset: { query: { object: 'opportunity', filter: { stage: { $ne: 'closed' } } },
             measures: [{ name: 'v', aggregate: 'count' }] },
  measures: ['v'],
}
```

`dataset` accepts **either** a `string` (named reference — the governed path) **or** an inline `DatasetSchema` (the Airtable-style quick path). Same author ergonomics as today; same single engine underneath. Reach for a named dataset when a metric is shared or must be certified.

---

## §5 — Metadata-type registry changes

[`metadata-type-schemas.ts`](../../packages/spec/src/kernel/metadata-type-schemas.ts):

```diff
+ dataset: DatasetSchema,
  dashboard: DashboardSchema,   // shape replaced (D3)
  report: ReportSchema,         // shape replaced (D2)
```

`report` and `dashboard` stay as types (two presentations, §Context). `dataset` is added. No type is removed — but two are re-shaped.

---

## §6 — One-shot migration (codemod, next minor)

A deterministic codemod runs over all package/app metadata. No parallel old+new period.

| Old | New |
|---|---|
| `Report{ objectName, columns, groupingsDown/Across, filter }` | extract `dataset{ query:{object,filter}, dimensions:(groupings), measures:(aggregate columns) }`; `Report{ dataset, rows, columns, values }` |
| `Report{ type:'joined', blocks }` | one dataset per block → `Report{ sections:[{dataset}] }` |
| `DashboardWidget{ object, categoryField, valueField, aggregate, filter }` | anonymous dataset (inline) or named if shared; `widget{ dataset, dimensions:[category], measures:[{aggregate,valueField}→name] }` |
| `DashboardWidget{ measures[] }` (multi-measure) | dataset `measures[]` + widget `measures:[names]` |
| `ListView{ type:'chart', ListChartConfig }` | `dataset` reference; drop `ListChartConfigSchema` |

Duplicate inline definitions that the codemod detects as identical (same object+field+aggregate across surfaces) are **hoisted into one named, `certified: false` dataset** and referenced — converting accidental duplication into an explicit shared metric the team can then bless. The codemod emits a report of every hoist so authors can review and name them.

**Files removed:** `ListChartConfigSchema` (in `view.zod.ts`); the inline-query fields enumerated above. **Files added:** `ui/dataset.zod.ts`. **Files reshaped:** `ui/report.zod.ts`, `ui/dashboard.zod.ts`.

---

## Open questions

1. **Calculated/derived measures** (e.g. `win_rate = won / total`) — introduce a `MeasureSchema.expression` (measure-over-measures) now, or defer to a follow-up ADR? Leaning: define the field now, implement later.
2. **Dataset parameters** (a dataset templated on a runtime value, e.g. `:region`) vs. pushing all scoping to `runtimeFilter`. Leaning: `runtimeFilter` only in v1; parameters later if needed.
3. **Cross-dataset dashboard filters** — a global filter spanning widgets backed by *different* datasets requires a shared dimension name convention. Leaning: match by dimension `name`; document the convention.

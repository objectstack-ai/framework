# Application builder — UI design

**Status**: Living design doc (draft, 2026-07-01). Companion to
[ADR-0084](../adr/0084-application-builder-information-architecture.md). The ADR
records the *decisions and rejected alternatives* (the information architecture);
this doc records *how it looks and flows* — it iterates as the UI is built, and is
not a binding contract.

This doc specifies the **shell and layout** — how the builder composes surfaces. It
does **not** re-specify the per-item config panels: those are Studio's existing
protocol-generated metadata forms, reused as-is (§1.4). What the builder actually
builds is the composition; the panels are dropped in.

Each surface has an **HTML mockup** under [`builder-ui/`](./builder-ui/) — the precise
visual target and, because its DOM maps to the component tree and its regions are
tagged `data-build` / `data-reuse`, the implementation blueprint (see
[Mockups](#mockups)). The ASCII sketches inline below are for quick reading.

---

## 1. Core constraints — AI-first, human-confirmable, reuse-first

Every layout and interaction decision in the builder is judged against these. They
are the north star: a design that fails any of them is wrong, however convenient it
looks. Each pillar's design (below) is checked against them.

1. **AI generates it in one shot.** The builder must let the agent produce a whole,
   correct artifact — an object with its fields, validations, and layout — in a
   single pass. This works because the agent edits the *same flat, explicit metadata*
   a human does (same-renderer, §3.6) and authors within *constrained, declarative*
   surfaces (typed fields, enum options, the condition builder — not free-form code).
   The *shape of the metadata*, not a click-through wizard, is what the AI targets.

2. **The design prevents AI mistakes.** Constrain the space so an invalid result is
   hard to express: declarative over code (a condition builder, not hand-written CEL,
   §4 Validation), typed and enumerated inputs, and the pre-publish validation gates
   (`os validate` / `os build`). Nothing the AI writes goes live implicitly — it lands
   as a **draft** (ADR-0033), never auto-published.

3. **A human confirms it in one pass.** A reviewer approves or rejects with one look:
   AI changes arrive as a **draft diff** (ADR-0033), and the artifact renders on one
   canvas (the grid + inspector) with no modals hiding state (§3.7) and a non-blocking
   inspector, so the whole thing stays visible while it is reviewed.

4. **Reuse, never rebuild.** Every per-item config panel — the field editor, the
   validation-rule editor, object settings, and every other metadata form — **is
   Studio's existing protocol-generated form**, generated from the metadata-type
   schemas, and is dropped into the inspector unchanged. The builder does **not**
   hand-roll config UI. This is not just tidiness: reused, already-verified panels are
   panels the AI cannot get wrong and a human has seen before, which is what makes
   constraints 1–3 achievable in practice.

### Build boundary — what the builder builds vs. reuses
This is the answer to *"how do we ensure code written against this doc is correct?"* —
shrink the novel surface to almost nothing:

- **Built here (the shell / composition):** the top bar + pillar tabs, the left rail,
  the per-object facet tab bar, the work-surface chrome, and the wiring that routes a
  selection into the inspector and edits into draft metadata.
- **Reused (not rebuilt):** the data grid (the existing ListView renderer), and every
  config panel in the inspector (Studio protocol-generated forms). These are
  referenced by name; the builder composes them, it does not reimplement them.

In every mockup this boundary is explicit: regions carry `data-build="shell"` or
`data-reuse="<component>"`, and reused blocks are drawn with a dashed outline.

---

## 2. The shell (every pillar shares it)

```
┌───────────────────────────────────────────────────────────────────┐
│ app ▾   Data · Automation · Interface · Access      ⚙   Save · Publish │  ← top bar
├─────────┬───────────────────────────────────────────┬──────────────┤
│ left     │ main (the work surface)                    │ right         │
│ rail     │  + a per-entity facet tab bar (see Data)    │ inspector     │
│ entities │  grid / canvas / builder / matrix           │ = selected    │
│ + search │  ─────────────────────────────────────      │   item's      │
│ + new    │  [ reused renderer, e.g. ListView ]         │   config      │
│          │                                            │ [reused form] │
├─────────┴───────────────────────────────────────────┴──────────────┤
│ legend:  solid = built (shell) · dashed = reused (Studio component)  │
└───────────────────────────────────────────────────────────────────┘
```

Mockup: [`builder-ui/data-pillar.html`](./builder-ui/data-pillar.html) (open in a browser).

- **Top bar** — the four pillar tabs (Data / Automation / Interface / Access), the
  ⚙ Settings entry, the app switcher, and the draft indicator + Save draft /
  Publish (draft-gated, ADR-0033).
- **Left rail** — the current pillar's primary entities (objects / automations /
  surfaces / roles), with search and New. Collapsible.
- **Main** — the pillar's primary work surface, shaped to the pillar (Data = grid,
  Automation = canvas, Interface = builder/source, Access = matrix).
- **Right inspector** — a *persistent, consistent* slot that shows the config panel
  for whatever is selected in the main zone. Non-blocking (the main surface stays
  visible); slides in on select, closable. This is the universal "inspector"
  (Figma / Retool pattern). Its contents are always reused protocol forms (§1.4).

## 3. Design principles (for best operation experience)

1. **Consistent three zones across all four pillars** — rail / main / inspector.
   Muscle memory: config is always on the right, entities always on the left.
2. **Facet = tab, item = inspector.** Tabs switch *which facet* of an entity you're
   on (an object's Records / Fields / Validations …); the right inspector configures
   the *selected item* within that facet (a field, a rule, a node). They coexist.
3. **The default tab is the primary surface, not a demoted one.** In Data the first
   tab is `Records` (the grid) — you always land on the data; tabs make the other
   facets one click away without burying the grid.
4. **Small config → inspector; big designer → main.** A field / rule / node /
   component configures in the right inspector. A full designer (the field designer,
   flow canvas) *is* the main zone.
5. **Two doors, one metadata.** An object-scoped surface that lives in another
   pillar (an object's Actions, Hooks, Views, Permissions) is reachable from the
   object (in-context, scoped) AND from its pillar (the cross-object lens). The
   metadata is stored once; there are two navigational entries, no duplication.
6. **Same renderer.** The builder manipulates the same live artifact the end user
   sees (edit a field on the real grid; set a permission on the real matrix). This
   is also what keeps AI authoring safe (§1) — the agent edits the same flat,
   explicit metadata a human does.
7. **No modals.** Config surfaces in the inspector or as a focused sub-view with a
   breadcrumb; the work surface never fully disappears. Draft/publish is always
   visible.
8. **Reuse, never rebuild (§1.4).** Config panels are Studio protocol-generated
   forms; the builder composes, it does not reimplement.

---

## 4. Data pillar

Data is the **object-model workbench**: define objects, their fields, relationships,
and validations, and work with records. Data owns the *data layer and the field
designer*; runtime presentation surfaces (saved grid views, kanban, calendar, pages,
dashboards) belong to Interface.

Mockup: [`builder-ui/data-pillar.html`](./builder-ui/data-pillar.html).

```
┌ objects ─┬ Task ┈ Records · Fields · Validations │ Actions · Hooks · ⋯ ┬ inspector ┐
│ Account  │ ┌ filter · sort · hide ─────────────────────────────────┐ │ Edit field │
│ Task ◄   │ │ #  Title           Status      [Priority ▾]   +        │ │ Priority   │
│ Project  │ │ 1  Audit IA        In review    ● Medium               │ │ type: select│
│ Invoice  │ │ 2  Design system   In progress  ● High                 │ │ options …   │
│ + New    │ │ + New record                                          │ │ required    │
└──────────┴─┴───────────────────────────────────────────────────────┴─┴────────────┘
```

### Left rail
The app's objects (v1: owned objects only), with search + New object.

### Object facet tabs
Per selected object, a tab bar of its facets — grouped:

- **Schema** (authored in Data): `Records` · `Fields` · `Validations` · `Relationships` · `Lifecycle`
- **Behavior**: `Actions` (Automation) · `Hooks` (Advanced)
- **⋯ More**: `Views` · `Forms` (Interface) · `Permissions` (Access) · `Settings` · `Indexes`

`Records` is the default. Cross-pillar tabs carry a pillar tag and open **in-context,
scoped to this object** (their pillar is the cross-object lens — the two-doors
principle, §3.5).

Note: `Actions` / `Hooks` / `Validations` are the three authoring surfaces for logic
on an object, routed by intent per [ADR-0077](../adr/0077-authoring-surface-boundary-hook-flow-validation.md):
declarative validation · user-triggered action · write-path hook.

### Records and Fields — two views of one field designer
Both tabs design the *same* thing (the object's fields); they differ in presentation,
and both configure a selected field through the *same* right-hand **field editor**.

- **`Records` — grid / list style (data-forward).** The functional grid: columns =
  fields, rows = real records. Preview and inline-edit data, `+` add a column
  (= add a field), select a column header to configure that field's properties in
  the inspector, `+ New record`. Ephemeral filter / sort / hide / group for looking
  at the data (not saved — saved views are Interface).
- **`Fields` — form style (layout-forward).** The field designer as a form canvas:
  drag to reorder fields, group them into sections, and configure field properties.
  No data rows — this is where the object's default field layout (order + grouping)
  is authored. (This is the existing form-style field designer, reused here.)

The choice between them is a working preference: reach for `Records` when you want to
see data while shaping fields, `Fields` when you want to arrange and group them.

**Why keep the names `Records` / `Fields`** (rather than `Grid` / `Form`): each name
states the tab's *distinguishing* trait — Records is the one that shows **data**,
Fields is the **pure field/layout** designer. They are also the conventional terms
(Salesforce, Airtable). Style-based names would collide with Interface's existing
`Views` (saved grid/kanban) and `Forms` (end-user form surfaces).

### Main zone (content of the active tab)
| Tab | Main-zone content |
|---|---|
| **Records** | grid-style field designer — preview data, add columns, select a column → configure the field (see above). |
| **Fields** | form-style field designer — drag-reorder, section grouping, field-property config (see above). |
| **Validations** | the **rules list** (declarative). See below. |
| **Relationships** | lookup / master-detail fields + reverse relationships (list / graph). Relationships are created by adding a `lookup` field type. |
| **Actions / Hooks / Views / Forms / Permissions** | the object's scoped instances, opened in-context. |

### Right inspector (per-item config — reused protocol forms, §1.4)
Selecting an item in the main zone opens its **existing Studio protocol-generated
form** in the inspector, non-blocking. Nothing here is bespoke to the builder. The
field editor is shared by both Records (selected column) and Fields (selected field):
- a column / field → the **field editor** (type, options, required/unique, field-level validation)
- a validation rule → the **rule editor** (condition builder + message + severity + events)
- a record → record detail
- an action → action config

### Validation (grounded in the schema)
`ObjectSchema.validations` is an array of `ValidationRuleSchema` — a discriminated
union of six declarative rule types (`packages/spec/src/data/validation.zod.ts`):
`script` (CEL predicate → fails when true), `cross_field`, `format`,
`state_machine`, `json`, `conditional`. Each carries `message`, `severity`
(error/warning/info), and `events` (insert/update/delete).

- **Field-level** (required / unique / format) → configured in the **field editor**
  (they belong to the field).
- **Cross-field / business rules** → the **Validations tab** → a declarative rules
  list; each rule edits in the inspector via a **condition builder** (field /
  operator / value, and/or) with a raw-expression escape hatch — never hand-written
  CEL as the primary path. Validation stays **declarative** (not a hook); Data-owned.
  The condition builder is also what makes validation AI-generatable and
  human-confirmable in one pass (§1).

### v1 scope
- **Ship**: owned objects · `Records` grid (data + add/configure columns) · `Fields`
  form-style designer (reorder + grouping + field editor, incl. field-level
  validation) · `Validations` (condition builder) · object `Settings` (label / icon /
  name field / compact / search). Relationships via the `lookup` field type.
- **Defer**: Extended objects (objectExtensions) · External objects (datasources) ·
  the ERD / model view · formal `Lifecycle` (v1 status = a select field) · `Indexes` ·
  seed-data UI · saved views / kanban / calendar (presentation → Interface).

---

## 5. Other pillars (to design — same shell)

- **Automation** — left: automations grouped by trigger (record-change / scheduled /
  API / manual action); main: the flow **canvas**; inspector: the selected node's
  config; a Runs view for execution history.
- **Interface** — left: surfaces (Apps · Pages · Views · Dashboards · Reports);
  main: the page **builder** (structured canvas) or **source + preview** (html/react
  pages); inspector: component props.
- **Access** — left: roles; main: the permission **matrix** (objects × CRUD + record
  scope); inspector: role / field-level detail.
- **Settings** (⚙) — General (app basic info) and Advanced (Code: hooks · functions;
  Connections: datasources), grouped by audience.

---

## Mockups

Mockups live under [`builder-ui/`](./builder-ui/) as **HTML**, not images — HTML is
the better artifact for an AI to build against and it scales to the many surfaces
still to design:

- **DOM ≈ component tree.** The markup maps almost 1:1 to the React components to
  build, so there is little to infer or get wrong.
- **The build boundary is machine-readable.** Every region is tagged
  `data-build="shell"` (built in the builder) or `data-reuse="<component>"` (an
  existing Studio/objectui component — e.g. `ListView`, `protocol-form:field` — to
  drop in unchanged). Reused blocks render with a dashed outline.
- **One shared look.** [`shell.css`](./builder-ui/shell.css) holds the tokens and
  layout primitives (top bar, rail, facet tabs, grid, inspector, form rows, toggles);
  each pillar mockup composes them, so a new surface is a small file and stays
  visually consistent for free.

Open any `*.html` in a browser to view it. Current mockups:

| Surface | Mockup |
|---|---|
| Data pillar | [`data-pillar.html`](./builder-ui/data-pillar.html) |

More are added per pillar as they are designed.

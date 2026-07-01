# Application builder — UI design

**Status**: Living design doc (draft, 2026-07-01). Companion to
[ADR-0084](../adr/0084-application-builder-information-architecture.md). The ADR
records the *decisions and rejected alternatives* (the information architecture);
this doc records *how it looks and flows* — it iterates as the UI is built, and is
not a binding contract.

The atomic config panels (object designer, field editor, validation-rule editor,
form designer, …) already exist. This doc is about the **overall layout** that
composes them into one coherent builder, optimized for operation experience.

---

## 1. The shell (every pillar shares it)

```
┌───────────────────────────────────────────────────────────────────┐
│ app ▾   Data · Automation · Interface · Access      ⚙   Save · Publish │  ← top bar
├─────────┬───────────────────────────────────────────┬──────────────┤
│ left     │ main (the work surface)                    │ right         │
│ rail     │                                            │ inspector     │
│          │  grid / canvas / builder / matrix           │ = selected    │
│ entities │  + a per-entity facet tab bar (see Data)    │   item's      │
│ + search │                                            │   config      │
│ + new    │                                            │  (non-block)  │
├─────────┴───────────────────────────────────────────┴──────────────┤
│ breadcrumb · hints                                                    │
└───────────────────────────────────────────────────────────────────┘
```

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
  (Figma / Retool pattern).

## 2. Design principles (for best operation experience)

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
   is also what keeps AI authoring safe — the agent edits the same flat, explicit
   metadata a human does.
7. **No modals.** Config surfaces in the inspector or as a focused sub-view with a
   breadcrumb; the work surface never fully disappears. Draft/publish is always
   visible.

---

## 3. Data pillar

Data is the **object-model workbench**: define objects, their fields, relationships,
and validations, and work with records. Data owns the *data layer and the field
designer*; runtime presentation surfaces (saved grid views, kanban, calendar, pages,
dashboards) belong to Interface.

### Layout

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
scoped to this object** (their pillar is the cross-object lens — two doors, §2.5).

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

### Main zone (content of the active tab)
| Tab | Main-zone content |
|---|---|
| **Records** | grid-style field designer — preview data, add columns, select a column → configure the field (see above). |
| **Fields** | form-style field designer — drag-reorder, section grouping, field-property config (see above). |
| **Validations** | the **rules list** (declarative). See below. |
| **Relationships** | lookup / master-detail fields + reverse relationships (list / graph). Relationships are created by adding a `lookup` field type. |
| **Actions / Hooks / Views / Forms / Permissions** | the object's scoped instances, opened in-context. |

### Right inspector (per-item config — the existing panels)
Selecting an item in the main zone opens its existing config panel in the inspector,
non-blocking. The field editor is shared by both Records (selected column) and Fields
(selected field):
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

### v1 scope
- **Ship**: owned objects · `Records` grid (data + add/configure columns) · `Fields`
  form-style designer (reorder + grouping + field editor, incl. field-level
  validation) · `Validations` (condition builder) · object `Settings` (label / icon /
  name field / compact / search). Relationships via the `lookup` field type.
- **Defer**: Extended objects (objectExtensions) · External objects (datasources) ·
  the ERD / model view · formal `Lifecycle` (v1 status = a select field) · `Indexes` ·
  seed-data UI · saved views / kanban / calendar (presentation → Interface).

---

## 4. Other pillars (to design — same shell)

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
Interactive layout mockups were produced during the design session (grid + inspector,
form-style field designer, validation rule builder, object facet tabs). The ASCII
sketches above capture their structure.

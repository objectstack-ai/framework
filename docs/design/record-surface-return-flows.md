# Design — Record create / edit / subtable surfaces + the return-flow model

**Issue**: [#2604](https://github.com/objectstack-ai/framework/issues/2604) (follow-up to [#2578](https://github.com/objectstack-ai/framework/issues/2578), shipped in framework#2595 + objectui#2237 + framework#2599)
**Builds on**: [ADR-0085](../adr/0085-object-semantic-roles-over-surface-hint-blocks.md) §2 (admission test — presentation surface is *not* an authorable key) and §5 (one shared derivation, every surface); [ADR-0078](../adr/0078-no-silently-inert-metadata.md) (no silent no-ops)
**Audience**: implementing agent. Scope: decide the three open questions from #2604 and specify the return-flow contract precisely enough to wire and browser-verify.

**North star (inherited from #2578):** all metadata is AI-authored, so surface *and* return behavior are **platform defaults derived at runtime — zero AI authoring**. Presentation is not metadata. This design adds **no object keys, no view keys, no new ADR** — it is renderer semantics inside the boundary ADR-0085 already drew.

---

## 1. Current state (verified, post-#2578)

What shipped:

- `deriveRecordSurface(def, opts)` (`packages/spec/src/data/record-surface.ts`) — the single derivation of a record's default surface from authorable-field count: ≥ 12 → `'page'`, else `'drawer'`; `viewport: 'mobile'` → `'page'`. `'modal'` is in the `RecordSurface` type but never emitted by the heuristic.
- The **detail (view)** flow consumes it in objectui `packages/app-shell/src/views/ObjectView.tsx` (`detailNavigation` default): field-heavy → full page **route**, light → **drawer** over the list (URL-addressable via `?recordId=`). Browser-verified on `field_zoo` (57 fields → page) and `product` (6 → drawer).
- Explicit overrides already exist and win over the derivation: `navigation.mode` / `navigation.size` on the list view, `FormView.type` / `modalSize`, or an assigned record `Page`.

What #2578 deliberately did **not** design (this document's scope):

| Flow | Behavior today | Gap |
|---|---|---|
| List → **New** (create) | hardcoded large modal | ignores the derivation; return-on-save unspecified |
| Detail → **Edit** | modal, not wired to the derivation | surface + return undesigned |
| Subtable (related list) → New / Edit **child** | untouched | surface + return undesigned |
| **Return** from any of the above | ad-hoc | no contract, never browser-verified |

("Subtable" here = the parent detail page's **related list** of `master_detail`/`lookup` children — the `relatedList` role, #2594. The *write-side* `inlineEdit` grid lives **inside** the parent's own form and is atomic with it; it is untouched by this design — see §7.)

---

## 2. The one decision that drives everything: route vs overlay

A **route** buys deep-linkability, refresh-safety and browser-back — properties of **state you'd share or revisit**. It costs explicit return wiring (origin state), and nested flows need a return *stack*.

An **overlay** (modal/drawer) buys trivial, lossless return — close and you are exactly where you were, scroll + filters + tab intact. It costs deep-linkability, which a **transient task** doesn't need: a URL to a half-filled form is not shareable state (refresh loses the draft regardless), and nobody bookmarks "the act of editing".

So the split falls out of what each flow *is*:

> **Viewing a record is state → route-capable. Making/changing a record is a task → always an overlay.**

This is also the cheapest correct system: the return-flow invariants in §4 come *for free* from overlays, while the route alternative would require origin-state wiring for create/edit plus a return stack for subtable flows — machinery whose only payoff is deep-linking a transient task.

### Decisions (the three questions in #2604)

**D1 — Create + Edit surface: overlay, never a route.** The *size* of the overlay still follows the #2578 derivation — that is what makes create/edit "consistent with the shipped detail behavior" without copying its routing:

| `deriveRecordSurface(def)` | Detail (view) — shipped | Create / Edit — this design |
|---|---|---|
| `'page'` (field-heavy) | full-page **route** | **full-screen modal** (`size: 'full'`) — same big canvas, overlay return semantics |
| `'drawer'` (light) | drawer over the list | drawer/modal overlay, size `'auto'` |
| mobile (any) | page | full-screen modal |

i.e. one rule: *create/edit maps the derived `'page'` surface to a full-screen **modal**.* This is exactly why `'modal'` exists in the `RecordSurface` type. The route alternative for create/edit is **rejected** (see §8).

**D2 — Detail → Edit: the same edit overlay, opened over the detail route.** Not an in-place view↔edit mode. One edit surface everywhere (list-row edit, detail edit, subtable child edit) means one code path, one return contract, one thing to verify — the right shape for a zero-config platform where no human tunes divergent surfaces per object. Save/cancel closes the overlay back onto the detail view state — never anywhere else. In-place (field-level inline) editing is a valuable *orthogonal* enhancement, deferred, not rejected (§7).

**D3 — Subtable child create/edit: overlay over the parent detail. Never a route.** Confirmed as the issue recommends. The return target of a child task is *always* the parent detail with the subtable refreshed; a child route would discard the parent context (scroll, active tab) and force a return stack. The child overlay's size derives from the **child object's** own field count (a heavy child gets the full-screen modal, a thin child a drawer) — same rule as D1, applied to the child's definition.

---

## 3. Why not a route for create/edit — the argument, recorded

1. **Return is the invariant; deep-link is the nice-to-have.** Every flow in §4 must end back at its origin with context intact. Overlays satisfy this by construction. Routes satisfy it only with origin-state plumbing — which exists for detail ("← all records") but would need to grow a *stack* for parent → child → (lookup-create…) nesting.
2. **A create/edit URL is a false promise.** Refresh or share it and the draft is gone — the URL names the *task*, not the *state*. Deep-linking `/record/:id` (shipped) already covers the shareable thing.
3. **Browser-back is handled, not lost** (§4.4): the full-screen modal pushes one history entry so Back = close (with dirty guard). Users on a full-screen surface *will* press Back; that must not abandon the origin or silently drop a draft.
4. **Salesforce-shaped precedent:** record create/edit are modals over the origin; the record page is the route. Users' muscle memory matches D1.
5. **Zero authoring stays zero.** No `recordSurface`-like key, no return config. Per-object override remains the sanctioned pair: `navigation.mode` (explicit `page` forces routed create/edit for whoever truly wants it) and assigned Pages. ADR-0085 §2 is unchanged.

---

## 4. The return-flow contract

Three invariants, stated once, applying to every flow:

- **Cancel invariant.** Cancel / X / Esc / Back → overlay closes → the origin surface *exactly* as it was: scroll, filters, pagination, selected tab, drawer state. Nothing refetched, nothing written.
- **Save invariant.** *Edit never moves you; create takes you to the record you made; child tasks never leave the parent.* Precisely:
  - **Create (top-level):** overlay closes → navigate to the **new record's detail** on *its* derived surface. For a light object that is the drawer **over the still-intact list**; for a heavy object it is the detail route (which already carries the "← all records" origin affordance). Rationale: post-create work continues *on* the record — most immediately, populating its subtables, which per D3 happen over its detail. The record is also the immediate visual proof of what was saved.
  - **Edit (from anywhere):** overlay closes → **origin, refreshed** (detail → that detail refetched; list-row edit → the list refetched). Same position, same context.
  - **Child create/edit (subtable):** overlay closes → **parent detail untouched except the subtable refetches**. Never the child's own detail, never a route change. Parent scroll and active tab preserved.
- **Dirty guard.** Any close gesture (Esc, X, Back, cancel) on a form with unsaved changes asks for confirmation before discarding. Outside-click never closes a form overlay (full-screen modals have no outside; drawers/modals disable it for *forms* — read-only detail drawers keep it).

### 4.4 Browser history integration

- **Full-screen modal** (`size: 'full'`): opening pushes **one** history entry; Back requests close (dirty guard applies); after close (or save) the entry is consumed — Back again navigates the underlying route as normal. No URL change is rendered — the entry exists only to catch Back.
- **Drawer / non-full modal:** no history entry (standard overlay semantics — Esc/X close; Back navigates the underlying route, dirty guard still intercepts if the form is dirty).
- **Nested overlays** (child form over parent detail drawer, lookup "create new" over a form): each full-screen layer pushes its own entry; Back peels one layer at a time. This *is* the "return stack" — the browser owns it; we never persist one.

### 4.5 The flows, end to end

| # | Origin | Action | Surface (light / heavy child or record) | Cancel → | Save → |
|---|---|---|---|---|---|
| 1 | List | New | drawer / **full-screen modal** | list, untouched | **new record's detail** (drawer over list / route) |
| 2 | List row | Edit | drawer / full-screen modal | list, untouched | list, refetched, position kept |
| 3 | Detail (route or drawer) | Edit | overlay over it | detail view state, untouched | detail view state, **refetched** |
| 4 | Parent detail subtable | New / Edit child | overlay over parent (size from **child** def) | parent, untouched | parent; **subtable refetches**, tab + scroll kept |
| 5 | Any form | lookup "create new" | one more overlay layer | back to the form, field empty | back to the form, field filled with the new record |

Flow 5 is listed for completeness because it is the same primitive (a create task overlaying its origin) — it must not regress; its return target is the *form field*, not a detail page.

---

## 5. Implementation plan

### Step 1 — framework (`@objectstack/spec`, additive, unit-tested, independently mergeable)

Extend `packages/spec/src/data/record-surface.ts` with the flow-aware mapping, so the D1–D3 table is **one shared derivation** (ADR-0085 §5) instead of a convention each renderer re-implements:

```ts
export type RecordFlow = 'view' | 'create' | 'edit' | 'child-create' | 'child-edit';

export interface RecordFlowSurface {
  /** 'route' only ever for flow 'view'; every task flow is an overlay. */
  container: 'route' | 'overlay';
  surface: RecordSurface;              // 'page' | 'modal' | 'drawer'
  size: 'auto' | 'full';               // maps onto navigation.size / modalSize
}

export function deriveRecordFlowSurface(
  def: unknown,                        // the CHILD def for child-* flows
  flow: RecordFlow,
  opts?: RecordSurfaceOptions,
): RecordFlowSurface;
```

Mapping (pure, total): `view` → today's `deriveRecordSurface` verbatim (`'page'` ⇒ `container: 'route'`); `create`/`edit`/`child-*` → `container: 'overlay'`, with derived `'page'` ⇒ `{ surface: 'modal', size: 'full' }` and `'drawer'` ⇒ `{ surface: 'drawer', size: 'auto' }`; mobile ⇒ task flows get `{ 'modal', 'full' }`. Renderers treat the result as the **default only** — explicit `navigation.mode`/`size`, `FormView.type`/`modalSize`, or an assigned Page win, exactly as today.

Unit tests: threshold boundary × each flow, mobile override, child def independence, bare/un-parsed defs. Plus a changeset (minor, additive).

*No lint work:* nothing new is authorable, so there is nothing new to misauthor (the #2595 lints already steer `colSpan`→`span` etc.).

### Step 2 — objectui (consumes Step 1; one PR; browser-verified)

1. **Create/edit wiring** (`packages/app-shell/src/views/ObjectView.tsx` — the layer where #2578's detail wiring had to land to take effect in console): replace the hardcoded create/edit modal default with `deriveRecordFlowSurface(def, 'create' | 'edit', { viewport })`.
2. **Detail Edit button** → the same edit overlay over the detail route/drawer (D2); save → refetch detail.
3. **Subtable** (`RecordDetailView` related lists): child New / row Edit → overlay from `deriveRecordFlowSurface(childDef, 'child-*')`; on save close + refetch **only** the related-list query.
4. **Return + guards:** cancel/save per §4; dirty-guard on all close gestures; history entry for full-screen modals (§4.4).
5. Until objectui's pinned `@objectstack/spec` includes Step 1, mirror the helper locally with a `TODO` to re-import — same pattern #2578 used for `deriveRecordSurface` (and swap both together when the pin moves).

### Step 3 — browser verification (dogfood, blocking; the #2578 objects)

Using `app-showcase`: heavy = `field_zoo` (57 authorable fields), light = `product` (6); a parent with a `relatedList` child for flow 4.

- [ ] List → New (heavy): full-screen modal; **Cancel** → list scroll + filter intact; **Save** → new record's detail page; "← all records" returns to the original list state.
- [ ] List → New (light): drawer/modal; Save → detail drawer over the intact list.
- [ ] Detail → Edit (heavy + light): overlay over the detail; Cancel → view state untouched; Save → view state refetched (changed value visible).
- [ ] Parent detail → subtable New child → Save: parent never navigates; subtable shows the new child; active tab + scroll preserved. Same for child row Edit.
- [ ] Browser **Back** with a full-screen create modal open: modal closes (dirty guard if dirty), origin intact; Back again leaves the page normally.
- [ ] Esc / X with dirty form: confirmation appears; confirm-discard → cancel invariant holds.
- [ ] Mobile viewport: create/edit/child open full-screen; same returns.

---

## 6. What this deliberately does *not* add

- **No new spec keys.** `recordSurface`, `returnTo`, `afterSave`, per-object return config — all fail ADR-0085 §2 (machine-inferable and/or page-scoped). The derivation *is* the config.
- **No new ADR.** Same reasoning as #2578: the whole design lives inside ADR-0085's boundary (derived default + assigned-page/`navigation.mode` override). This document + the changeset are the record.
- **No return stack persistence.** The browser history is the stack (§4.4).

## 7. Non-goals / deferred (not rejected)

- **In-place (field-level inline) detail editing** — orthogonal to surfaces/returns; revisit when dogfood demands it.
- **"Save & New"** bulk-entry affordance on the create modal — additive later; thin-child bulk entry already has `inlineEdit: 'grid'`.
- **Draft persistence across refresh** for open forms — separate feature; until then the refresh-loses-draft boundary is accepted and is one more reason create/edit are not routes.
- **`inlineEdit` in-form child grids** — already atomic inside the parent form; unaffected here.

## 8. Alternatives considered

- **Create/edit as routes (`/new`, `/record/:id/edit`)** — rejected: pays origin-state + return-stack wiring to deep-link a transient task whose URL is a false promise (§3). Anyone who genuinely wants it can set `navigation.mode: 'page'` — the escape hatch already exists and stays.
- **In-place edit mode for D2** — deferred (§7): a second edit surface with its own return semantics; the modal reuses the one already required for D1/D3.
- **Stay-on-list after create-save (+ toast with a "view" link)** — considered; rejected as the *default* because the dominant post-create action on this platform is continuing on the record (filling subtables per D3), light objects keep the list visible anyway (drawer), and a toast link is a weaker affordance than being there. Revisit via dogfood if bulk create-from-list shows up as a real pattern.
- **Child create/edit as a route with a return stack** — rejected outright (the issue's own analysis): loses parent context, refetches the parent, and builds a stack the browser already provides.

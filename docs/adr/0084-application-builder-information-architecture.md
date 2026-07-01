# ADR-0084: Application-builder information architecture — four content pillars + Settings/Advanced

**Status**: Accepted (2026-07-01)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0077](./0077-authoring-surface-boundary-hook-flow-validation.md) (route authoring by intent + audience + verifiability — the hook/flow/validation boundary), [ADR-0033](./0033-ai-assisted-metadata-authoring.md) (draft-gated authoring), [ADR-0063](./0063-two-kernel-agents-skills-are-the-extension-primitive.md)/[ADR-0064](./0064-tool-scoping-to-agent.md) (two kernel agents — AI is a platform capability, not app metadata), [ADR-0080](./0080-ai-authored-ui-jsx-source.md)/[ADR-0081](./0081-trusted-react-page-tier.md) (the Interface pillar's page-authoring depth).
**Consumers**: `studio.app.ts` (the builder navigation), the Studio UI, `packages/cli/src/utils/format.ts` (`os` stats grouping), and the build agent (which surface authors which type).

**Premise**: ObjectStack has far more metadata types than Airtable's clean three, but the **application builder** — the surface a person (or the build agent) uses to *build an app* — must not expose all of them at one altitude, or it stops being learnable. Studio's current grouping is inconsistent (mixes Data with Interface, splits "Logic" from "Automation", scatters the rest). This ADR fixes the builder's information architecture, once, after a long design pass that repeatedly corrected itself. The core question it answers: **which metadata types are the app builder's job, at what altitude, and which belong to entirely different surfaces?**

> **Trigger**: an extended design conversation ("Airtable categorizes as Data / Automation / Interface — I have more types, how do I present them in the builder?"), which converged by successively ruling things in and out.

---

## TL;DR

1. **The app builder is for *building an application* — nothing else.** Running it (Operate) and the platform's own machinery (Platform) are different surfaces, different personas; they are **out of the builder entirely**, not deferred.
2. **Four visual content pillars** (Airtable's three plus the one it lacks): **Data · Automation · Interface · Access**. This is what a builder navigates.
3. **Each pillar's editor matches the pillar's natural shape**: Data = grid, Automation = canvas, Interface = builder/source, Access = matrix.
4. **Dashboards live in Interface** (Airtable-style: a dashboard is an interface surface of inline chart blocks). A separate **Analytics** pillar is a *future* split, gated on the reusable dataset/cube layer maturing — not a v1 concern.
5. **A Settings area** (distinct from the content pillars) holds **General** (the app's own basic info) and **Advanced** — the *technical tier* for developers.
6. **Advanced is unified by audience, not by "is it code."** It holds both **Code** (hooks now; functions, custom components, custom field types later) and **Connections** (datasources, connectors, webhooks, mappings — external data/systems). What unites them: technical, beyond visual authoring, developer audience. There is **no separate Integration tier** — connections are Advanced.
7. **v1 ships**: the four pillars + Settings(General + Advanced/**Hooks**). Everything else (the rest of Advanced, Analytics, Operate, Platform) is later or out-of-builder.

---

## The information architecture

```
Data · Automation · Interface · Access          ⚙ Settings
(four visual content pillars — for builders)      ├ General    the app's basic info
                                                  └ Advanced   the technical tier — for developers
                                                     ├ Code         hooks (v1) · functions · custom components · custom field types
                                                     └ Connections  datasource · connector · webhook · mapping   (later)

Out of the builder entirely (separate surfaces / personas):
  Operate   ship & run — packages · migrations · flow runs · audit · api keys
  Platform  the platform's own capabilities — AI (agent/tool/skill) · i18n · email & notification templates · settings · studio plugins
```

### The four content pillars (shape → editor)

| Pillar | Types (v1 core) | Natural shape | Editor |
|---|---|---|---|
| **Data** | object · field · validation | tabular | a live data **grid** (columns = fields, rows = real records) |
| **Automation** | flow · trigger · action · schedule | sequential | a flow **canvas** (trigger → steps) |
| **Interface** | app · page · view · form · dashboard · report | spatial | a **builder** (canvas + palette) or **source + preview** (html/react pages) |
| **Access** | role · permission · sharing | relational | a permission **matrix** (roles × objects × CRUD + record scope) |

Charts/metrics are **blocks** inside a dashboard/page bound inline to objects — they reuse the SDUI page renderer, so a dashboard is a page with chart blocks, not a separate subsystem.

### Settings

- **General** — the app's own identity and defaults: name, id, icon, description, branding, default landing, and the navigation structure. (This is the `app` definition; it is not one of the content pillars — it's *about* the app, not content *in* it.)
- **Advanced** — the technical escape hatch, sub-grouped **Code** and **Connections** (above). Kept visually separate from General so a builder who opens Settings for app info isn't dropped into code (ADR-0077: same area is fine, but different audiences get different groups).

---

## Principles the IA encodes

- **Two altitudes, one job.** Authoring the app (the four pillars + Advanced) is the builder's job. Operating it and the platform beneath it are *different jobs, different people, different surfaces* — so they are not in the builder. The builder stays about building.
- **Shape → editor.** A pillar's data has a natural shape; its editor is that shape (grid/canvas/builder/matrix). This is what lets four different surfaces feel like one product.
- **Same renderer.** The builder manipulates the same live artifact the end user sees — edit a field on the real grid, style a page in a live preview, set a permission on the real matrix. This is also what makes AI authoring safe: the agent edits the same flat, explicit metadata a human does.
- **Audience routing (ADR-0077).** Visual/declarative → the four pillars (builder audience). Code and connections → Advanced (developer audience). AI → not here at all (platform capability).
- **Primary home + secondary surface for cross-cutting types.** A type is authored in one place and its *result* may appear elsewhere — e.g. a **datasource** is authored in Advanced › Connections, and the external objects it exposes appear in **Data** (with an "external" badge). No type is authored in two menus.
- **Inline-by-default analytics.** A chart carries its query inline (self-contained); a **dataset** is an explicit opt-in only when the query can't be expressed inline (see #2502), and a dashboard filter is a dashboard variable broadcast to inline charts (see #2501). No implicit/auto-generated datasets — hidden linked entities are hostile to both humans and AI authoring.

---

## Consequences

- The builder is learnable in one glance: four content tabs shaped like their data, plus Settings. Airtable users transfer instantly (Data/Automation/Interface), and the one addition (Access) is obvious.
- The build agent gets a canonical "this type is authored on this surface" map, and a rule that keeps it out of code (Advanced) and off the platform's turf.
- Deferred and out-of-builder concerns have homes that don't distort the builder: Advanced (technical), Operate/Platform (separate surfaces).
- **Cost**: reconciling Studio's current nav (`studio.app.ts`) and the `os` stats grouping to this IA; and drawing the exact edges of "inline vs dataset" (#2502) and the dashboard-filter mechanism (#2501), tracked separately.

## Alternatives considered

- **Six flat pillars** (Data/Automation/Interface/Access/AI/Integration). Rejected — conflates authoring with a platform capability (AI) and a technical concern (Integration), and buries the differentiators as peers.
- **Analytics as a top-level pillar in v1.** Rejected — premature; dashboards are Interface surfaces (Airtable-style) until the reusable dataset/cube layer justifies a split.
- **Integration as its own tier/area.** Rejected — connections are technical, developer-audience, beyond visual authoring → they *are* Advanced.
- **AI as a builder pillar/tab.** Rejected — agent/tool/skill are the platform's capability (build/ask), not metadata *in* the app being built.
- **Operate / Platform inside the builder.** Rejected — different personas and moments; they're separate surfaces, not deferred builder tabs.
- **A bare "Advanced" top-level tab.** Rejected — the app also needs a home for its basic info; folding Advanced under **Settings** gives code a non-intimidating, expected home and reserves Settings for the deferred technical concerns.
- **Implicit auto-generated datasets behind inline charts.** Rejected — hidden linked state; two entities per intent; sync burden; violates the flat/explicit/local property that keeps AI authoring safe.

Related issues: #2501 (dashboard-level filters), #2502 (inline-vs-dataset expressibility rule).

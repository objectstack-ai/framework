# ADR-0049: Semantic-reference metadata embeds in package documentation — the author supplies a name, the platform supplies the component

**Status**: Proposed (2026-06-13)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0046](./0046-package-docs-as-metadata.md) (package docs as flat `src/docs/*.md` → `doc` metadata; §3.4 reserves semantic links, §3.5 "derived content is rendered, never written"), [ADR-0025](./0025-plugin-package-distribution.md) (the trust boundary third-party content must not cross), [ADR-0033](./0033-ai-assisted-metadata-authoring.md) (AI as primary author)
**Consumers**: `@objectstack/spec` (doc link grammar, no schema change in P1), `@objectstack/cli` (publish lint — link parse only), `../objectui` (`plugin-markdown` renderer; read-only embeddable metadata-view components), `@objectstack/console` (`/docs/<name>` route hosts the resolved embeds)
**Related**: [ADR-0037](./0037-live-canvas-draft-preview.md) (live metadata rendering), [ADR-0026](./0026-client-ui-plugin-distribution.md) (client UI plugin distribution — the renderer side)

---

## TL;DR

ADR-0046 made package documentation a metadata element — flat
`src/docs/*.md`, sanitized Markdown, **MDX banned** because MDX is code and
rendering publisher-supplied code inside the platform origin crosses the
ADR-0025 trust boundary. It also left a door open: §3.4 reserves
**semantic links like `object://crm_lead` that "renderers resolve"**, and
§3.5 insists a diagram of an existing flow is *derived* metadata — rendered
live from the source of truth, never hand-drawn and committed.

This ADR specifies what walks through that door: how a doc author writes
"show the lead-routing flow here" **without** re-opening the MDX trust
boundary.

The whole design turns on one inversion:

> **The author supplies only a NAME (data). The platform supplies the
> COMPONENT (code).**

This is the exact opposite of embedding author-written MDX or SDUI
component code, where the author ships the *thing that renders*. Here the
author ships a string — `flow://crm_lead_routing` — and the platform, not
the package, decides what component resolves it, with what props, under
whose permissions. A name is inert data; a sanitizer already trusts it. The
component is first-party code the platform already ships and already trusts.
The trust boundary never moves.

```md
The lead-routing flow assigns by territory, then by round-robin:

flow://crm_lead_routing

…and the qualification rules live on the lead object itself:

object://crm_lead
```

Each protocol link resolves — renderer-side — to a **read-only,
permission-scoped** projection of that one metadata item. No "run this flow"
button. No author-supplied props. No data binding the author controls. A
picture of the source of truth, rendered live, by code the platform owns.

## 1. Context

- **The gap ADR-0046 named but did not fill.** §3.4 reserved
  `object://<name>` as "syntax renderers may resolve later; v1 lint only
  requires it parses." §3.5 ruled that a flow diagram of an existing flow
  is derived content that *must* be rendered live, never written by hand.
  Put together, those two clauses describe a feature — live metadata embeds
  in docs — without specifying it. This ADR is that specification.

- **Why authors will reach for this.** A package's prose constantly wants
  to *point at the thing it documents*: "here is the approval chain," "this
  is the pipeline dashboard," "these are the fields on the account object."
  Today the author's only honest options are (a) prose that describes the
  flow and rots the day the flow changes, or (b) a screenshot that rots
  faster and leaks nothing the platform can keep current. Both violate the
  spirit of §3.5. What the author actually wants is a *reference*, resolved
  live — the same instinct that makes `[lead guide](./crm_lead_guide.md)` a
  link instead of a copy-paste.

- **Why the naïve answer is forbidden.** The obvious way to "embed a
  component in a doc" — let the author write the component — is precisely
  what ADR-0046 §3.4 and ADR-0025 ban. MDX is code. SDUI is *worse than*
  MDX for this purpose: an SDUI node isn't just markup, it binds **actions,
  data sources, and server calls**; an author-supplied SDUI tree is an
  author-supplied program with a network surface, executing inside the
  platform origin against the viewer's session. Permitting either would
  mean a third-party package ships code that runs in the first-party trust
  context. No.

- **The renderer is ready to be extended, not rewritten.** `plugin-markdown`
  in objectui already renders sanitized Markdown on `react-markdown` +
  `rehype-sanitize`, recently extended with heading anchors, code
  highlighting, and GitHub alerts. A protocol-link resolver is the same
  shape of extension: intercept a specific node, render a first-party
  React component, never widen the sanitizer to admit author HTML/JS.

- **The source of truth already exists in the manifest.** A `flow://`
  embed has nothing to *fetch from the author* — the flow is already a
  metadata item in the same package (or a dependency). The embed is a
  projection of data the platform already holds and already governs with
  `sys_package_grant` and per-object RLS. That is what makes this cheap and
  safe: there is no new data, no new authority, only a new *view* onto
  existing governed data.

## 2. Goals & Non-goals

### Goals

- A spec'd extension of ADR-0046 §3.4's protocol-link family —
  `flow://`, `view://`, `dashboard://`, `object://` — with a single,
  uniform resolution rule.
- A precise statement of the **two security guardrails** (read-only +
  permission-scoped; cross-package degrade-to-notice) that let third-party
  prose embed live first-party components without crossing the trust
  boundary.
- A one-line **boundary statement** distinguishing the three cases an
  author will hit: in-metadata reference (this ADR), not-in-metadata
  conceptual diagram (Mermaid, deferred), author-written component code
  (never).
- A phasing that names its hard dependencies honestly: this is **P3+** on
  ADR-0046's roadmap and cannot start until two unbuilt layers exist.

### Non-goals

- **Author-supplied interactivity of any kind.** No props, no event
  handlers, no "embed this view but make it editable," no parameterized
  queries supplied by the doc. An embed is a fixed, read-only projection.
  Interactivity, when a doc needs it, comes from the platform pointing the
  reader *out* to the real surface (a `/docs` link to the live view), never
  from running author logic inline.
- **Conceptual / not-yet-real diagrams.** "Here's how an approval *could*
  flow" — where no `flow` metadata item exists — is not a reference. That
  is Mermaid (or similar text-described diagrams), explicitly deferred to a
  later ADR (§3.4 boundary, §5).
- **Rich media / images.** Still banned per ADR-0046 §3.4(2) until the
  asset service lands. A metadata embed is *not* an image — it is a live
  component — so it is not subject to the image ban, but neither does it
  relax it.
- **A new metadata element or schema.** Embeds are syntax inside an
  existing `doc.content` string; the `DocSchema` does not change. The new
  surface area is entirely renderer-side plus a lint rule.

## 3. Design

### 3.1 Syntax — extend the §3.4 protocol-link family

An embed is a **Markdown-native link** whose URL uses a metadata protocol
scheme and whose target is a bare metadata name:

```md
flow://crm_lead_routing
view://crm_lead_pipeline
dashboard://crm_sales_overview
object://crm_lead
```

Grammar: `<scheme>://<name>` where `<scheme> ∈ {flow, view, dashboard,
object}` and `<name>` matches the metadata-name rule
(`^[a-z][a-z0-9_]*$`, namespace-prefixed, exactly as ADR-0046 §3.2). The
scheme selects the metadata *type*; the name selects the *item*. There is no
third coordinate and no query string — **no place to put author props**,
which is the point.

Why a link, specifically:

- **Markdown-native → graceful degradation.** On GitHub, in any editor
  preview, in any renderer that has *not* learned this scheme, the embed
  renders as an ordinary (inert) link. Nothing breaks; the reader sees a
  recognizable reference token. Contrast a custom fenced block or an HTML
  tag, which degrade to raw noise.
- **Lint stays trivial.** Publish lint already walks links (ADR-0046 §3.3).
  A protocol-scheme link is just another link shape to recognize; **P1 lint
  only requires the URL parses** — same posture §3.4 set for `object://`.
  Lint does *not* resolve the target against metadata (that would couple
  prose validation to the full metadata graph); an embed that points at a
  missing item is a *render-time* "not found," not a publish blocker (§3.3
  guardrail b).
- **Reference shorthand.** Authors and AI already think in metadata names
  (ADR-0033). `flow://crm_lead_routing` is the same act as
  `[guide](./crm_lead_guide.md)` — name a thing, let resolution happen
  downstream.

A link with explicit text (`[the routing flow](flow://crm_lead_routing)`)
is permitted and renders the embed with that text as its caption/heading; a
bare autolink renders with the item's own label. Either way the author
controls *only the caption string*, never the component.

### 3.2 Resolution — the platform supplies the component

When `plugin-markdown` encounters a node whose URL scheme is a metadata
protocol, it does **not** emit an `<a>`. It resolves the link to an embedded
**read-only `SchemaRenderer`** scoped to exactly that one metadata item:

```
flow://crm_lead_routing
   → <SchemaRenderer
        type="flow" name="crm_lead_routing"
        mode="readonly" embedded
        // NO props from the document. None.
     />
```

The contract, stated as invariants:

1. **The author supplies the name; the platform supplies everything else.**
   The component, its props, its data source, its permission check — all
   first-party, none reachable from `doc.content`. The author's entire
   influence is the `(scheme, name, caption)` triple, all inert data.
2. **One item, scoped.** An embed renders *that* metadata item and nothing
   adjacent — a `flow://` embed is the flow's read-only diagram, not a
   canvas wired to siblings; an `object://` embed is that object's field
   dictionary / summary, not a record list. The projection is fixed per
   type (§3.2.1).
3. **No author-supplied props, ever.** This is the load-bearing invariant.
   There is no syntax to pass a prop precisely so there is no channel to
   pass behavior. (Compare SDUI, whose entire value proposition is
   author-supplied props that bind data and actions — the thing we are
   refusing.)

#### 3.2.1 Per-scheme projection (all read-only)

| Scheme | Resolves to | Read-only projection |
|:--|:--|:--|
| `flow://` | a `flow` item | Flow **viewer**: the node/edge diagram, non-interactive — no run button, no node inspector that triggers execution. A picture of the flow. |
| `view://` | a `view` item | View **preview**: the list/kanban/calendar *chrome* with the viewer's own permitted data, read-only — no inline edit, no row actions, no create. |
| `dashboard://` | a `dashboard` item | Dashboard **preview**: charts/tiles rendered against permitted data, read-only — no drill-through that mutates, no filter persistence. |
| `object://` | an `object` item | Object **summary**: field dictionary, key relationships, governing validations — the §3.5 "derived metadata view," rendered live. |

Each projection is a *narrower* mode of a component the platform already
owns (or will own, §4). "Read-only embedded" is a rendering mode, not a new
component family — which is why the security story reduces to "the platform's
own renderer, with interactivity disabled, scoped to one item."

### 3.3 Two security guardrails

These are the load-bearing clauses — they are *why* a third-party doc may
embed a live first-party component without crossing the ADR-0025 boundary.

**(a) Read-only and permission-scoped — a non-interactive projection
resolved against the current viewer.**

- **Read-only / non-interactive.** An embed never carries an action
  surface. There is no "run this flow," no "edit this record," no "save
  this filter" *inside a doc*. The doc is a place to *understand* a metadata
  item; acting on it happens on the real surface, which the platform links
  to (`/docs` → the live view), never embeds-with-actions. This removes the
  entire class of "a third-party doc tricked the viewer into invoking
  something" — there is nothing to invoke.
- **Permission-scoped, against the current viewer.** The embed resolves
  under the viewing user's permissions *and* the same `sys_package_grant`
  that delivered the package's docs (ADR-0046 §3.6). Two consequences: (1) a
  viewer who cannot see `crm_lead_routing` sees a "not available" placeholder
  where the embed would be — the embed grants **no** authority the reader
  lacks; an embed is never an access-control bypass. (2) The data inside a
  `view://`/`dashboard://` preview is *the viewer's own permitted rows* under
  RLS, never the author's — a doc cannot exfiltrate data by embedding a view
  over records the reader can't otherwise see.

**(b) Cross-package references degrade to a "not found" notice — never
couple into install-time dependency resolution.**

- An embed may name an item in a dependency package (just as ADR-0046 §3.3
  lets a doc *link* across packages). If that item is absent at render
  time — dependency not installed, item removed in a later version, name
  typo — the renderer shows an inline **"referenced &lt;type&gt; not found"**
  notice in place of the embed. It does not throw, does not blank the doc,
  does not retry.
- Critically, **embed integrity must not become an install-time
  dependency.** A package does not fail to install because one of its docs
  embeds a flow that a dependency later renamed. This mirrors §3.3's
  explicit rule for cross-package *links* ("link integrity must NOT couple
  into install-time dependency resolution — that would be over-design for
  prose") and extends it verbatim to embeds. Prose pointing at a thing that
  moved is a soft, render-time degradation, not a hard, install-time fault.

### 3.4 Boundary clarity — three cases, one line

Authors will hit exactly three situations when they want a picture in a doc.
The rule, on one line:

> **In metadata → live reference embed (this ADR). Not in metadata,
> conceptual → Mermaid (deferred). Author-written component code →
> never.**

Expanded:

| Case | The author wants… | Mechanism | Status |
|:--|:--|:--|:--|
| **Reference** | to show a flow/view/dashboard/object that **exists** as metadata | `flow://`/`view://`/`dashboard://`/`object://` — platform renders it live, read-only | **This ADR** |
| **Concept** | to sketch a flow/architecture that is **not** (yet) a metadata item | Mermaid / fenced text-diagram — pure data, sanitizer-safe, but *not* a live reference | **Deferred** (separate ADR; noted here only to draw the line) |
| **Component** | to ship hand-written interactive UI (MDX/SDUI/iframe) | — | **Never** (ADR-0046 §3.4, ADR-0025) — §4 |

The middle case (Mermaid) is deliberately *out of scope* here but named, so
the boundary is unambiguous: a conceptual diagram is text the author writes
and the sanitizer trusts as data; a reference embed is a name the author
writes and the platform resolves to first-party code. Both keep the trust
boundary intact; they are different features with different ADRs. The third
case is the line neither crosses.

### 3.5 Derived-content alignment (ADR-0046 §3.5)

Every embed is, by construction, a §3.5 **derived metadata view**: it is
reconstructed live from the source of truth and never committed. The
`flow://` viewer is the canonical example §3.5 gestured at — "a flow diagram
of an existing flow is derived metadata, must be rendered live from the
source of truth, never hand-drawn and committed." This ADR makes that
gesture executable: the author writes a reference, the platform renders the
derivation. A committed screenshot of the same flow remains forbidden — it
is the cache-in-git §3.5 rejects.

## 4. Alternatives considered

| Alternative | Verdict |
|:--|:--|
| **Inline SDUI component JSON** (author writes a server-driven-UI node tree in the doc) | **Rejected — worse than MDX.** An SDUI node is not markup; it binds **actions, data sources, and server calls**. An author-supplied SDUI tree is an author-supplied *program with a network surface* executing in the platform origin against the viewer's session — the exact ADR-0025 violation, amplified. The whole inversion of this ADR (author supplies a *name*, platform supplies the *component*) exists to refuse this. |
| **MDX / author-written React components** | **Rejected — re-litigated and reaffirmed from ADR-0046 §3.4.** MDX is code; rendering publisher-supplied code inside the platform origin crosses the trust boundary. A reference embed gives authors the one thing they actually wanted from MDX (a live picture of a metadata item) without the code. |
| **Author-supplied `<iframe>`** | **Rejected.** Punts the trust problem to "another origin" but keeps every hazard: the author controls the embedded surface (clickjacking, phishing chrome, off-platform data exfiltration, unversioned drift), and the frame can't be permission-scoped to the viewer the way a first-party `SchemaRenderer` is. The sanitizer drops it today; it stays dropped. |
| **Custom fenced block** (` ```osembed ` … ` ``` `) instead of a link | Rejected as the syntax. A non-link token degrades to raw noise in GitHub/editor preview and needs a bespoke lint path. A protocol-scheme *link* degrades to an inert link and reuses the existing link-lint walk (§3.1). Same resolution, strictly better degradation. |
| **Resolve embeds at publish/build into baked HTML** | Rejected. Baking freezes the projection at publish time — it rots exactly as §3.5 warns, and it bakes *the author's* permission view, not *the viewer's*, breaking guardrail (a). Embeds must resolve at render time, per viewer. |
| **Lint resolves every embed target against metadata at publish** | Rejected. Couples prose validation to the full cross-package metadata graph and turns a renamed dependency item into a publish blocker — the over-design §3.3 explicitly refuses. Parse at publish, resolve (and degrade) at render (§3.3b). |

## 5. Phasing

This is **P3+** on ADR-0046's roadmap (its §5 P3 "enrichment, all
additive"). It has two hard prerequisites, neither built today, and the
phasing is honest about them.

| Phase | Scope | Depends on |
|:--|:--|:--|
| **Prereq A** (spec/cli) | The §3.4 **semantic-link resolution layer**: the renderer-side machinery that recognizes a `<scheme>://<name>` link, maps scheme→type, and looks the item up by name under viewer permissions + grant. ADR-0046 reserved the *syntax*; **this layer is not built**. | ADR-0046 P1/P2 |
| **Prereq B** (objectui) | **Read-only embeddable metadata-view components**: a flow viewer, a view preview, a dashboard preview, an object summary — each a narrowed read-only mode usable *inline inside the Markdown renderer*, not just on its own full-page route. **Not built.** | ADR-0026, ADR-0037 |
| **P3a** (lint) | Publish lint recognizes the protocol-link family and requires it *parses* (no metadata resolution). Bare `object://`/`flow://`/`view://`/`dashboard://` links stop being "reserved, parse-only" and become "a known embed shape." | Prereq A |
| **P3b** (renderer) | `plugin-markdown` intercepts protocol-scheme link nodes → renders the read-only `SchemaRenderer` projection (§3.2.1), with guardrail (a) permission-scoping and guardrail (b) not-found degradation. | Prereq A, Prereq B |
| **P3c** (authoring + AI) | Authoring affordance (Studio doc editor offers "insert reference to a flow/view/…"); AI authors embeds when documenting an existing item (ADR-0033) — it already knows the names. | P3a, P3b |
| **Deferred (separate ADR)** | Mermaid / conceptual text-diagrams (§3.4 middle case) — different feature, different trust analysis (author-written *data*, no metadata resolution). Named here only to fix the boundary. | — |

Until Prereq A and Prereq B land, the protocol-link syntax remains exactly
what ADR-0046 §3.4 left it: reserved, parse-only, degrading to an inert link.
This ADR changes nothing in the running platform on its own — it specifies
the contract the two prereq layers must satisfy when they are built, so they
are built *toward* a trust-preserving embed rather than discovering the
boundary after the fact.

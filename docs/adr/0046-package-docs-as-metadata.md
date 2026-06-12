# ADR-0046: Package documentation as metadata — `src/docs/` compiled into the manifest, derived content rendered not written

**Status**: Proposed (2026-06-12)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0003](./0003-package-as-first-class-citizen.md) (package + versioned releases), [ADR-0016](./0016-studio-package-authoring-and-publish.md) (publish pipeline, `manifest_json` snapshot), [ADR-0019](./0019-app-as-consumer-unit.md) (App is the only consumer-facing unit), [ADR-0025](./0025-plugin-package-distribution.md) (artifact distribution, trust boundary), [ADR-0033](./0033-ai-assisted-metadata-authoring.md) (AI as primary author)
**Consumers**: `@objectstack/spec` (manifest `docs` element), `@objectstack/cli` (collection, publish lint, `os docs lint|verify`), `@objectstack/console` (help center, contextual help, metadata views), cloud control plane (registry rendering, grants — implementation design lives in the cloud repo), `@objectstack/core` (kernel skips `docs` at load)
**Pilot**: `os-tianshun-mtc` (delivery project; repo layout + authoring conventions validated there first)

---

## TL;DR

A package today carries every behavioral fact about itself — objects,
fields, validations, flows, permissions — but not one sentence of *intent*:
what it is, how its users operate it, how its admins run it. That prose
lives in ad-hoc repo trees, wikis, and static sites that rot the moment
metadata changes, and reaches customers through channels (file shares,
hosted sites) that duplicate the registry's versioning and access control.

This ADR makes documentation a **metadata element**. Markdown under
`src/docs/` compiles into the manifest exactly like objects and views do;
the registry, console, and in-app AI assistant render it from there. Two
disciplines keep it honest:

1. **Derived content is rendered, never written.** Field dictionaries,
   permission matrices, validation lists, state-machine tables are *views
   of metadata* — the platform renders them live; they must not exist as
   authored or generated files. The only legitimate generation is a
   **frozen export** (e.g. a confirmation PDF) bound to a released version.
2. **Docs bind to what they change with.** Repo layout separates four
   lifecycles: `src/` (ships with the package), `delivery/` (bound to one
   customer's contract, never ships), `internal/` (engineering notes,
   never ships), plus root `CHANGELOG.md` (collected at publish).

```
src/docs/                      compiled into manifest.docs
├── meta.json                  {"pages": ["index", "user", "admin"]}
├── index.md                   what this package is        (floor: required)
├── user/
│   ├── meta.json              {"title": "...", "pages": ["lead", ...]}
│   └── lead.md …              how each role operates it
└── admin/ …                   how to run and configure it
CHANGELOG.md                   what changed per version    (floor: required)
```

---

## 1. Context

- The manifest schema (`packages/spec/src/kernel/manifest.zod.ts`) has a
  `description` string and nothing else documentation-shaped. ADR-0025
  defines how code and dependencies travel; nothing defines how *intent*
  travels.
- Pure-element packages publish as a single self-contained JSON
  (`dist/objectstack.json` → `sys_package_version.manifest_json`,
  ADR-0016). Anything added to the manifest therefore reaches the registry
  **with zero registry schema changes** — the cheapest possible v1.
- Delivery teams hand customers docs via static sites or files, rebuilding
  versioning (directories), identity (logins), and authorization (per-site
  auth) that the registry/grant system already provides. The cloud repo's
  publisher-catalog design (grants, share tokens) makes the duplication
  explicit: granting a package *should* grant its docs.
- Field-reference documents generated into git rot by construction: they
  are caches of a render. The pilot project shipped a 26-page generated
  dictionary and deleted it within a day once this principle was named.
- Going forward AI writes most documentation (ADR-0033 extends to prose).
  The scarce resource is no longer writing effort but a machine-checkable
  definition of "complete" and "too much".

## 2. Goals & Non-goals

### Goals

- A spec'd `docs` manifest element: collection rules, structure, syntax
  boundary, minimal set per package type.
- Repo layout convention separating the four documentation lifecycles.
- Platform rendering surfaces (registry page, console help center,
  contextual help, AI-assistant grounding) and their phasing.
- Quality gates that make AI authorship safe: coverage floor, bloat
  ceiling, fact-checking, usefulness evals.
- i18n model compatible with AI-derived translations.

### Non-goals

- **Delivery documents** (requirement traceability, solution confirmation,
  acceptance records). They bind to one contract, freeze at milestones,
  and must *not* auto-update with code. Convention: `delivery/`, outside
  the package. Their confirmation workflow is a cloud/process concern.
- **Standalone product documentation sites** (e.g. docs.objectstack.ai,
  docs.objectos.app). Those are websites; `content/docs/` remains their
  convention. Package docs are package source, not a website.
- **Internal engineering docs** (`internal/`, formerly `docs/` — renaming
  removes the perpetual "docs vs content/docs" ambiguity; the word *docs*
  appears in exactly one shippable path).
- Rich media. v1 is text-only by design (§5).

## 3. Design

### 3.1 Collection (one rule)

`src/docs/**/*.md` plus per-directory `meta.json` compile into
`manifest.docs`. Root `CHANGELOG.md` is collected at publish into the
version record. `src/` already means "everything here ships"; docs simply
join objects, views, and dashboards under that single boundary. The
kernel/plugin-loader **skips or lazy-loads** the `docs` section — manuals
must not occupy runtime memory.

### 3.2 Structure (closed set + explicit order)

- **First-level directory = docSet**, a *closed* enum: `index.md`
  (overview), `user/`, `admin/`. Closed means renderers know canonical
  order ("what it is → how to use → how to run") and display names without
  configuration, and AI cannot invent new trees.
- **`meta.json`** (subset of the Fumadocs convention — exactly two fields,
  `title` and `pages`) fixes ordering and directory titles. Absent →
  alphabetical. Page title = first `#` heading; optional frontmatter may
  override.
- Ordering deliberately lives in a dedicated, schema-validatable file. The
  alternatives each failed a long-term test: single-file-per-docSet mixes
  chapters and destroys diff locality; numeric filename prefixes break
  links on reorder; deriving order from `index.md` link order welds a
  machine contract onto human prose, so every copy-edit becomes a
  structure edit. **Structure and content stay physically separate** for
  the same reason `delivery/` is a directory and not a flag: separation
  beats convention, and a 3-line JSON the AI edits to reorder is a smaller
  blast radius than a prose file it must not accidentally reflow.

### 3.3 Syntax boundary (the two day-one prohibitions)

1. **Pure Markdown** (CommonMark + GFM; a small directive whitelist such
   as admonitions/mermaid may be added later). **MDX is forbidden**: MDX
   is code, and rendering publisher-supplied code inside the platform
   origin crosses the ADR-0025 trust boundary. Markdown is data; a
   sanitizing pipeline renders third-party packages safely.
2. **No image references in v1** (publish lint rejects `![](…)`).
   Binaries in the artifact bloat installs; arbitrary external URLs break
   version immutability (a confirmed v1.3 whose screenshots silently
   change is not confirmed) and leak customer UI data to unmanaged hosts.
   v2 introduces a platform **asset service**: content-addressed,
   immutable, unguessable URLs (`…/blob/sha256-…`); the CLI uploads local
   images at publish and rewrites references; packages keep containing
   text only. Enforcing the ban from day one means zero legacy cleanup
   when assets arrive.

Everything else — docSet declarations beyond the closed set, audience
config, binds — is **additive** and deliberately absent from v1. Only
rules that are expensive to retrofit (syntax, images) are mandatory now.

### 3.4 Derived content is rendered, never written

Anything reconstructible from the manifest — field dictionaries, option
lists, validation conditions, state-machine transitions, permission
matrices — is a **metadata view**: the console renders it live
(customer-readable schema browser, permission matrix view); the registry
renders what package pages need. It must not exist as hand-written prose
*or* as generated markdown committed to the repo (a cache in git, with a
cache's lifecycle). Handwritten docs reference metadata via semantic links
(`object://mtc_lead`) that renderers resolve; publish lint heuristically
flags field-table blocks in prose.

**The frozen-export exception**: at confirmation milestones a tool may
render metadata + docs into a versioned artifact (PDF) for signature.
Freezing is the requirement there; the export is produced once and never
maintained, so it cannot rot.

### 3.5 Minimal set per package type ("intent four-piece")

| Package type | Required | Rationale |
|:--|:--|:--|
| App (consumer-facing, ADR-0019) | `index.md`, `user/`, `admin/`, `CHANGELOG.md` | what it is / how to use / how to run / what changed |
| plugin / driver / connector | `index.md`, `CHANGELOG.md` | the "user" is a developer; `configuration` schema is already metadata and is rendered, not documented |

Enforced by `os package publish` lint once available (warn → block). Until
then it is the documented floor.

### 3.6 Distribution & rendering

- **v1 needs no registry change**: docs ride `manifest_json`; package
  visibility and `sys_package_grant` authorization apply to docs
  automatically — granting a package grants its documentation.
- Rendering surfaces, in expected delivery order:
  1. **Registry package page** renders `index.md` (the npm-README model)
     and CHANGELOG per version.
  2. **Console help center**: sidebar tree from directories + `meta.json`,
     markdown body, search. docSet is *not* a UI concept — users see
     "Help", one tree; the closed set only fixes order and (later)
     default visibility (`admin/` → org admins).
  3. **Contextual help (v2)**: pages may declare `binds:
     [object/view/flow]`; object pages get a "?" opening the bound
     chapter. `binds` also powers coverage lint and staleness nudges
     ("`mtc_lead` changed; its bound page didn't").
  4. **AI assistant grounding**: in-app agents answer "how do I…" from the
     package's own manual — same JSON the kernel loads. No UI required;
     likely the highest-frequency consumer of docs and a direct payoff of
     docs-in-manifest.

### 3.7 i18n: translations are derived-but-reviewed

- Single canonical source language per package. Translations are sibling
  files `<page>.<locale>.md`; one tree, one `meta.json`; renderers fall
  back to the source language.
- In the AI era translations are *derived content with a review gate*
  (lockfile model): generated by AI when the source changes, committed via
  reviewed PR. Each translation records the source content hash;
  `os docs lint` reports stale translations. Locale-directory mirrors are
  rejected — two trees and N copies of `meta.json` drift by construction.

### 3.8 Quality gates for AI authorship

The floor and ceiling are computable *because the software is metadata*:

| Gate | Mechanism | Tool |
|:--|:--|:--|
| Completeness (floor) | minimal-set check; `binds` coverage (every object/flow bound by ≥1 page); manifest **version-diff → docs impact checklist** the author must address item-by-item | publish lint / `os docs lint` |
| Bloat (ceiling) | derived-content ban (§3.4); **token budget** per package tracked like bundle size — docs share the agent context window, so size is a functional constraint, not style | `os docs lint` |
| Correctness | fact-check agent: extract verifiable claims ("approver is the sales director", "status X can only reach Y") and check them against the manifest; contradictions fail CI | `os docs verify` |
| Usefulness | Q&A eval: an agent that can see *only the docs* answers real user questions; failures are documentation gaps | `os docs verify` |

Humans review one thing only: **intent** — is the business context right.
Everything mechanical is gated by machines, which is the only arrangement
that scales when AI is the author (ADR-0033).

## 4. Alternatives considered

| Alternative | Verdict |
|:--|:--|
| Static doc sites per project (Pages/R2 + auth) | Right answer *without* a platform; duplicates registry versioning, identity, and grants when you have one. Acceptable only as a pre-§3.6 transition channel, retired afterwards. |
| Docs as separate artifact beside the code artifact | Justified only by size; text-only packages make it moot. Revisit with the asset service if ever needed (ADR-0025 already provides the multi-artifact path). |
| Generated reference markdown in-repo | A cache in git; rots by construction. Replaced by §3.4. Validated empirically on the pilot. |
| MDX / React components in docs | Code crosses the trust boundary; interactivity comes from renderer-side directives and metadata views instead. |
| `content/docs/` as the package-docs home | `content/` is the standalone-website convention (framework/cloud doc sites) and is role-empty for packages; package docs are package source → `src/docs/`. |
| Ordering via filename prefixes / single file / index-link order | See §3.2 — each fails reorder cost, diff locality, or prose/contract separation. |

## 5. Phasing

| Phase | Scope | Depends on |
|:--|:--|:--|
| **P0** (no platform change) | Repo conventions (`src/docs`, `delivery/`, `internal/`, CLAUDE.md authoring checklists) on pilot projects; optional transition static site | this ADR |
| **P1** (framework) | spec `docs` schema; `os build` collection; publish lint (minimal set, MDX/image ban); kernel skip | P0 |
| **P2** (cloud/console) | registry page rendering → help center → customer-readable metadata views (dictionary, permission matrix) → contextual help via `binds` | P1 |
| **P3** (quality) | coverage/budget lint, version-diff checklist, fact-check + Q&A eval (`os docs verify`) | P1, AI service |
| **P4** (enrichment) | asset service + images, audience filtering, frozen PDF export, i18n staleness tooling | P2 |

Project-side conventions (P0) are isomorphic to the P1 schema by
construction: when the compiler lands, pilot content migrates with zero
edits.

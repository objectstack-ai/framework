# ADR-0019: App as the Consumer-Facing Unit (Package ≡ App)

**Status**: Proposed
**Date**: 2026-05-31
**Deciders**: ObjectStack Protocol Architects
**Builds on**: ADR-0003 (Package as First-Class Citizen), ADR-0006 (Three-Layer Tenancy), ADR-0016 (Studio Package Authoring & Publish)
**Consumers**: `@objectstack/spec/kernel` (`manifest.zod.ts`, `plugin.zod.ts`, `package-registry.zod.ts`), `@objectstack/spec/cloud` (`marketplace.zod.ts`), `@objectstack/metadata`, the Console `marketplace` UI, the Studio publish flow, `docs/design/marketplace-publishing.md`

---

## Context

ADR-0003 made the **package** a first-class, versioned, immutable artifact
(`sys_package` / `sys_package_version` / `sys_package_installation`). That
solved identity, atomic upgrade, and rollback at the *control-plane* layer.
It deliberately said nothing about the **consumer mental model** — what a
non-developer sees, installs, opens, and removes.

Today that consumer model is muddy. The taxonomy exposed by
`manifest.zod.ts` is:

```
Package (ManifestSchema)            ← the unit of download / install / uninstall
├── type: plugin | app | driver | server | ui | theme | agent | objectql | module | adapter
├── namespace: exactly one per package (crm_account, crm_contact, …)
└── may contain: 0 apps (driver) | 1 app (typical) | N apps (suite)
```

and `package-registry.zod.ts` codifies it explicitly:

> **Package**: the unit of installation — a deployable artifact containing metadata.
> **App**: a UI navigation shell defined inside a package.
> A package may contain zero apps (driver), one app (typical), or multiple apps (suite).

The reference implementation, **HotCRM**, is the worst case of this: a
single `type: app` package that **aggregates 13 sub-plugins** (crm, finance,
marketing, products, support, hr, analytics, integration, community,
healthcare, real-estate, education, financial-services), each with its own
namespace and 30+ metadata types.

### The pain

A consumer who installs from the Marketplace has to reason about an abstract
**"software / package"** wrapper:

1. **What did I just install?** A package might be one app, or a navigation
   shell over nothing, or a suite hiding 13 sub-apps and a dozen namespaces.
   The noun "package" carries no promise about what appears in their nav.
2. **What does opening it mean?** "Open the package" is meaningless — you
   open an *app*. The thing you download and the thing you use have different
   names and a 1-to-N relationship.
3. **What does uninstall remove?** With a suite, removing the wrapper may or
   may not remove 13 namespaces' worth of objects and data. The blast radius
   is invisible at install time.

### What "the Apple model" actually is

The frequently-cited Apple model is **not** "a nice installer". Its defining
property is that **there is no user-visible container above the app**:

- The `.app` bundle you download **is** the thing you open **is** the thing
  you drag to the Trash. Download = open = uninstall, one noun.
- A `.app` bundle internally contains frameworks, helpers, resources, XPC
  services — but those are **implementation detail the user never sees or
  manages**.
- Apple deliberately has **no "suite that contains apps"**. Even iWork ships
  as three independent apps (Pages, Numbers, Keynote), each separately
  installable and removable. Microsoft Office's "suite that contains
  applications" is the *counter-example* — precisely the model users find
  heavy.

Our current "package may contain N apps" is the Office model. The pain above
is the Office model's pain.

### Benchmarking the consumer surface

| Platform | User-visible installable unit | Internal composition (hidden) | Has a "suite contains apps" layer? |
|---|---|---|---|
| Apple App Store | **App** | frameworks / helpers / XPC | **No** (iWork = 3 separate apps) |
| Salesforce | Managed Package / "App" tile | objects, classes, flows | Yes (AppExchange managed pkg) — known to confuse admins |
| ServiceNow | Application | tables, scripts | Yes |
| Shopify | **App** | embedded blocks, webhooks | **No** |
| iOS / Android | **App** | activities, services, libs | **No** |
| **ObjectStack today** | Package (any of 10 types) | plugins, objects | **Yes** (suite) — the pain |

The platforms with the cleanest consumer story (Apple, Shopify, mobile OSes)
all converge on the same invariant: **one user-visible noun — the App — and
no container above it.**

---

## Goals & Non-goals

**Goals**

- Collapse the consumer surface to **one noun: App**. Download = open =
  uninstall, with the same identity throughout.
- Make internal composition (plugins, modules, drivers, objects) an
  **implementation detail invisible to the consumer**, exactly like
  frameworks inside a `.app` bundle.
- Make **uninstall atomic and predictable**: removing an App removes
  everything it brought and nothing it didn't.
- Preserve developer composability — a single App may still be built from
  many internal plugins/modules.

**Non-goals**

- Changing the control-plane artifact model from ADR-0003
  (`sys_package` / `sys_package_version` / `sys_package_installation` stay).
  This ADR refines the *semantics and surfacing* of those rows, not their
  storage shape.
- Changing per-environment isolation (ADR-0002) or tenancy (ADR-0006).
- Removing platform-internal package types (`driver`, `server`, `ui`,
  `objectql`, …) as *engineering* concepts. They remain — they simply stop
  being a **consumer-installable** surface.

---

## Decision

### D1 — Package ≡ App at the consumer surface

The **App is the only consumer-facing unit**. The thing a user downloads,
opens, and uninstalls is exactly one App. The word "package" is retained as
an *internal / developer / control-plane* term (the ADR-0003 artifact), but
**never surfaced to consumers** in the Marketplace, Console, or install UX.

A Marketplace **listing is an App listing**. One listing → one App → one
install → one removable unit → one namespace.

### D2 — Internal composition is invisible (the bundle model)

An App is allowed to be built from many internal contributions — plugins,
modules, drivers, server gateways, themes, agents. These are the
**frameworks inside the `.app` bundle**: they ship *inside* the App, are
resolved and versioned *with* it, and are **never independently installed,
listed, enabled, or uninstalled by a consumer**.

Concretely, the manifest `type` enum splits into two tiers:

| Tier | Types | Consumer-installable? | Appears in Marketplace? |
|---|---|---|---|
| **Consumer unit** | `app` | Yes | Yes (as an App listing) |
| **Internal contribution** | `plugin`, `module`, `driver`, `server`, `ui`, `theme`, `agent`, `objectql`, `adapter` | No | No |

Internal-contribution packages may still be *published to a registry for
developers to depend on* (like npm libraries), but they are not a row a
tenant admin browses or clicks "Install" on. The consumer Marketplace filters
to `type: app` only.

### D3 — Suites fold into a single App (no aggregator above App)

The "package that contains N apps (suite)" shape is **removed from the
consumer model**. There is no user-visible container above an App.

A vertical solution that today aggregates many plugins MUST resolve to a
**single App** whose internal plugins are invisible — the chosen direction
for the HotCRM reference implementation (see *Migration*).

> A developer who genuinely wants to ship independent products ships them as
> **independent Apps** (the iWork route), each its own listing, install, and
> namespace. What they may **not** do is ship one wrapper that surfaces 13
> apps to the consumer.

### D4 — One App, one namespace, atomic uninstall

`manifest.namespace` is already 1-per-package. We elevate this to a hard
invariant of the consumer model: **one App = one namespace = one removable
unit.** Uninstalling an App removes its namespace's metadata and (per the
environment's data policy) its data, with no orphaned `crm_*` rows from a
half-removed suite. Uninstall is "drag to Trash": complete and predictable.

Internal contributions bundled in the App do **not** add consumer-visible
namespaces; they live under the App's single namespace (or under
platform-reserved `base`/`system`/`sys` when they are platform plumbing).

---

## Detailed design

### Manifest changes (`packages/spec/src/kernel/manifest.zod.ts`, `plugin.zod.ts`)

- Keep the existing `type` enum values (no breaking removal), but document the
  **two-tier split** in D2 on the field, and add a derived predicate
  `isConsumerInstallable(type) === (type === 'app')`.
- The Marketplace query layer (`marketplace.zod.ts` search + the Console
  `marketplace` UI) filters listings to `type: 'app'`. Internal-contribution
  types are resolvable as dependencies but not browsable.
- `CORE_PLUGIN_TYPES` is reframed in comments as *internal contribution
  kinds*, not "things a tenant installs".

### Registry semantics (`package-registry.zod.ts`)

- Rewrite the doc comment: the **App** is the unit of installation. A package
  of an internal-contribution type is a *dependency*, resolved transitively
  when an App that requires it is installed, and reference-counted so it is
  removed when no installed App still needs it.
- `InstalledPackageSchema` lifecycle (`installing → installed ⇄ disabled →
  upgrading / uninstalling`) is unchanged in shape; the consumer only ever
  *initiates* these transitions on `type: app` rows.

### Control-plane (ADR-0003) — unchanged storage, refined meaning

`sys_package` / `sys_package_version` / `sys_package_installation` keep their
schemas. Refinement: a `sys_package_installation` row that a *consumer*
created always points at a version whose manifest `type === 'app'`. Internal
contributions appear only as resolved dependencies inside the version's
`manifest_json`, never as a consumer-initiated installation row.

### Marketplace doc

`docs/design/marketplace-publishing.md` §2 (Package Taxonomy) and §6
(Publishing strategies for multi-plugin applications) are revised so that
"multi-plugin application" means *one App composed of many internal
plugins*, not *one suite exposing many apps*.

---

## Migration

### HotCRM (reference implementation) → fold into one App

Per the decision in this ADR's authoring session, HotCRM becomes **one App
named "HotCRM"** whose 13 sub-plugins are internal and invisible:

- Root `objectstack.config.ts` stays `type: 'app'` with a single
  consumer-facing namespace; the 13 plugins are declared as **internal
  contributions / dependencies**, not as separately-listed apps.
- The Marketplace shows **one** HotCRM listing. Installing it brings the full
  solution; uninstalling removes it cleanly.
- (Optional, later) If specific verticals (e.g. Finance) warrant standalone
  distribution, they graduate to **independent Apps** with their own listing
  and namespace — the iWork split — rather than living as a surfaced sub-app
  of a suite.

### Phasing

1. **P1 (docs, this ADR)** — establish the model; revise
   `marketplace-publishing.md` taxonomy.
2. **P2 (schema semantics)** — manifest two-tier documentation +
   `isConsumerInstallable` predicate; Marketplace query filters to `type: app`.
3. **P3 (HotCRM)** — refold HotCRM to a single App; verify atomic uninstall.
4. **P4 (registry)** — dependency reference-counting for internal
   contributions so they install/remove transitively with their owning App.

---

## Consequences

**Positive**

- One noun for consumers. "Install an app", "open the app", "delete the app"
  — same identity throughout, matching the model every non-developer already
  knows from their phone.
- Uninstall blast radius is knowable at install time: one App, one namespace.
- The platform keeps full internal composability; the simplification is at
  the *surface*, not the engineering layer.

**Negative / costs**

- HotCRM and any existing suite-style packages must be refolded (P3).
- "Publish a standalone plugin to a consumer" is no longer a path — plugins
  are either bundled into an App or published for *developers* to depend on.
  This is intentional but removes a (rarely-used, confusing) capability.
- The manifest `type` enum now carries a semantic split that the schema only
  partially enforces (a lint/validation rule, not a type-system guarantee).

---

## Alternatives considered

1. **Keep the suite model, improve the install UX.** Rejected: better
   wording does not fix a 1-to-N noun. The confusion is structural, not
   cosmetic — it is the Office model's inherent cost.
2. **Expose both "App" and "Suite" as first-class consumer units.** Rejected:
   reintroduces the container-above-app that this ADR exists to remove; users
   would again have to learn two nouns and an ownership relationship.
3. **Make every plugin a consumer-installable unit (npm model).** Rejected:
   pushes composition onto the consumer. Fine for developers, wrong for the
   "open it and it's an app" audience this ADR targets.

---

## Open questions

- **Data on uninstall.** Does removing an App hard-delete its namespace's
  data, soft-delete with a grace period, or export-then-delete? Likely an
  environment-level policy (ties into ADR-0002 isolation); to be specified
  separately.
- **Dependency sharing across Apps.** When two installed Apps bundle the same
  internal `module`, do they share one resolved copy (reference-counted) or
  each vendor their own? Reference-counting is assumed in P4 but the
  versioning/conflict rules need their own design.
- **Developer-facing registry.** Where internal-contribution packages are
  published for developers to depend on (separate channel? same registry with
  a `consumer-installable: false` flag?) is left to the Studio/registry design.

---

## References

- ADR-0002 — Environment-Per-Database Isolation
- ADR-0003 — Package as First-Class Citizen with Versioned Releases
- ADR-0006 — Three-Layer Tenancy (Organization, Project, Environment)
- ADR-0016 — Studio Package Authoring & Publish
- `packages/spec/src/kernel/manifest.zod.ts`, `plugin.zod.ts`,
  `package-registry.zod.ts`
- `packages/spec/src/cloud/marketplace.zod.ts`
- `docs/design/marketplace-publishing.md`

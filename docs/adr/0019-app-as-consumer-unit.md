# ADR-0019: App as the Consumer Unit & the Metadata/Code Plane Split

**Status**: Proposed (v2)
**Date**: 2026-05-31 (v1) / 2026-05-31 (v2 — same-day revision)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: ADR-0003 (Package as First-Class Citizen), ADR-0006 (Three-Layer Tenancy), ADR-0008 (Metadata Repository & Change Log), ADR-0009 (Execution-Pinned Metadata), ADR-0015 (External Datasource Federation), ADR-0016 (Studio Package Authoring & Publish)
**Consumers**: `@objectstack/spec/kernel` (`manifest.zod.ts`, `plugin.zod.ts`, `plugin-capability.zod.ts`, `package-registry.zod.ts`), `@objectstack/spec/cloud` (`marketplace.zod.ts`), `@objectstack/runtime` (`cloud/capability-loader.ts`, `cloud/kernel-manager.ts`, `cloud/artifact-kernel-factory.ts`), `@objectstack/objectql` (`registry.ts`), the Console `marketplace` UI, the Studio publish flow, `docs/design/marketplace-publishing.md`

> **v2 revision note** — v1 covered only **Axis A** (one consumer-facing
> noun, the App). v2 merges in **Axis B**: packages come in two categories —
> *metadata* (declarative, dynamically loaded into a live runtime) and *code*
> (references npm etc., compiled into the server build). These map to two
> runtime **planes** joined by a capability contract. v2 also adds the
> decision **"a consumer App must be pure metadata"**, relaxes the original
> D4 (one App is **not** strictly one namespace), and — per a grounded scan
> of the framework — records honestly that the capability contract this model
> leans on is **mostly unbuilt today** (§Consequences, §Open questions). The
> body integrates both axes rather than appending.

---

## Context

ADR-0003 made the **package** a first-class, versioned, immutable artifact
(`sys_package` / `sys_package_version` / `sys_package_installation`). That
solved identity, atomic upgrade, and rollback at the *control-plane* layer.
It deliberately said nothing about the **consumer mental model** — what a
non-developer sees, installs, opens, and removes — nor about the fact that
packages are not all the same *kind of thing*.

### Axis A — the consumer surface is muddy

The taxonomy in `manifest.zod.ts` exposes a **Package** that can be any of ten
`type`s and may contain *0, 1, or N apps* (a "suite"). `package-registry.zod.ts`
codifies it:

> **Package**: the unit of installation. **App**: a UI navigation shell
> *inside* a package. A package may contain zero apps (driver), one app
> (typical), or multiple apps (suite).

The reference implementation **HotCRM** is the worst case: one `type: app`
package **aggregating 13 sub-plugins** (crm, finance, marketing, …), each with
its own namespace. A consumer cannot tell what they installed, what "opening"
means, or what uninstall removes. This is the Microsoft-Office "suite contains
applications" model — and its inherent confusion.

### Axis B — packages are two different kinds of thing

A scan of the framework confirms a **physical** distinction, not a stylistic
one:

| | **Metadata package** | **Code package** |
|---|---|---|
| Contents | declarative metadata (objects, views, flows, formulas) | executable code; references `npm \| git \| url` via `PluginSourceSchema` (`plugin-runtime.zod.ts`) |
| Loaded by | artifact pulled into the kernel; for local dev, hot-reloaded live (`metadata-fs` chokidar → `registry.invalidate()`) | **compiled/bundled into the server build** (`packages/core/src/kernel.ts` `use()` at init) + boot-time dynamic `import()` (`runtime/src/cloud/capability-loader.ts`) |
| Takes effect | control-plane pointer swap → kernel rebuilt from new artifact (`kernel-manager.ts` `freshnessProbe`, ~10s) — **no code deploy** | requires a **server (re)build / restart** — cannot be added to a *running* server |
| Blast radius | one environment / tenant | the whole ObjectOS image (every tenant on it) |
| Operated by | consumer, self-serve | operator / deploy pipeline |
| Example | HotCRM ("metadata-only application") | a database driver, a protocol server |

This is the macOS distinction between **installing an App onto a running OS**
(no kernel rebuild) and a **system extension / DriverKit driver** that the OS
must incorporate, notarize, and provision at the system level. It is a physical
constraint, not a policy choice: only declarative metadata can be safely and
near-instantly applied to a shared multi-tenant runtime; executable code cannot
be injected into a shared server process without a (re)build.

### What "the Apple model" actually is

Apple's defining property is that **there is no user-visible container above
the app**: the `.app` you download *is* the one you open *is* the one you drag
to the Trash — one noun. Frameworks inside the bundle are invisible. Even iWork
ships as three independent apps, not a suite. Office's "suite of applications"
is the counter-example. Our current "package may contain N apps" is the Office
model, and Axis A's pain is the Office model's pain.

---

## Goals & Non-goals

**Goals**

- **Axis A**: collapse the consumer surface to **one noun — App**. Download =
  open = uninstall, same identity throughout.
- **Axis B**: make the metadata/code distinction a first-class, explicit axis,
  mapped to two runtime **planes** (hot/metadata vs build/code) joined by a
  **capability contract**.
- Make internal composition (plugins, modules, drivers) an **implementation
  detail invisible to the consumer**.
- Make consumer install/uninstall **self-serve, predictable, and free of code
  deploys** by constraining consumer Apps to the metadata plane.

**Non-goals**

- Changing the ADR-0003 storage shape (`sys_package*` rows stay). This ADR
  refines their *semantics and surfacing*.
- Changing per-environment isolation (ADR-0002) or tenancy (ADR-0006).
- Removing platform-internal package types (`driver`, `server`, `ui`, …) as
  *engineering* concepts — they remain; they simply stop being a
  consumer-installable surface.
- **Building** the unified capability registry / install gate. This ADR
  *specifies* the contract and names the gap; the implementation is phased and
  partly open (see §Open questions).

---

## Decision

### D1 — Package ≡ App at the consumer surface

The **App is the only consumer-facing unit**: the thing a user downloads,
opens, and uninstalls is exactly one App. "Package" is retained as an
*internal / developer / control-plane* term (the ADR-0003 artifact) but is
**never surfaced to consumers**. A Marketplace **listing is an App listing**.

### D2 — Internal composition is invisible (the bundle model)

An App may be built from many internal contributions — plugins, modules,
drivers, themes, agents — the *frameworks inside the `.app` bundle*. They are
**never independently installed, listed, enabled, or uninstalled by a
consumer**. The manifest `type` enum splits into two tiers:

| Tier | Types | Consumer-installable? | In consumer Marketplace? |
|---|---|---|---|
| **Consumer unit** | `app` | Yes | Yes (App listing) |
| **Internal contribution** | `plugin`, `module`, `driver`, `server`, `ui`, `theme`, `agent`, `objectql`, `adapter` | No | No |

The consumer Marketplace query filters to `type: app`. Internal contributions
may be published to a **developer/operator catalog** (a different surface), not
the consumer App Store.

### D3 — Suites fold into a single App (no aggregator above App)

The "package contains N apps (suite)" shape is **removed from the consumer
model**. A vertical solution that today aggregates many plugins MUST resolve to
**one App** whose internal plugins are invisible. A developer who genuinely
wants independent products ships them as **independent Apps** (the iWork
route), never as a wrapper that surfaces N apps.

### D4 — An App owns a set of namespaces; uninstall removes the set *(revised in v2)*

> **v1 said "one App = one namespace". v2 relaxes this.** Folding a suite
> (HotCRM has 13 namespaces) into one App would otherwise force a destructive
> rename of every object (`crm_account → hotcrm_account`). The runtime already
> supports it: `registry.ts` keys namespaces as
> `Map<namespace, Set<packageId>>` (multiple packages may share a namespace,
> and an App may span several).

An App **declares and owns a set of namespaces**. Uninstall is atomic over
*that set*: removing the App removes every namespace it owns and nothing it
does not. The consumer-facing promise is therefore "uninstall removes
**exactly this App's namespaces**", not "exactly one namespace". Blast radius
is still bounded and knowable at install time — it is just a set, not a
singleton.

### D5 — Two package categories = two runtime planes

```
┌─ BUILD / CODE plane ───────────────────────────────────────────┐
│  code packages (driver/server/…)  →  compiled into server build │
│  notarized + dependency-scanned + sandboxed; operator-managed    │
│  declares: provides: [ "sys.sql", "sys.blob", … ]                │
└───────────────────────────────┬─────────────────────────────────┘
                                │  capability contract (interface)
┌───────────────────────────────┴─────────────────────────────────┐
│  HOT / METADATA plane ──────────────────────────────────────────  │
│  metadata Apps  →  artifact pointer-swap, no code deploy          │
│  self-serve install/uninstall; consumer-facing                    │
│  declares: requires: [ "sys.sql" ]                                │
└───────────────────────────────────────────────────────────────────┘
```

The two planes are joined **only** through the capability contract (D7). A
code package never appears on the consumer surface; a metadata App never ships
code.

### D6 — A consumer App must be pure metadata

A package of `type: app` that is consumer-listed **must contain no executable
code and no `PluginSource` (`npm/git/url`) reference**. All code lives in
code-plane packages installed by operators/the platform. This is what makes
consumer install a pointer-swap with no deploy, and what makes declarative
auto-review of App listings tractable.

**Definition of "code" (the line D6 enforces):** code = a `PluginSource`
reference to an external runtime module (`npm/git/url`). The platform's own
**sandboxed declarative expression languages — formula, ObjectQL, flow /
approval / validation expressions, and agent prompt + declarative tool
bindings — are NOT code** for this purpose. HotCRM has abundant logic and
remains metadata-only. (Security caveat: see Consequence C-neg-4 — "pure
metadata" constrains what an App *ships*, not what it can *reach*.)

### D7 — Capability-by-reference is the contract between planes

A metadata App expresses every dependency on the code plane as an **abstract
capability requirement**, never as a concrete package or code reference:

- App manifest: `requires: ["sys.sql", "sys.blob"]` (abstract capability IDs).
- Code package manifest: `provides: ["sys.sql"]`.
- The runtime resolves `requires → provider` and **gates install**: an App may
  be installed in an environment only if the runtime image already provides
  every capability the App requires; otherwise install fails with a clear
  "capability not provisioned" error (operator action required).

This is the iOS-entitlement model: the App declares "I use SQL", the platform
provides the implementation; the App never ships HealthKit.

---

## Detailed design

### Grounding in what exists today (and what does not)

A scan of the framework shows the model is **partly already built on the
metadata plane and barely built on the contract**:

- **Hot/metadata plane — real on the pointer-swap level.** ADR-0003's
  `sys_package_installation` pointer swap + `kernel-manager.ts`
  `freshnessProbe` (default ~10s) already deliver "publish a new version →
  consumer sees it with **no code deploy**". *Caveat:* cloud is **not** a live
  in-place patch — the kernel is an immutable snapshot bound at cold-start; an
  update **evicts and rebuilds** the kernel on the next request. True live
  re-registration exists only for local dev (`metadata-fs` chokidar →
  `registry.invalidate()`). Cross-replica push is out of scope (ADR-0008).
- **Capability-by-reference — half-built and closed.**
  `runtime/src/cloud/capability-loader.ts` already implements
  `requires: ['ai','automation',…]` → dynamic `import()` of an npm provider →
  `kernel.use()`. **But** its `CAPABILITY_PROVIDERS` map is a **hard-coded,
  closed table in framework source** — a third party cannot register a new
  provider without editing the framework.
- **The rich capability contract is dead schema.**
  `plugin-capability.zod.ts` defines `provides / requires / implements` in
  detail, but **no runtime code resolves or enforces it**. The kernel resolves
  only a flat `.dependencies` string array; `validateSystemRequirements()`
  checks that services *exist*, not that capabilities are *satisfied*. The
  only real boot gate is `ExternalValidationPlugin` (ADR-0015), scoped to
  external datasources.

**Therefore D7's contract is, today, two disconnected half-mechanisms** (a
closed `CAPABILITY_PROVIDERS` table that *works* + a rich `provides/requires`
schema that is *inert*). Realizing this ADR means **unifying them into one
open capability registry with a generalized install/boot gate** — this is the
load-bearing wall and the real cost (see Phasing P4 and Open questions).

### Manifest / registry changes

- `manifest.zod.ts` / `plugin.zod.ts`: document the D2 two-tier split; add a
  predicate `isConsumerInstallable(type) === (type === 'app')`. Add an App
  validation rule enforcing D6 (no `PluginSource`; only declarative content)
  and D7 (`requires` lists abstract capability IDs only).
- `package-registry.zod.ts`: rewrite the doc comment — the **App** is the unit
  of consumer installation; code packages are operator-installed and
  reference-counted dependencies.
- `registry.ts`: an App registers a **set** of namespaces (D4); uninstall
  removes the set.

### Control plane (ADR-0003) — unchanged storage, refined meaning

`sys_package*` schemas stay. A *consumer-created* `sys_package_installation`
always points at a version whose manifest `type === 'app'` and is metadata-only
(D6). Code packages appear only as resolved capability providers baked into the
runtime image, never as consumer install rows.

---

## Migration

### HotCRM → fold into one metadata App (chosen direction)

- HotCRM becomes **one App** whose 13 sub-plugins are internal and invisible
  (D3). It **owns the set of namespaces** the 13 plugins use (D4) — no object
  rename required.
- It is **metadata-only** (D6). Any code it relied on (e.g. an integration
  driver) becomes a code-plane package the operator provisions; HotCRM declares
  the corresponding `requires` capabilities (D7).
- The Marketplace shows **one** HotCRM listing; install/uninstall is atomic
  over its namespace set.

### Phasing

1. **P1 (this ADR + docs)** — establish both axes; revise
   `marketplace-publishing.md` taxonomy.
2. **P2 (manifest semantics)** — two-tier `type`; `isConsumerInstallable`;
   App-purity (D6) and `requires`-shape (D7) validation; Marketplace filters to
   `type: app`.
3. **P3 (HotCRM)** — refold to a single metadata App owning a namespace set;
   verify atomic uninstall.
4. **P4 (capability contract — the hard part)** — unify the closed
   `CAPABILITY_PROVIDERS` table and the inert `provides/requires` schema into
   **one open capability registry**; generalize the boot gate (beyond
   `ExternalValidationPlugin`) into an **install-time capability gate** (D7);
   reference-count code-plane providers.

---

## Consequences

**Positive**

- One noun for consumers; install = open = uninstall, the model everyone knows
  from their phone.
- The metadata/code split formalizes a **real physical runtime boundary**, so
  the architecture matches how the system already behaves rather than fighting
  it.
- Consumer install/uninstall is a pointer-swap with **no code deploy** and a
  bounded, knowable blast radius (the App's namespace set).
- Declarative App listings make the **metadata fast-lane auto-reviewable**;
  code packages get the heavier notarize+scan+sandbox lane they need.
- Capability-by-reference (D7) keeps Apps decoupled from concrete providers and
  is **already partly implemented** (`capability-loader.ts`), lowering P2 cost.

**Negative / costs / risks**

- **C-neg-1 (load-bearing wall).** The capability contract D7 depends on is
  **mostly unbuilt**: a closed provider table plus a dead schema. P4 — unifying
  them into an open registry with a generalized install gate — is the dominant
  cost and risk of this whole ADR. Until P4 lands, "two planes joined by a
  capability contract" is partly aspirational.
- **C-neg-2 ("hot" overstated on cloud).** Cloud metadata changes are
  *evict-and-rebuild*, not live patches; multi-replica push is out of scope
  (ADR-0008); execution-pinned types (ADR-0009: flow/workflow/approval) mean an
  App with in-flight pinned executions does **not** uninstall perfectly
  cleanly. "Atomic uninstall" needs a defined policy for pinned in-flight work.
- **C-neg-3 (namespace-set, not singleton).** D4's relaxation keeps folding
  cheap but **weakens** the "blast radius = one namespace" simplification to
  "= a set this App declares". Tooling must surface the set at install time, or
  the predictability benefit is lost.
- **C-neg-4 (purity ≠ safety).** "Pure metadata" constrains what an App
  *ships*, not what it can *reach*: via `requires` it can still trigger
  arbitrary provider code. Real security rests on the **provider sandbox**, not
  on the App being "harmless". Auto-review of App listings must not be sold as a
  security guarantee on its own.
- **C-neg-5 (ecosystem bottleneck).** Restricting Apps to abstract capabilities
  means the **platform must curate/ship a provider for every capability Apps
  need**. Excellent for safety and UX, but it makes the platform vendor the
  bottleneck for ecosystem breadth — the same trade Apple made.
- **C-neg-6.** "Publish a standalone consumer plugin" ceases to exist as a
  path; plugins are either bundled into an App or published to the
  developer/operator catalog. Intentional, but a removed capability.

---

## Alternatives considered

1. **Keep the suite model, improve the install UX.** Rejected: a 1-to-N noun
   is a structural problem; wording cannot fix it.
2. **Expose both "App" and "Suite" as consumer units.** Rejected: reintroduces
   the container-above-app this ADR removes.
3. **Allow consumer Apps to carry code, downgrading trust per-App.** Considered;
   rejected in favor of D6. Allowing code on the consumer plane would force the
   notarize/sandbox/redeploy machinery onto the self-serve path and break the
   no-deploy install model — the very property that makes the consumer App
   Store work.
4. **Every plugin is a consumer-installable unit (npm model).** Rejected:
   pushes composition onto consumers; fine for developers, wrong for the
   "open it and it's an app" audience.

---

## Open questions

- **The unified capability registry (P4).** What is the open registration API
  for capability providers, the ID namespace for capabilities (`sys.sql` …),
  and the conflict/version-negotiation rule when two code packages provide the
  same capability? This is the keystone and is currently undesigned.
- **Install-time capability gate.** Generalizing `ExternalValidationPlugin`
  into "App requires X; this runtime image provides X?" — and the **operator
  provisioning flow** when it does not (the hidden operator dependency in an
  otherwise self-serve model).
- **Capability version negotiation.** When an App `requires: ["sys.sql@>=2"]`
  and the image provides `sys.sql@1`, what is the downgrade/refusal behavior?
- **Atomic uninstall vs pinned executions** (C-neg-2). Hard-delete,
  soft-delete with grace, or export-then-delete for an App's namespace set,
  given in-flight execution-pinned flows/workflows (ADR-0009).
- **Where does "code" stop being declarative?** D6 draws the line at
  `PluginSource`; edge cases (a formula that calls a server action that is
  code) need an explicit rule so App "purity" is checkable, not vibes.

---

## References

- ADR-0002 — Environment-Per-Database Isolation
- ADR-0003 — Package as First-Class Citizen with Versioned Releases
- ADR-0006 — Three-Layer Tenancy (Organization, Project, Environment)
- ADR-0008 — Metadata Repository & Change Log (hot-reload / replica scope)
- ADR-0009 — Execution-Pinned Metadata (uninstall vs in-flight work)
- ADR-0015 — External Datasource Federation (`ExternalValidationPlugin` boot gate)
- ADR-0016 — Studio Package Authoring & Publish
- `packages/spec/src/kernel/manifest.zod.ts`, `plugin.zod.ts`,
  `plugin-capability.zod.ts`, `plugin-runtime.zod.ts`, `package-registry.zod.ts`
- `packages/runtime/src/cloud/capability-loader.ts` (`CAPABILITY_PROVIDERS`),
  `cloud/kernel-manager.ts` (`freshnessProbe`), `cloud/artifact-kernel-factory.ts`
- `packages/objectql/src/registry.ts` (namespace registry)
- `packages/spec/src/cloud/marketplace.zod.ts`
- `docs/design/marketplace-publishing.md`

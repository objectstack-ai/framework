# ADR-0087: Metadata protocol upgrades are a two-sided contract — version handshake, deprecation pipeline, machine-readable change manifests

**Status**: Proposed (2026-07-04)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0059](./0059-third-party-backward-compatibility-gates.md) (layered backward-compat gates — this ADR is its consumer-facing sequel), [ADR-0078](./0078-no-silently-inert-metadata.md) (no declarable-but-unenforced metadata — the un-checked `engines.protocol` is exactly this class), [ADR-0025](./0025-plugin-package-distribution.md) (§3.2 `engines.protocol` / `engines.platform` compatibility ranges, §3.10 #3 protocol-first check order), [ADR-0049](./0049-no-unenforced-security-properties.md) (enforce-or-remove), [ADR-0054](./0054-runtime-proof-for-authorable-surface.md) (prove-it-runs)
**Consumers**: `@objectstack/spec` (protocol version constant + deprecation registry + change manifest), `@objectstack/cli` (`validate`, `doctor`, `migrate meta`), the runtime metadata loader (handshake), `@objectstack/create-objectstack` (scaffold stamps the protocol range), the Release workflow (RC window, manifest generation, upgrade-guide gate), and every third party consuming a published release
**Surfaced by**: recurring third-party breakage on protocol upgrades — the [#2035](https://github.com/objectstack-ai/framework/issues/2035) / [#2023](https://github.com/objectstack-ai/framework/issues/2023) class that motivated ADR-0059 — plus the observation that `PluginEnginesSchema.protocol` (`packages/spec/src/kernel/manifest.zod.ts`) is declared, documented, and **checked nowhere** in the codebase, so a version mismatch surfaces as an arbitrary downstream crash instead of a diagnosable handshake failure

---

## TL;DR

ADR-0059 fixed the **producer** side of protocol evolution: a breaking change can no
longer leave this repo silently — it is caught by frozen witnesses (downstream-contract,
the api-surface snapshot, the pre-publish hotcrm smoke) and forced through a deliberate
major bump with a migration document.

This ADR fixes the **consumer** side: how an externally developed metadata app *finds
out* about protocol changes in time, and how it upgrades across majors for years without
its authors ever reading our changelog. The mechanism is a two-sided contract:

| # | The protocol promises | Delivered through |
|---|---|---|
| D1 | Incompatibility **fails fast at load**, never as a mid-request crash | enforce the existing `engines.protocol` handshake (currently inert, an ADR-0078 violation) |
| D2 | Nothing is removed that was not **deprecated one full major earlier**, and deprecated usage **warns inside the consumer's own workflow** | a machine-readable deprecation registry surfaced by `objectstack validate` / `doctor` |
| D3 | Every release ships a **machine-readable change manifest** alongside the human changelog | `spec-changes.json`, derived from the api-surface snapshot diff + the deprecation registry |
| D4 | Every major ships an **upgrade guide and codemods** for the mechanical part | `upgrading-to-N.md` as a release gate + `objectstack migrate meta` |
| D5 | Majors are **rehearsable before they land** | an RC window on the `next` dist-tag + a community smoke ring generalizing the hotcrm gate |

In exchange, the consumer's obligations (author via `defineX`, pin `^N`, run
`objectstack validate` in CI, upgrade major-by-major) are documented as the supported
path — ADR-0059 already established them; this ADR states them to third parties as
the other half of the contract.

The single most important design bias: **the consumer's own CI and editor are the
notification channel.** Developers reliably see warnings in their own build output;
they do not reliably read upstream release notes. Every decision below routes change
information into tools the consumer already runs.

## Context

A metadata-driven platform makes two promises to third parties (ADR-0059): *what you
author the way the templates show works*, and *what worked on version N keeps working
on N+1*. ADR-0059's gates guarantee that when the second promise must be broken, the
break is deliberate, carries a major version, and is documented. What they do **not**
provide is any mechanism by which the information reaches a lagging consumer before —
or even at — the moment of failure. Four concrete gaps:

1. **The handshake exists on paper only.** `PluginEnginesSchema` gives every package
   manifest an `engines.protocol` range, protocol-first per ADR-0025 §3.10 #3 — and no
   loader, installer, or CLI command reads it. A consumer app built against protocol 10
   loaded by a protocol 12 runtime is not told "incompatible: see the migration guide";
   it runs until some schema `.parse()` or renderer contract fails, i.e. it *crashes*.
   Under ADR-0078 an authorable field the runtime ignores is a bug class of its own:
   enforce it or remove it.

2. **Deprecation is ad-hoc prose.** Individual schemas carry `deprecated` notes in
   descriptions, and `readEnvWithDeprecation` (`@objectstack/types`) proves the
   warn-one-release pattern works for env vars — but there is no protocol-wide rule
   that removal requires prior deprecation, no machine-readable registry of what is
   deprecated / since when / removed when / migrate how, and `objectstack validate`
   passes deprecated usage silently. The 11.0 removals (`http_request` → `http`,
   legacy `useQuery` aliases, `IUIService`) were correct per ADR-0059's freeze
   contract, but a consumer's first contact with them was the *removal*, not a
   warning period.

3. **Change information is human-readable only.** `packages/spec/api-surface.json`
   records the full export surface and its diff gates every PR — then the diff is
   thrown away. Releases ship a prose CHANGELOG and (for 11) a hand-written upgrade
   guide. Nothing machine-consumable maps version N → N+1 as added / deprecated /
   removed / migrated, which matters doubly here because much third-party metadata is
   AI-authored: an upgrade agent could consume such a manifest directly, but there is
   nothing to consume.

4. **Upgrading is entirely manual.** `docs/upgrading-to-11.md` is a good artifact but
   exists by convention, not by gate; and its purely mechanical entries (a node type
   rename, field alias removals) are exactly the transforms a codemod applies in
   seconds without human error.

The result is the reported failure mode: *"metadata protocol upgrades keep crashing
metadata apps."* Not because breaks escape the gates — ADR-0059 closed that — but
because the consumer learns about a deliberate, documented break only when their app
stops working.

## Decision

### D1 — Enforce the protocol handshake (make `engines.protocol` real)

- `@objectstack/spec` exports a **`PROTOCOL_VERSION`** constant (SemVer, bumped by the
  same release discipline ADR-0059 defines: majors only via the freeze-contract fork).
- The metadata loader and the package installer **check `engines.protocol`** (falling
  back to `engines.platform`, then the legacy `engine.objectstack`) against the running
  `PROTOCOL_VERSION` **before** loading a package's metadata:
  - in range → load;
  - major-incompatible → **fail fast** with a structured diagnostic naming the two
    versions and linking the exact upgrade guide (`upgrading-to-N.md`) — never a
    downstream parse crash;
  - range absent → load with a warning (grandfathering), and `objectstack lint` flags
    the missing range so new packages declare it.
- `create-objectstack` scaffolds and `defineStack` templates stamp
  `engines: { protocol: '^<current major>' }` so the field is populated by default
  going forward.

This turns the symptom in the ADR title — *crash* — into a diagnosable, actionable
refusal at the boundary, per ADR-0078: the field is now enforced, not inert.

### D2 — The N−1 deprecation rule and a deprecation registry

- **Rule:** anything removed in major N+1 must have been **marked deprecated and still
  functional throughout major N**. A removal PR whose subject was never deprecated is
  rejected in review the same way an edit-to-pass on the frozen fixtures is (ADR-0059
  §4). Security-forced exceptions require an explicit ADR.
- **Registry:** deprecations are recorded as data, not prose — a
  `packages/spec/deprecations.json` (or Zod-registry metadata compiled to it) with one
  entry per deprecation: `{ surface, since, removedIn, replacement, guideAnchor,
  codemod? }`.
- **Surfacing:** `objectstack validate` and `objectstack doctor` read the registry and
  report deprecated usage in the consumer's own metadata:
  `flow.type "http_request" is deprecated since 10.2, removed in 11.0 — use "http"
  (upgrading-to-11.md#flow-node-type-http)`. Warnings by default; `--strict` (for
  consumers who want it) makes them errors. This is the channel that actually reaches
  people: their own CI output, one release *before* the break.
- The precedent is already in-tree: `readEnvWithDeprecation` does exactly this for env
  vars (AGENTS.md Prime Directive #9). D2 generalizes warn-one-release to the whole
  authorable surface.

### D3 — A machine-readable change manifest per release

- The Release workflow diffs the current `api-surface.json` against the previously
  published one, joins the deprecation registry, and emits **`spec-changes.json`**:
  `{ from, to, added[], deprecated[], removed[], each removal carrying replacement +
  guideAnchor + codemod? }`. It is published inside `@objectstack/spec` and attached
  to the GitHub Release.
- Humans keep reading CHANGELOG / RELEASE_NOTES; **tools read the manifest** — the D2
  warnings, the D4 codemods, editor tooling, and third-party (or AI) upgrade agents
  all consume the same single source. The PR-time snapshot diff that ADR-0059 §3
  introduced is thereby *reused* as the release-time communication artifact instead of
  being discarded after the gate passes.

### D4 — Every major ships an upgrade guide and codemods

- `upgrading-to-N.md` (the 11.x artifact, generalized) becomes a **release gate**: the
  Release workflow refuses to publish a new major without it, and every `removed[]`
  entry in `spec-changes.json` must resolve to a guide anchor.
- **`objectstack migrate meta`** applies the mechanical subset: registry entries may
  carry a `codemod` id (a rename, a field move, an alias substitution) executed against
  the consumer's metadata source files. The 11.0 line shows the potential: the flow
  node rename and the client-react alias removals were 100% codemod-able. Non-mechanical
  changes remain guide-only — the codemod covers the toil, not the thinking.

### D5 — Rehearsal: RC window + community smoke ring

- Every major is published to the **`next` dist-tag at least one RC cycle** before
  `latest`, so a third party can run *their own* `validate && typecheck && build`
  against it in a branch — the same self-gate ADR-0059 §2 makes authoritative, now
  runnable *before* the release instead of after.
- The pre-publish hotcrm smoke (ADR-0059 §3, release-blocking) is generalized into a
  **community smoke ring**: external repos can register (repo + pinned ref + their
  verify command) to be smoked in the Release workflow. Ring members are
  **advisory-only** (a red warns and notifies the member; only hotcrm stays blocking)
  so one stale community repo cannot hold a release hostage — the crater/partner-testing
  model, bounded the same way `HOTCRM_REF` bounds the hotcrm coupling.

### Consumer obligations (the other half, stated to third parties)

Documented in the public upgrade docs as the supported path — all previously
established (ADR-0059), now stated as contract: author through `defineX` factories,
pin `@objectstack/*` to `^N`, run `objectstack validate` in CI, and upgrade
**major-by-major** (N → N+1 is the tested path; skipping majors forfeits the
deprecation-warning window that D2 provides).

## Boundaries

- **Nothing in ADR-0059 changes.** The freeze contract, the frozen witnesses, and the
  SemVer discipline stay exactly as decided; this ADR only adds the communication and
  tooling layer on top of them.
- The in-repo consumers keep their ADR-0054 roles; they are not the audience here.
- Phases, independently shippable and evidence-gated:
  - **P0 — the handshake (D1).** Smallest change, kills the "crash" symptom directly,
    and pays down a standing ADR-0078 violation.
  - **P1 — deprecation registry + validate/doctor warnings (D2).** Must be live one
    full major before the next batch of removals to deliver its value.
  - **P2 — change manifest + upgrade-guide gate + first codemods (D3, D4).**
  - **P3 — RC window + smoke ring (D5).** Deferred until there are enough registered
    external consumers to justify the workflow surface (evidence-gated, like
    ADR-0054 Phase 3).

## Consequences

**Positive.**

- A protocol/consumer version mismatch is a **structured load-time refusal** with a
  link to the fix, not a runtime crash — the reported failure mode is eliminated as a
  *symptom* even when versions drift.
- A lagging third party hears about every future removal **at least one major early,
  inside their own CI**, without reading anything we publish.
- One machine-readable source (`spec-changes.json` + the deprecation registry) feeds
  warnings, codemods, docs anchors, and AI upgrade agents — no drift between them.
- The marginal cost of upgrading a major drops toward "run the codemod, read the guide
  for the rest," which is what makes *long-term* stable upgrading realistic.

**Costs / trade-offs.**

- The N−1 rule slows removals by one major cycle — intentional; it is the warning
  window. Security exceptions have an explicit escape hatch (ADR).
- The deprecation registry and guide anchors are new maintained surfaces; the
  release-gate wiring (manifest generation, guide check, RC step) adds Release
  workflow complexity.
- Grandfathering packages without `engines.protocol` keeps the handshake soft for one
  transition period; the lint nudge plus scaffold stamping is the ratchet that closes
  it.
- The smoke ring, even advisory, is operational surface (registration, notification,
  stale-member pruning) — hence deferred to P3 behind evidence.

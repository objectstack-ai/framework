---
"@objectstack/spec": minor
"@objectstack/cli": minor
---

feat(cli): preflight that every `requires` capability has an installable provider
in the current edition (#3366)

A capability listed in `requires: [...]` was only checked at `serve`/`start` time,
and a missing provider produced a generic "not installed — add it to your
dependencies" error even when the provider has **no installable version in the
current edition**. `os validate` (token-vocabulary only) and `os build` (never
resolved providers) both passed, so a `validate && build && test` CI script never
caught it — it surfaced only as an opaque boot crash. Seen upgrading an
open-edition app from `14.7` to `16` after `@objectstack/service-ai` went
cloud-only (ADR-0025).

- `@objectstack/spec/kernel` now exports `PLATFORM_CAPABILITY_PROVIDERS`
  (token → provider package + edition) and a pure `classifyRequiredCapability()` —
  one machine-readable source of truth for the provider/edition knowledge the
  serve resolver previously encoded informally.
- `os build` and `os validate` gained a provider preflight. A `requires` entry
  whose provider has **no installable version in the active edition** (e.g. `ai` →
  `@objectstack/service-ai`, cloud-only) now fails fast with an edition-aware
  message; an absent-but-installable provider is an advisory `pnpm add` hint, not
  a hard error; a satisfied `requires` list passes unchanged.
- The `os serve` boot error now renders the same classification, so preflight and
  boot read identically.

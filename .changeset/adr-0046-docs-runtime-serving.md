---
"@objectstack/cli": patch
"@objectstack/metadata": patch
---

fix(ADR-0046): serve package docs at runtime, not just in the compiled artifact

Package docs (`src/docs/*.md`) compiled into a bundle were never reaching the
runtime, so `GET /meta/doc` returned an empty list and the docs were invisible
even though `os build` produced them.

Two gaps:

- **`os dev` / `os serve` (config-load path)** re-derives metadata from
  `defineStack(...)`, which never carries the markdown docs — those are
  collected only at compile time. `serve.ts` now collects `src/docs/*.md` into
  the stack on the config-load path too (collection only — additive, never
  blocks boot), so docs serve in dev exactly as from a built artifact.
- **The MetadataPlugin artifact loader** (`ARTIFACT_FIELD_TO_TYPE`) omitted the
  `docs` → `doc` mapping, so the bundle's `docs` array was skipped when loading
  through that path. Added the mapping (with a regression test) for parity with
  the ObjectQL engine's `metadataArrayKeys`.

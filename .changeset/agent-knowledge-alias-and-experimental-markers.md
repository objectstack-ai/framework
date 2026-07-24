---
"@objectstack/spec": patch
---

fix(spec): fold agent `knowledge.topics` into `sources` at parse; mark unenforced AI config experimental (#1891, #1893)

Two liveness-audit closeouts (umbrella #1878):

- **`AIKnowledgeSchema`** now folds the deprecated `topics` alias into the
  canonical `sources` at parse time (canonical wins; alias dropped from the
  output — mirrors the `visibleWhen` normalization, ADR-0089 D2). Authoring
  `topics` was a silent no-op: the renderer only reads `sources`. The schema's
  JSDoc example now shows `sources`.
- **Author-facing experimental markers** added to config that is parsed but has
  no runtime consumer, matching the liveness ledger (ADR-0078): agent
  `memory` / `guardrails` / `structuredOutput` / `lifecycle`, and tool
  `outputSchema` (keys folded into the LLM-facing description only — no output
  validation).

Reference docs regenerated. No parse-acceptance change; `Agent`'s inferred
output type no longer carries `knowledge.topics` (input still accepts it).

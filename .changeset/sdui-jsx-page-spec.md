---
"@objectstack/spec": minor
---

ADR-0080: `PageSchema` gains `kind: 'jsx'` + `source` (the authoritative JSX text, compiled to the tree at save time) + `requires`, with a completeness `superRefine` — a jsx page with no source fails loudly (ADR-0078).

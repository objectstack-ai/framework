---
"@objectstack/spec": minor
"@objectstack/lint": minor
---

ADR-0081: split the AI page-authoring surface into honest tiers.

- `PageSchema.kind` gains `'html'` and `'react'`. `'html'` is the constrained
  parse-never-execute tier (the renamed `'jsx'`, kept as a deprecated alias);
  `'react'` is the trusted real-React tier (executed at render by
  `@object-ui/react-runtime`, gated behind a host capability, enterprise/private
  only). The completeness gate now requires `source` for all three.
- `validate-jsx-pages` lints `html`/`jsx` (constrained parse) and intentionally
  skips `react` (real JS, not constrained JSX).

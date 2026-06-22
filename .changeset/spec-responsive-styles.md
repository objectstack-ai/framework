---
"@objectstack/spec": minor
---

feat(spec): add `responsiveStyles` to the UI page-component envelope (ADR-0065)

`ResponsiveStylesSchema` / `StyleMapSchema` model the SDUI scoped-styling
primitive — per-breakpoint CSS-property maps (`large`/`medium`/`small`/`xsmall`)
compiled to id-scoped CSS at render. `PageComponentSchema` gains an optional
`responsiveStyles` field: the preferred, build-independent, collision-free
styling channel for metadata-authored pages (distinct from the layout-oriented
`responsive` config). Prefer design-token values.

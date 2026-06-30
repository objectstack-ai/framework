---
"@objectstack/lint": minor
"@objectstack/cli": minor
---

ADR-0081 Phase 2: a build-time prop check for `kind:'react'` pages. After the
syntax gate, `validateReactPageProps` parses the real JSX (TypeScript compiler)
and checks each usage of an injected block (`<ObjectForm>`, `<ListView>`, …)
against the react-tier contract (`REACT_BLOCKS` from `@objectstack/spec/ui`):
missing a required binding (e.g. `<ObjectForm>` with no `objectName`) is an
error; a near-miss prop (`onSucces` → `onSuccess`) is a warning. Wired into
`os validate`. Curated data props are not flagged (low false-positive); a spread
`{...props}` escapes the required check. (`typescript` moves to `@objectstack/lint`
dependencies so it externalizes instead of bundling into the CLI.)

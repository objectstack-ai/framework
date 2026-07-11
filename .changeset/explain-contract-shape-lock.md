---
---

test(spec): field-level contract lock for the public explain / access-matrix schemas.

`api-surface.json` already guards the export NAMES; `explain.test.ts` now guards
the FIELD SHAPE (layer/verdict/operation enums, contributor kind + ADR-0091 D2
lifecycle `state`, the ExplainDecision principal shape, and AccessMatrixEntry's
required crud/bypass bits + scopes). This makes explain a stable contract the
ADR-0091 L3 enterprise consumer (cloud recert UX / evidence export / break-glass
attribution) can depend on without drift fear. Test-only — no runtime change,
no release.

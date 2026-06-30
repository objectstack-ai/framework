---
"@objectstack/spec": minor
---

Add the react-tier component contract index (`REACT_BLOCKS`, ADR-0081):
`packages/spec/src/ui/react-blocks.ts` maps each curated public block injected
into `kind:'react'` page source to the **spec zod schema** that defines its
declarative config props (FormView, ListView, RecordDetails/Highlights/
RelatedList/Path, Chart) plus a hand-authored React-interaction overlay
(binding/controlled/callback — objectName, recordId, mode, onSuccess,
onRowClick, …). `pnpm --filter @objectstack/spec gen:react-blocks` generates the
AI-facing contract (skills/objectstack-ui/references/react-blocks.md + .json)
from it — the `data` props come from the spec (single source, no re-authoring).

---
'@objectstack/spec': patch
'@objectstack/objectql': patch
'@objectstack/rest': patch
---

Fix the data-import automation chain (#2922). Batch `engine.insert` now fires
`beforeInsert`/`afterInsert` once **per row** with single-record hook contexts,
so flat-input proxies, declarative hook conditions, audit writers, and
record-change triggers see real records instead of arrays. A new
`ExecutionContext.skipAutomations` flag (mirrored into `HookContext.session`)
lets callers suppress metadata-bound automation hooks and flow dispatch while
code-registered system hooks (audit, security, sharing) still run — making the
import wizard's "run automations & triggers" checkbox and import undo actually
effective. The REST import default flips to running automations unless the
request explicitly opts out (`runAutomations: false`), matching historical
behavior.

---
"@objectstack/verify": minor
---

`bootStack` gains an opt-in `automation` boot option. When set, it registers `@objectstack/service-automation` so the app's authored flows are pulled from the registry and `POST /api/v1/automation/:name/trigger` actually executes their nodes against the real in-process stack. This makes flow-node execution + variable wiring verifiable end-to-end (ADR-0054 Phase 2), mirroring the existing `multiTenant` opt-in. Default is `false`, so the standard boot stays lean for apps that don't exercise flows.

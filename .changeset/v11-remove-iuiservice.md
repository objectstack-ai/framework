---
"@objectstack/spec": major
"@objectstack/plugin-dev": major
---

Remove the deprecated `IUIService` contract (use `IMetadataService`) — 11.0.

`IUIService` (spec `contracts/ui-service.ts`) was superseded by `IMetadataService`
(views/dashboards are metadata: `metadata.get('view', …)` / `register(…)`). This
removes the dead interface and its dev stub:

- spec: delete `contracts/ui-service.ts` + its barrel export.
- plugin-dev: drop the bespoke `ui` dev stub (`createUIStub`). `'ui'` remains a
  `CoreServiceName`, so dev mode still registers a generic stub for it via the
  fallback path; only the obsolete view/dashboard methods are gone.

Use `IMetadataService` for view/dashboard CRUD.

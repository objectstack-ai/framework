---
"@objectstack/core": patch
---

fix(runtime): surface code-defined datasources at `GET /api/v1/datasources` and `GET /api/v1/meta/datasource` on the standalone / host-config boot path (ADR-0015 §18, follow-up to #2111).

A datasource declared in `defineStack({ datasources: [...] })` (e.g. the showcase's `showcase_external`) is stamped `origin: 'code'` and registered by `AppPlugin` via `metadata.registerInMemory('datasource', …)` — gated on `typeof metadata.registerInMemory === 'function'`. On the standalone / host-config path (`os dev`/`serve` for a config whose `plugins` are already instantiated — `isHostConfig` true — so no `MetadataPlugin` loads) the `metadata` service is an in-memory fallback that implemented `register`/`list`/`get` but **not** `registerInMemory`. The guard was therefore false, AppPlugin silently skipped the registration, and the datasource was absent from both REST surfaces (and Setup → Integrations → Datasources) even though the boot banner counted it and its federated objects were queryable.

Both in-memory `metadata` fallbacks (`@objectstack/core`'s `createMemoryMetadata` and `@objectstack/plugin-dev`'s dev stub) now implement `registerInMemory` (synchronous, no persistence — identical to `register` for these in-memory stores, matching `MetadataManager`'s signature). The read paths (`metadata.list`, datasource-admin `listDatasources`, and `protocol.getMetaItems` which merges `metadata.list`) were already correct; this restores the write-side registration they depend on. It also makes stack-declared security metadata (`roles`/`permissions`/`sharingRules`/`policies`, registered through the same guard) listable on this path.

---
"@objectstack/objectql": minor
---

External Datasource Federation (ADR-0015) — write gate (Gate 3) + introspection plumbing.

- Write gate: ObjectQL `insert`/`update`/`delete` now block writes to a
  federated datasource (`schemaMode !== 'managed'`) unless BOTH
  `datasource.external.allowWrites` and `object.external.writable` are true,
  throwing `ExternalWriteForbiddenError` (code `EXTERNAL_WRITE_FORBIDDEN`).
  Managed datasources (and objects without a datasource definition) are
  unaffected. New `registerDatasourceDef()` records declarative datasource
  ownership; manifests carrying `datasources` are indexed during `registerApp`.
- `engine.introspectDatasource(name)` delegates to the named driver's
  `introspectSchema()`, wiring the external-datasource service end-to-end.

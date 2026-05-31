---
"@objectstack/objectql": minor
"@objectstack/spec": minor
---

Type-level metadata actions are now emitted from the merged registry
(declarative entries + the `registerMetadataTypeActions` plugin overlay),
and the datasource **Test connection** action is relocated out of the
open-source registry into the backend plugin that serves its route.

- `objectql`: `getMetaTypes()` (`/api/v1/meta`) sources `actions` from
  `getMetadataTypeActions(type)` so plugin-contributed actions are surfaced.
  Previously the endpoint spread the registry entry's declarative `.actions`
  directly and the plugin overlay was never emitted. The `actions` key is
  omitted when empty (response shape preserved).
- `spec`: drop the hardcoded `datasource` `test_connection` action from
  `DEFAULT_METADATA_TYPE_REGISTRY`. The action is now contributed at install
  time by the `datasource-admin` backend plugin, co-located with the
  `POST /api/v1/datasources/:name/test` handler — so the metadata-admin
  button is emitted only when the backend that serves it is installed.

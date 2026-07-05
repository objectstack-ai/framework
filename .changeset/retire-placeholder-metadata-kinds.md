---
'@objectstack/spec': minor
'@objectstack/objectql': minor
'@objectstack/metadata-core': minor
---

feat(spec)!: retire the placeholder metadata kinds `trigger`, `router`, `function`, `service` (ADR-0088).

The registry is the contract authors — human and AI — read to learn what can be authored, and these four kinds had no authoring surface, no loader, no schema, and no (or a dead) consumer. `MetadataTypeSchema` + `DEFAULT_METADATA_TYPE_REGISTRY` shrink 30 → 26; `OPS_FILE_SUFFIX_REGEX` drops the four suffixes; the dormant objectql load path that registered QL functions from `type: 'function'` metadata items is removed (`defineStack({ functions })` / plugin `contributes.functions` remain the delivered forms); the metadata-core lockstep enum follows. `external_catalog` stays and is now annotated RUNTIME-CREATED (ADR-0062): its lack of an authoring surface is correct design. The delivered replacements: `hook` / `record_change` flows (trigger), plugin `contributes.routes` + declarative `apis:` (router), `defineStack({ functions })` (function), the plugin/service registry (service). Persisted `sys_metadata` rows are unaffected — no production read path re-parses stored `type` values through the enum.

---
'@objectstack/mcp': minor
'@objectstack/runtime': minor
'@objectstack/plugin-security': patch
---

feat(mcp): `aggregate_records` tool — GROUP BY aggregation over the engine read path

New MCP tool `aggregate_records` (count/sum/avg/min/max/count_distinct, optional
groupBy incl. date bucketing, where filter, IANA timezone) in the `data:read`
family. Execution routes through the ObjectQL ENGINE (`callData('aggregate')`
deliberately never uses the raw per-env driver), so RLS/tenant scoping and the
D10 delegator intersection apply exactly as on find.

Security hardening shipped with it:

- plugin-security: new FLS aggregate-INPUT gate — result masking never runs for
  `aggregate` (output rows carry only aliases), so any groupBy / aggregation
  reference to an FLS-unreadable field is now rejected fail-closed with the
  offending field names (mirrors the FLS write gate).
- runtime: `aggregate` maps to the `list` ApiMethod in the object exposure gate
  (an object whose `apiMethods` whitelist excludes `list` cannot leak row
  statistics through GROUP BY), and the aggregate action requires at least one
  aggregation (the engine's in-memory path would otherwise degrade to raw rows
  that the FLS masker does not cover).

The bridge seam is optional: a runtime that does not implement
`McpDataBridge.aggregate` simply does not register the tool (graceful
degradation, same contract as the action tools).

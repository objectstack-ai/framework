---
'@objectstack/spec': minor
'@objectstack/objectql': patch
'@objectstack/driver-sql': patch
---

fix(tenancy): platform-global (`tenancy.enabled:false`) objects are never driver-org-scoped (#3249)

An org-context read of a platform-global object (e.g. `sys_license`, ADR-0066)
could return 0 rows for an authenticated caller while an anonymous read saw the
data: the engine stamped `execCtx.tenantId` into driver options unconditionally,
and the SQL driver's tenant-field cache could be re-corrupted to
`organization_id` by a partial re-registration (lifecycle archive `syncSchema`,
schema-drift re-sync) whose schema omitted the `tenancy` block.

- New `isTenancyDisabled(schema)` export from `@objectstack/spec/data` — the
  single source of truth for the ADR-0066 platform-global posture, now shared by
  the registry (tenant-column injection), the ObjectQL engine, and the SQL
  driver.
- `ObjectQL.buildDriverOptions` no longer stamps `tenantId` for objects whose
  registered schema declares `tenancy.enabled: false` (an explicitly-passed
  options `tenantId` still wins — deliberate caller intent).
- `SqlDriver` (and `SqliteWasmDriver`) now keep a sticky record of an explicit
  `tenancy.enabled:false` declaration: a later registration without a `tenancy`
  block preserves the opt-out instead of re-scoping via the implicit
  `organization_id` heuristic; a registration that carries a `tenancy`
  declaration stays authoritative.

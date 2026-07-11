---
'@objectstack/spec': minor
'@objectstack/objectql': minor
'@objectstack/service-automation': minor
---

ADR-0057 (#2834): `retention.onlyWhen` status predicate — mixed tables can scope the age reap.

- **spec**: `lifecycle.retention.onlyWhen` — a row filter (per-field equality or `{ $in: [...] }`) the retention window applies to; rows outside it are retained regardless of age. Rejected when combined with rotation `storage` (shard DROPs ignore filters) or `archive` (the Archiver moves rows by age alone).
- **objectql**: the LifecycleService Reaper merges `onlyWhen` into every retention delete, including tenant-override passes.
- **service-automation**: the run-history age sweep is now declarative — `sys_automation_run` declares `retention: { maxAge: '30d', onlyWhen: { status: { $in: ['completed', 'failed'] } } }` and the platform Reaper owns it; suspended (`paused`) runs never match. The plugin's own sweep loop is retired: `ObjectStoreSuspendedRunStore.pruneHistory`, the `DEFAULT_RUN_HISTORY_RETENTION_DAYS` export, and the `runHistoryRetentionDays` / `runHistorySweepMs` plugin options are removed (launch-window breaking-as-minor). The write-time per-flow overflow cap (`runHistoryMaxPerFlow`) stays.

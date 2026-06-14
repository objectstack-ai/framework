---
"@objectstack/service-job": minor
---

feat(P1-2): default-on retention for the sys_job_run execution log

Every job execution appended a `sys_job_run` row with no cleanup path, so the
table grew unbounded on long-running deployments (launch-readiness P1-2). New
`JobRunRetention` (mirroring `service-messaging`'s `NotificationRetention`)
performs a bulk `delete sys_job_run where created_at < cutoff` under a system
context. `JobServicePlugin` wires it **default-on** at `kernel:ready` (DB-backed
adapter only) — runs once on boot then every 6h via an unref'd timer.

- `retentionDays` defaults to `DEFAULT_JOB_RUN_RETENTION_DAYS` (30); set `0` to
  disable (rows kept forever; operator owns cleanup).
- `retentionSweepMs` defaults to `DEFAULT_JOB_RUN_SWEEP_MS` (6h).

**Behaviour change:** job-run history older than 30 days is now pruned by
default. Set `retentionDays: 0` to keep the previous keep-forever behaviour.

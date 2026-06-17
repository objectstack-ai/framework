---
"@objectstack/plugin-reports": minor
---

feat(reports): report schedules honor `cron_expression` + `timezone`

`sys_report_schedule` has long carried `cron_expression` and `timezone` fields, but `ReportService` only ever advanced `next_run_at` by `interval_minutes` — both fields were stored and ignored. Scheduling now computes `next_run_at` from the cron expression (when present) in the schedule's timezone via `croner` — the same library the job scheduler uses — so "every weekday at 09:00 local" is expressible. `interval_minutes` remains the fallback.

- `cron_expression` wins over `interval_minutes` when set (the field's documented contract).
- Evaluated in `timezone` (default `UTC`).
- `scheduleReport` validates the cron expression eagerly and rejects an invalid one with `VALIDATION_FAILED`, rather than silently falling back at sweep time. A cron that becomes unschedulable later is logged and falls back to the interval — it never throws into the dispatch sweep.

The DB-polling dispatch model is unchanged; only the next-run computation is cron-aware. Part of ADR-0053 Phase 2 (#1983) but self-contained — report schedules run under a system context, so the timezone source is the schedule's own field, independent of the reference-timezone resolver.

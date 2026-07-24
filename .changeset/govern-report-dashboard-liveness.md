---
"@objectstack/spec": patch
---

chore(spec): enroll `report` and `dashboard` in the liveness GOVERNED set (#3462)

Closes the systemic anti-drift gap for two more authorable UI types (umbrella
#1878). Both were registered/round-trippable but ungoverned, so their property
liveness wasn't CI-checked — the reason drifts like dashboard `title`↔`label`
and stale report `chart` config survived until an audit caught them.

- Added `packages/spec/liveness/report.json` (20 live / 2 dead) and
  `dashboard.json` (18 live / 2 dead), each property classified with an
  objectui consumer reference.
- Re-verification corrected several stale 2026-06 audit findings against current
  code: report `chart` is **live** (DatasetReportChart plots `chart.xAxis`/
  `yAxis` via `useDatasetRows`, #1890/#3441); dashboard `globalFilters`/
  `dateRange` are **live** (framework#2501); `title`↔`label` fixed (objectui#2806);
  the ADR-0021 widget migration shipped (#3251). Only `aria`/`performance` remain
  dead on each (perf `authorWarn`'d).
- Added both to `GOVERNED` in `check-liveness.mts`; the gate is green. Future
  drift on these types is now a CI failure, not an audit finding.

`webhook` (the third type in #3462) is deferred — it isn't a registered
metadata type; its enrollment rides with the disconnect decision in #3461.

No spec shape/behavior change (ledger + gate config only).

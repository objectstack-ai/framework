---
"@objectstack/cli": patch
---

feat(cli): build-time lint warns on the record-change date-equality time anti-pattern (#1874)

`objectstack build` now emits an advisory WARNING when a record-change flow's
start condition compares a date field for EQUALITY against a time function
(`end_date == daysFromNow(60)`, `today() != …`). That construct is valid CEL but
a runtime footgun — it only fires if the record happens to be written on that
exact day, so unattended "N days before" rules never run. The warning points the
author to the robust pattern (a daily SCHEDULE trigger + a range query).

Range comparisons (`>=`/`<=`) and non-time-field equality are NOT flagged, and it
never fails the build — it guides authors (very often an AI generating templates)
toward the correct shape without breaking technically-legal metadata.

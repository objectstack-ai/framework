---
'@objectstack/core': minor
'@objectstack/service-analytics': minor
---

feat(analytics): scope a datetime date-bucket drill to the reference-tz midnight instants (#1752 follow-up)

Closes the one gap left by the initial #1752 change: a `datetime` date dimension
bucketed under a **non-UTC reference timezone** previously fell back to a superset
drill (its bucket boundary is that tz's midnight *instant*, which `YYYY-MM-DD`
calendar bounds can't express).

- **`@objectstack/core`** adds `zonedDateStartToUtcMs(ymd, tz)` — the UTC instant
  at which a calendar day begins in a reference timezone (the inverse of
  `calendarPartsInTz`). DST-safe: the offset is read from the platform tz
  database via `Intl`, with a two-pass resolution for the rare offset-boundary
  case; an unset/`'UTC'`/invalid zone returns plain UTC midnight.
- **`@objectstack/service-analytics`** now emits `drillRanges` bounds per the
  field's temporal type (ADR-0053): a `datetime` field → ISO **instant** bounds
  at the reference tz's midnight (works under any tz, incl. DST); a `date` field
  → `YYYY-MM-DD` calendar bounds (tz-naive, exact under any tz). An unknown field
  type is still emitted only under UTC and omitted (superset) under a non-UTC tz.

No objectui change is needed — the client already forwards whatever bound values
the server sends into the drill filter and the `filter[field][gte|lt]` URL.

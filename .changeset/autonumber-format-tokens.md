---
"@objectstack/spec": minor
"@objectstack/objectql": minor
"@objectstack/driver-sql": minor
---

feat(autonumber): date, {field} and per-scope counter reset for autonumber formats

`autonumberFormat` previously only understood a single `{0000}` sequence slot —
everything else was a fixed literal prefix on one global counter. Real MES/eHR
record numbers need three more token classes, so the format is now tokenized by a
shared pure renderer in `@objectstack/spec` (`parseAutonumberFormat` /
`renderAutonumber`) that the engine fallback and the SQL driver both call, so they
emit byte-identical numbers (#1603 parity):

- **Date tokens** — `{YYYY}` `{YY}` `{MM}` `{DD}` `{YYYYMMDD}` resolve the calendar
  day in the request's **business timezone** (`ExecutionContext.timezone`, ADR-0053;
  UTC fallback), threaded through the new `DriverOptions.timezone`.
- **`{field}` interpolation** — `{section}{island_zone}{000}` substitutes record
  field values into the prefix.
- **Per-scope counter reset** — the counter's scope is the rendered prefix *before*
  the sequence slot, so `AD{YYYYMMDD}{0000}` resets daily, `{section}{island_zone}{000}`
  numbers per group, and `{plan_no}{000}` numbers per parent — all from one
  mechanism, no separate reset config.

Fixed-prefix formats like `CASE-{0000}` render an empty scope and keep their single
global counter, so existing sequences are unchanged. The persistent
`_objectstack_sequences` table gains a `scope` column (PK widened to
`object, tenant_id, field, scope`); deployments with the legacy 3-column table are
migrated in place on first use, carrying existing counters to `scope=''`.

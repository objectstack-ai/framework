---
"@objectstack/spec": minor
"@objectstack/objectql": minor
"@objectstack/driver-sql": minor
"@objectstack/cli": minor
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
`_objectstack_sequences` table is keyed by a `key_hash` (SHA-256 of
`object, tenant_id, field, scope`) — a single 64-char primary key that keys every
dialect uniformly, stays within MySQL's utf8mb4 index-length limit (four raw
columns would not), and lets `scope` be a generous non-indexed column. Deployments
with an older table (3-column, or an interim `scope` column) are migrated in place
on first use, carrying existing counters to `scope=''`.

Guardrails:

- **Empty interpolated field is a hard error, not a silent mis-number.** A
  `{field}` token whose value is missing at create time would render to an empty
  prefix and collapse the record into the wrong counter scope. Both the SQL driver
  and the engine fallback now refuse to generate and throw a clear error naming the
  empty field (shared `missingFieldValues` helper).
- **Build-time lint (`@objectstack/cli compile`).** `autonumber` formats are
  checked against the object's fields: a `{field}` token naming a non-existent
  field (or the autonumber field itself) **fails the build**; a token naming an
  *optional* field emits an advisory warning to mark it `required: true`.
- **Migration fails safe.** If a legacy table cannot be migrated to the `key_hash`
  shape, fixed-prefix sequences keep working via the legacy key and a per-scope
  write raises an actionable error instead of corrupting counters.
- **Long `{field}` scopes are supported** (e.g. a long `{plan_no}`): the non-indexed
  `scope` column and hashed key remove the old varchar/PK length ceiling.

Notes on inherent semantics (documented, not bugs):

- The counter scope IS the rendered prefix. When two records' tokens render to the
  same prefix string (e.g. `{a}{b}` for `('AB','C')` and `('A','BC')`) they also
  render the same visible number, so they share one counter to stay unique — the
  remedy for genuinely-distinct groups is an unambiguous format (a delimiter
  literal between variable tokens).
- The sequence pad width is a MINIMUM; past it the number grows (`{000}` →
  `1000`), it never wraps — matching mainstream autonumber semantics.

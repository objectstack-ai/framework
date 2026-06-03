---
"@objectstack/spec": patch
"@objectstack/runtime": patch
---

fix(seed): reject object-wrapped relationship references and constrain them at compile time

Seed datasets resolve `lookup` / `master_detail` references by matching the value
against the target record's externalId — so the value must be the plain natural-key
string (e.g. `account: 'Acme Corp'`), never a wrapper object like
`account: { externalId: 'Acme Corp' }`. The wrapper was silently skipped by the
loader, fell through unresolved, and reached the SQL driver as a non-bindable value —
masked on an always-empty `:memory:` DB but crashing on a persistent one with
"SQLite3 can only bind numbers, strings, bigints, buffers, and null" once seeds re-ran
as updates.

- `defineDataset` now constrains reference fields to `string | null` at compile time
  (derived from each field's `type`), so the object form is a type error.
- `SeedLoaderService` now fails loudly with an actionable message (and drops the value
  instead of handing it to the driver) when a reference is an object — consistent
  behavior across all drivers, no longer silently masked.

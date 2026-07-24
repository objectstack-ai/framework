---
"@objectstack/spec": patch
"@objectstack/metadata-protocol": patch
---

fix(seed-loader): support a composite `externalId` so join-table seeds dedupe on replay (#3434)

A junction / join table has no single-field natural key — the PAIR of its
foreign keys is what's unique — so its seed could only run `mode: 'insert'`,
which re-inserts every row on each replay boot with no existing-row check
(`decideWriteAction`'s `insert` case returns `insert` unconditionally). The
table duplicated on every restart: the showcase `showcase_project_membership`
fixture (3 rows) grew 3 → 6 → 9. It was masked until #3415 let the master-detail
parents seed at all.

- `SeedSchema.externalId` now accepts a **list** of field names
  (`externalId: ['team', 'project']`) in addition to a single field name,
  declaring a composite natural key. Default stays `'name'`.
- `SeedLoaderService` builds the uniqueness key from all listed fields (joined
  with a `\u0000` separator that can't occur in a natural-key value). Reference
  key fields are compared by their RESOLVED parent ids — which the existing DB
  row already stores — so a composite of foreign keys matches across restarts.
  A partial key (any component absent) is treated as no key, falling back to
  insert, exactly as a missing single-field key already did.
- A composite-key target does not participate in single-value reference
  resolution (a reference is one natural-key string), so such objects keep the
  `'name'` default when referenced by another dataset.

The showcase membership fixture switches to `mode: 'ignore'` +
`externalId: ['team', 'project']`, so replay boots leave the three rows
untouched instead of duplicating them.

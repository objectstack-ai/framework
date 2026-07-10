---
'@objectstack/spec': major
---

`BookAudience` gated arm renamed: `{ profile: string }` → `{ permissionSet: string }`.

ADR-0090 D2 removed the Profile concept, but `book.audience` (ADR-0046 §6.7)
still modelled its gated arm as a profile reference. Books ship in packages,
and packages own permission sets but never positions (ADR-0090 D9), so the
gate is a capability reference — a permission-set name the reader must hold,
e.g. `{ permissionSet: 'crm_admin' }`. Pre-launch one-step rename, no alias:
the zod union now rejects `{ profile }` at parse time. `'org'` and `'public'`
literals are unchanged (`'public'` ≡ the built-in `guest` position, D9).

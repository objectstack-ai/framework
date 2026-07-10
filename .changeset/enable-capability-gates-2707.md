---
'@objectstack/spec': minor
'@objectstack/plugin-audit': minor
'@objectstack/rest': patch
'@objectstack/cli': patch
---

feat(data): make object `enable.feeds`/`enable.activities` real opt-out gates; define the `enable.trackHistory` contract (#2707)

`ObjectSchema.enable.{files,trackHistory,activities,feeds}` were parsed but
(mostly) unconsumed — an author setting them got nothing, silently. Per the
enforce-or-remove doctrine, each flag now has a defined enforcement contract:

- `enable.activities` — opt-OUT writer gate. Spec default flips
  `false → true`; plugin-audit keeps mirroring CRUD into the `sys_activity`
  timeline unless the object declares an explicit `activities: false`
  (behavior-preserving for every existing stack; the off-switch is the
  per-object lever for activity-row growth, ADR-0057). The compliance
  `sys_audit_log` row is NOT gated.
- `enable.feeds` — opt-OUT with server-side enforcement. Spec default flips
  `false → true`; an explicit `feeds: false` now rejects `sys_comment`
  creation targeting that object at the engine hook seam
  (403 `FEEDS_DISABLED`, fail-closed like `CLONE_DISABLED`).
- `enable.trackHistory` — was misclassified `dead` in the liveness ledger:
  the console has gated the record History tab on it since 2026-05.
  Reclassified live with the two-grain contract documented (object flag =
  History-tab master switch; per-field `trackHistory` = diff selector; audit
  *capture* stays unconditional as a compliance ledger).
- `enable.files` — stays dead + authorWarn (reserved for the future generic
  Attachments panel; use `Field.file`/`Field.image` meanwhile). Its
  `describe()` now says so instead of advertising a capability that
  doesn't exist.

The default flips can't be avoided: with `default(false)`, compiled output
materializes `false` for every object with an `enable` block, making
"author explicitly opted out" indistinguishable from "schema default" — so
opt-out semantics require the default to be `true` (same posture as
`trash`/`mru`/`clone`). Liveness ledger + reference docs regenerated;
compile-time authorWarn now fires only for `enable.files`.

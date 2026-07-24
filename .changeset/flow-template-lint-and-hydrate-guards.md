---
"@objectstack/lint": patch
"@objectstack/cli": patch
"@objectstack/trigger-record-change": patch
---

fix(#3426): build-time warning for unresolvable flow template paths + guard the formula re-read

Two follow-ups to #3426 (the formula/lookup `{record.<path>}` template gap that #3445 began closing).

**Build-time signal (the issue's fallback ask).** `os validate` now flags a
record-change flow node whose `{record.<path>}` template cannot resolve —
turning the previous SILENT blank into an advisory warning. Two cases, via the
new `@objectstack/lint` rule `validateFlowTemplatePaths`:

- `flow-template-unknown-field` — `{record.<x>}` where `<x>` is neither a
  declared field nor a system column (a typo like `{record.full_naem}`).
- `flow-template-lookup-traversal` — `{record.<lookup>.<field>}`, a cross-object
  hop the seeded record carries only as a scalar id (still unsupported; tracked
  on #3426).

Deliberately quiet: formula fields, bare lookup ids, numeric indexes into
`multiple` lookups (#1872), `json` sub-paths, and system columns are NOT flagged,
and flows bound to an object this stack does not define are skipped (no schema to
compare against).

**Hydration re-read guards.** The `trigger-record-change` computed-field re-read
(#3445) is now (a) skipped when the object declares no `formula` field — the only
thing it adds — via the engine's optional `getObjectConfig`, and (b) memoized per
write on the shared HookContext, so N flows on one written record share ONE
re-read instead of N. Any uncertainty falls back to the prior unconditional
re-read (correctness over the optimization).

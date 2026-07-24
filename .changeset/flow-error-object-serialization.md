---
"@objectstack/service-automation": patch
---

fix(automation): flow string templates serialize object tokens readably, never `[object Object]` (#3450)

A flow string field that embeds an object-valued token — most notably the
engine's `$error` (`{nodeId, message, ...}`, set on a failed step) in a fault
handler's notify body — rendered as the useless `[object Object]`. The
multi-token branch of `interpolateString` coerced every value with `String()`,
and `notify-node` did the same for a sole `{$error}` token.

- New shared `stringifyForTemplate` helper (`builtin/template.ts`): objects and
  arrays are JSON-serialized (so the text stays legible and still carries the
  message), primitives pass through, `null`/`undefined` render as ''.
- `interpolateString`'s embedded-substitution branch and `notify-node`'s
  title/body coercion use it. The sole-token branch still returns the raw value
  (typed config fields keep their type), and `{$error.message}` still resolves
  to just the message string — the documented, cleanest author form.

Split from #3425 (the readonly-strip half shipped in #3465).

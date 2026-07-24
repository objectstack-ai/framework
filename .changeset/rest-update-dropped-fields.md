---
"@objectstack/spec": minor
"@objectstack/metadata-protocol": minor
---

feat(protocol): surface silently-stripped write fields on the update response (#3431)

`PATCH /data/:object/:id` returned `200 + record` even when the data layer
legally stripped some of the caller's write — a static `readonly` field
(#2948) or one locked by a TRUE `readonlyWhen` predicate (#3042). The strip is
correct semantics, but it was **silent** on this surface: the only signal lived
in a server-side WARN log, so an API client's partial write "just didn't save"
with no way to detect it. This is the same gap #3407/#3413 closed for the flow
engine, one surface over — REST — reusing the engine's existing
`onFieldsDropped` observability channel.

- **spec** — `UpdateDataResponseSchema` gains an optional `droppedFields`:
  `DroppedFieldsEvent[]` (`{ object, fields, reason: 'readonly' | 'readonly_when' }`),
  present only when ≥1 field was dropped. Purely additive — existing clients
  reading `.record` are unaffected; `success` semantics are unchanged (the
  strip is surfaced, not escalated to a failure).
- **metadata-protocol** — `updateData` threads an `onFieldsDropped` collector
  into `engine.update` and attaches the collected events to its response
  envelope, so the REST PATCH handler's `res.json(result)` carries them.

Not wired on `createData`/POST: `insert` is readonly-exempt by design (INSERT
may set read-only columns), so it produces no dropped events — wiring it would
be inert. If insert ever gains a silent strip, wire it then. Bulk / batch /
GraphQL write paths remain follow-ups.

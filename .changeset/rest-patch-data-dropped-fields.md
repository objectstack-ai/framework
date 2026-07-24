---
"@objectstack/spec": minor
"@objectstack/metadata-protocol": minor
"@objectstack/rest": minor
---

feat(rest): surface silently-dropped write fields on PATCH/POST /data (#3431)

#3413 (closes #3407) built the engine-level strip-observability channel
(`WriteObservabilityOptions.onFieldsDropped`) and wired the flow side
(`update_record` / `create_record` emit a step warning + `droppedFields`). The
**REST write path was never wired**, so an external API caller writing N fields
still got a bare `200 + record` when `readonly` (#2948) / `readonlyWhen` (#3042)
stripping meant `< N` actually landed — the same silent-success class #3407
fixed flow-side, just on HTTP. The only way to notice was a per-field diff of
the returned row (which need not echo every field). This wires the channel
through the protocol → REST, on both write verbs.

**Passthrough (metadata-protocol).** `updateData` now registers an
`onFieldsDropped` collector on `engine.update` and returns the events on the
response as `droppedFields`. `createData` surfaces the #3043 static-`readonly`
INGRESS strip too — that strip runs at the protocol ingress
(`stripReadonlyForInsert`), *before* the engine, so it is recovered by diffing
the supplied payload against the stripped one (the engine's `onFieldsDropped` is
also wired for a future insert-side engine strip). A faulty listener never
breaks the write — the engine catches and logs.

**Contract (spec).** `UpdateDataResponseSchema` / `CreateDataResponseSchema`
gain an **optional** `droppedFields: DroppedFieldsEvent[]` — present only when
≥1 field was dropped. Optional + omit-when-empty keeps the response shape
backward-compatible for clients that only read `record`.

**REST surface.** PATCH `/data/:object/:id` and POST `/data/:object` echo the
drops as an `X-ObjectStack-Dropped-Fields` response header
(`field;reason=<reason>` tokens, comma-joined — e.g.
`approval_status;reason=readonly`) and keep the structured `droppedFields` on
the body. **Status/success semantics are unchanged** (200 update / 201 create) —
a strip is legitimate semantics, not a failure (same principle as #3413). The
FLS write gate is untouched (it already fails closed with 403).

Out of scope (issue #3431 D2 open questions, deferred): bulk
(`updateManyData` / `createManyData` / `batchData`) and GraphQL mutation wiring,
typed `@objectstack/client` warnings, and adding the header to the Hono CORS
`exposeHeaders` allow-list for cross-origin browser reads (the body
`droppedFields` is the cross-origin-safe channel meanwhile).

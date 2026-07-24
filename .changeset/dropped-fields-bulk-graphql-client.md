---
"@objectstack/spec": minor
"@objectstack/metadata-protocol": minor
"@objectstack/client": minor
"@objectstack/hono": patch
"@objectstack/plugin-hono-server": patch
---

feat(rest/protocol): extend droppedFields write-observability to the bulk paths + client SDK (#3455)

Follow-up to #3448 (#3431 D2): the single-write PATCH/POST `/data` paths already
surface LEGALLY-stripped write fields (static `readonly` #2948 / `readonlyWhen`
#3042 / #3043 create ingress) as `droppedFields`. The **bulk** write paths did
not — the same strips happened silently on every batched row — and the typed
client warning + CORS mirror were deferred. This closes those out.

**Bulk passthrough (metadata-protocol).**
- `updateManyData` and `batchData` (update/upsert rows) now register a per-row
  `onFieldsDropped` collector and attach the events to that row's result.
- `createManyData` diffs each supplied row against its #3043-stripped form and
  returns an **aggregated** top-level `droppedFields` (one event per
  object/reason with the union of field names) — its `{ records, count }`
  response has no per-row slot, and the insert-time strip is static-`readonly`
  only, so it is schema-uniform across rows and the aggregate is faithful.
- `insertManyData` keeps per-row precision, attaching `droppedFields` to each
  outcome.
- **Correctness fix bundled in:** `updateManyData` and `batchData` never threaded
  the caller's execution `context` to the engine — bulk writes ran context-less,
  so RLS/FLS and `readonlyWhen` evaluated without the caller's principal, and the
  batch create-ingress strip was hard-coded to a non-system context. All engine
  calls in both methods now run under the resolved `context`.

**Contract (spec).** `BatchOperationResultSchema` gains an optional per-row
`droppedFields` (covers `updateMany` + `batch`, which alias
`BatchUpdateResponseSchema`); `CreateManyDataResponseSchema` gains the optional
aggregated `droppedFields`. Both are omit-when-empty, so existing clients are
unaffected. `X-ObjectStack-Dropped-Fields` is deliberately **not** emitted for
batches — one response header cannot express per-row drops, so the per-row body
field is the canonical bulk channel.

**Typed client warnings (@objectstack/client).** `CreateDataResult` /
`UpdateDataResult` gain `droppedFields?: DroppedFieldsEvent[]`, giving the body
channel a type instead of an untyped property.

**CORS (@objectstack/hono, @objectstack/plugin-hono-server).**
`x-objectstack-dropped-fields` is added to the default `Access-Control-Expose-Headers`
allow-list (kept in lockstep across both Hono CORS sites) so a cross-origin
browser can read the single-write drop header. The body `droppedFields` remains
the primary, cross-origin-safe surface — this is a convenience mirror.

**GraphQL — not applicable (documented).** #3455 lists a GraphQL mutation item,
but GraphQL has no runtime: `kernel.graphql` is unassigned everywhere and
`handleGraphQL` returns `501`, and discovery never advertises `/graphql`. There
is no schema generator or mutation resolver to expose a typed payload field on,
so there is nothing to wire until a GraphQL engine lands — at which point the
protocol-layer `droppedFields` is already present and only the GraphQL schema
projection would remain.

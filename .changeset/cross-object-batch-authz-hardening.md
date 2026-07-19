---
'@objectstack/rest': patch
'@objectstack/spec': minor
---

fix(rest): gate the cross-object transactional batch by the same per-object API rules as single-record writes (#1604)

The `POST {basePath}/batch` route (issue #1604 / ADR-0034) wraps N cross-object
create/update/delete ops in one engine transaction, but it skipped the
per-object API-exposure gate every single-record route applies — an
authenticated caller could write to an `apiEnabled: false` object, or run an
operation outside an object's `apiMethods` whitelist, straight through the batch
surface (ADR-0049 / #1889 — the same "declared ≠ enforced" hole closed for the
generic write path in #3220 / #3213).

The route now:

- validates the body against a new `CrossObjectBatchRequestSchema`
  (`@objectstack/spec/api`, Zod-First) — a malformed op, an unknown action, or a
  missing `object` is a `400` instead of a `500`;
- enforces `enable.apiEnabled` / `enable.apiMethods` for **every** op (metadata
  fetched once, each distinct `(object, action)` checked) BEFORE opening the
  transaction — `404 OBJECT_API_DISABLED` / `405 OBJECT_API_METHOD_NOT_ALLOWED`;
- requires an `id` for `update` / `delete` (`400`);
- rejects an unresolvable `{ $ref }` with `400 BATCH_UNRESOLVED_REF` instead of
  silently writing a `null` FK;
- rejects an explicit `atomic: false` (`400 BATCH_NOT_ATOMIC`) rather than
  silently applying atomically — non-atomic per-object batches stay on
  `POST /data/:object/batch`.

`enforceApiAccess` is refactored to share the pure `apiAccessDenialFromEnable`
check + a `loadObjectItems` helper with the batch route (single-record behavior
unchanged). Adds `rest-batch-endpoint.test.ts` — the REST-boundary coverage
ADR-0034 flagged as missing (commit, `$ref`, rollback surfacing, API-access
denial, request validation).

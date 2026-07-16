---
'@objectstack/spec': minor
'@objectstack/runtime': minor
'@objectstack/metadata-protocol': minor
'@objectstack/objectql': patch
'@objectstack/rest': patch
'@objectstack/plugin-hono-server': patch
---

feat(discovery): honest capabilities — standardized stub/fallback marker + realtime route honesty (ADR-0076 D12/A1.5 framework slice, #2462)

**Spec** — new service self-description marker for honest discovery
(ADR-0076 D12): `SERVICE_SELF_INFO_KEY` (`__serviceInfo`),
`ServiceSelfInfoSchema` / `ServiceSelfInfo`, and `readServiceSelfInfo()`,
which also normalizes plugin-dev's legacy `_dev: true` flag to
`{ status: 'stub', handlerReady: false }`. A registered service that is a
stub / dev fake / degraded fallback self-identifies via this marker; a fully
real service carries no marker.

**Runtime + metadata-protocol** — both discovery builders
(`HttpDispatcher.getDiscoveryInfo` and the protocol shim's `getDiscovery`)
now honor the marker instead of hardcoding `status: 'available',
handlerReady: true` for every registered service. Dev stubs report `stub`,
the ObjectQL analytics fallback reports `degraded` (it keeps serving — no
`/analytics` 404), and consumers can finally trust
`status === 'available'` / `handlerReady === true`.

**Realtime honesty fix** — discovery no longer advertises a
`/realtime` route or `websockets: true`: `service-realtime` is an
in-process pub/sub bus, no dispatcher branch or plugin mounts any
`/realtime` HTTP surface, so the advertised route always 404'd. The
registered service now reports `status: 'degraded', handlerReady: false`
with no route (clients using the SDK are unaffected — it falls back to the
conventional path, which behaves exactly as before). Also corrects the
advertised realtime provider from the nonexistent `plugin-realtime` to
`service-realtime`.

**REST (A1.5)** — the REST layer's protocol dependency is narrowed from the
`ObjectStackProtocol` god-union to the new `RestProtocol =
DataProtocol & MetadataProtocol` slice (exported from
`@objectstack/rest`), per the ADR-0076 D9 incremental narrowing guidance.
Type-level only; no runtime change.

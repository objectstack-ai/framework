---
"@objectstack/service-automation": patch
"@objectstack/runtime": patch
---

fix(automation): bind a flow published while the server runs, without a restart

Follow-up to #2560 (cold-boot flow binding). A flow **published while the server
is running** — the Studio online-authoring journey: author a record-triggered
automation, publish it, immediately update a matching record — did **not** fire.
Its trigger only bound on the next process restart.

Two gaps, both fixed:

1. **The publish path fired no rebind signal.** `POST /packages/:id/publish-drafts`
   → `protocol.publishPackageDrafts` promotes the drafts to active but emitted no
   event the automation service listens to. The runtime dispatcher now announces
   `metadata:reloaded` after a successful publish — the same signal a dev artifact
   reload fires (`MetadataPlugin._reloadAndAnnounce`) — so boot-cached consumers
   re-sync without a restart.

2. **The runtime re-sync read the wrong source.** The automation service's
   `metadata:reloaded` re-sync pulled `metadata.list('flow')`, which returns 0 in a
   real running server (it does not surface inline app flows), so even when the
   hook fired it bound nothing. It now reads `protocol.getMetaItems({ type: 'flow' })`
   — the same flattened flow view #2560's cold-boot bind and `GET /meta/flow` use —
   while keeping the teardown of flows removed from the artifact. A failed or
   unavailable protocol read is a no-op and never tears down live flows.

Production is largely unaffected (a deploy reboots the process, so #2560's
cold-boot bind covers it); this closes the gap for dev and single-instance
Studio authoring.

Verified end-to-end on a clean instance: authored a record-triggered flow in a
package, published it via `POST /packages/:id/publish-drafts` **without
restarting**, then updated a matching record and observed the flow fire (before
the fix it did not). New regression tests boot a kernel whose protocol serves a
flow only after boot and assert `metadata:reloaded` binds it — and that the
re-sync reads the protocol, not `metadata.list` — both failing on the pre-fix code.

---
'@objectstack/spec': patch
---

docs(spec): retire the stale `renderViaSchema` forward-reference now that objectui#2546 landed (ADR-0085 PR4 follow-up, #2548)

The `ObjectSchema` source comment forward-referenced `renderViaSchema`
retiring "together with the legacy monolith render path" — a promise about
work that had not yet shipped. That path, and the `detail.renderViaSchema`
kill-switch that was its only steering wheel, were removed in objectui#2546
(ADR-0085 PR4). The comment now records the completed state with a breadcrumb
to that PR instead of a forward reference, closing the cleanup #2546 flagged.

Comment-only change; no type, schema, or runtime behavior is affected.

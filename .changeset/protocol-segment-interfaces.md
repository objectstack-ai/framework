---
'@objectstack/spec': minor
---

Segment `ObjectStackProtocol` into per-domain protocol interfaces (ADR-0076 D9)

`ObjectStackProtocol` was a single 70-method interface spanning 11 unrelated domains. It is now the **composition** of focused per-domain contracts — `DataProtocol`, `MetadataProtocol`, `AnalyticsProtocol`, `AutomationProtocol`, `PackageProtocol`, `ViewProtocol`, `PermissionProtocol`, `WorkflowProtocol`, `RealtimeProtocol`, `NotificationProtocol`, `AiProtocol`, `I18nProtocol`, `FeedProtocol` — all newly exported.

`ObjectStackProtocol` now `extends` all of them and is **shape-identical** to the previous flat interface, so every existing implementation/consumer is unaffected (non-breaking). New code should depend on the narrowest slice it needs (e.g. `DataProtocol`). Per ADR-0076 D9 (rev.7) the composed union is transitional; capability availability is provided at runtime by the discovery `services` registry.

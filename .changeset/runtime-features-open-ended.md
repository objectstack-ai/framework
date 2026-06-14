---
"@objectstack/cloud-connection": minor
---

RuntimeConfigPlugin: make the per-request `features` seam open-ended and plan-agnostic (open-core boundary, cloud ADR-0012).

The framework now transports an opaque feature map: a host's policy hook may return ANY boolean feature keys and they pass through to the SPA verbatim — the framework no longer enumerates a distribution's commercial feature catalog. Adds `resolveFeatures` (plan-agnostic) and `RuntimeFeatureOverrides`; deprecates `resolvePlanFeatures` / `RuntimeConfigPlanFeatures` (still honoured for backward compatibility).

---
'@objectstack/plugin-security': patch
---

fix(security): fail-closed sentinel for on-behalf-of reads on getReadFilter (#2852)

`getReadFilter` (the read-scope provider the analytics/raw-SQL path binds to)
resolves only the caller's own ceiling — the ADR-0090 D10 delegator RLS
intersection that the engine middleware applies to find/count/aggregate is not
implemented on this path. Computing a filter here for a delegated (on-behalf-of)
context would therefore silently widen the read past the delegator's scope.

Until the intersection is threaded through `computeRlsFilter` (tracked with
#2920 B1 / ADR-0095 D1), `getReadFilter` now denies fail-closed (deny sentinel +
error log) when `context.onBehalfOf.userId` is set. System on-behalf-of bypasses
ahead of the guard, and no agent surface reaches analytics today, so this is a
latent-invariant guard rather than a live-traffic behavior change.

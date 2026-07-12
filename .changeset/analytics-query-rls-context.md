---
'@objectstack/runtime': patch
---

**Security fix (#2852): `/analytics/query` and `/analytics/sql` now run scoped to the caller.**

`handleAnalytics` dropped the request's execution context — `analyticsService.query(body)` was called with no context, so the analytics service's per-object read-scope provider (`getReadScope` → security `getReadFilter`) received `undefined` and applied **no tenant/RLS filter**. An authenticated caller could query analytics datasets and receive rows their row-level security would otherwise hide.

Fix: thread `context.executionContext` into `analyticsService.query(…)` and `generateSql(…)` (both already accept it), so each object in the query is scoped by its per-object read filter.

Note: the analytics read-scope provider (`getReadFilter`) does not yet apply the ADR-0090 D10 agent delegator intersection — latent today because analytics is not reachable over the OAuth `/mcp` surface; tracked in #2852 for when it is.

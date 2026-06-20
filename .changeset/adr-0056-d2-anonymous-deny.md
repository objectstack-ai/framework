---
"@objectstack/rest": patch
---

feat(rest): warn on fail-open anonymous posture (ADR-0056 D2, warn→enforce)

Secure-by-default work for the data API. The deny capability already exists
(`api.requireAuth=true` rejects anonymous via `enforceAuth`, and share-link /
`guest_portal` / control-plane routes are exempt) — but the **default is fail-open**
(`requireAuth=false`), so an object with no OWD/RLS is world-readable with no signal.
This adds a boot-time WARN when running in that posture, making it explicit
(consistent with D4/D8 honesty). The global default is deliberately NOT flipped here
— that is a release-gated decision; flipping it would 401 deployments that rely on
anonymous reads. Proven by the `showcase-anonymous-deny` dogfood test (anonymous
read+write → 401, authenticated → 200, control-plane open).

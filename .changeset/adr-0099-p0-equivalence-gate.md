---
'@objectstack/plugin-security': patch
---

ADR-0099 P0: land the probe-vs-carried-rung equivalence gate in the authz matrix (`authz-matrix-gate.test.ts`) — seeded-shape equivalence cells, two adversarial `KNOWN DIVERGENCE` pins (scoped `admin_full_access` grant; piecemeal platform-exclusive capability), the I2 nesting and I3 narrowing invariant cells, posture-blindness staging pins for the P1 flip, and the EXTERNAL dead-branch cell. Extracts the platform-admin capability probe as the exported pure `hasPlatformAdminCapability` (mechanical, behavior unchanged). Test-only gate; the ADR-0099 P1 flip lands behind it (#3211).

---
'@objectstack/plugin-security': patch
---

ADR-0099 P2′ (#3211 M3′): pin the two-axis Amendment in the authz matrix. The original P2 (collapse the Layer 1 tier onto posture) was rejected — Layer 1's tier input is the per-object super-bit, a per-principal × per-object delegation primitive posture cannot represent. New cells pin: seeded-face agreement (seeded super-bit holders are already ≥ TENANT_ADMIN), the load-bearing delegation cell (a MEMBER with a delegated per-object `viewAllRecords`/`modifyAllRecords` short-circuits Layer 1 yet stays walled by Layer 0 — the auditor pattern), invariant I7 (the scope axis never crosses a boundary posture has not opened), and the contrast that the bit is a real grantable capability, not conditionally inert. Test-only; zero behavior change.

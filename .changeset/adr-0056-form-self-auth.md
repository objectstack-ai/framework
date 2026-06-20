---
"@objectstack/plugin-security": minor
"@objectstack/rest": patch
---

feat(security): declaration-derived public-form authorization (ADR-0056, Option A)

Public form submissions are now authorized by the **declaration**, not by a
deployment-configured `guest_portal` profile. The form-submit route derives a narrow
`publicFormGrant: { object }` from the matched form's target object; the SecurityPlugin
honors it as a least-privilege capability — **create + the immediate read-back on THAT
object only**, with no userId, and crucially NOT the anonymous fall-open. This makes
public forms work under secure-by-default (`requireAuth`) **without** a hand-configured
`guest_portal`, scoped to exactly the declared object (the field allow-list is still
enforced at the route; `guest_portal`/`anonymous` are kept on the context for back-compat
with guest-detection hooks). It is the prerequisite that unblocks the eventual
`requireAuth` default flip, and generalizes the platform principle "public access =
declared + runtime-derived scoped grant" (the same shape share-links already use).
Proven by `form-self-auth` dogfood (create on target allowed; cross-object + update/delete
denied). plugin-security 108, rest 121, full dogfood 98 — no regression.

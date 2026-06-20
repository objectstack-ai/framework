---
"@objectstack/spec": minor
"@objectstack/plugin-security": minor
---

feat(security): app-declarable default profile (`isDefault`, ADR-0056 D7)

An app can now declare its default access posture for authenticated users who have
no explicit grants, via `isDefault: true` on a permission set — instead of always
inheriting the built-in `member_default`. The SecurityPlugin resolves the fallback
from the `isDefault` profile when no explicit `fallbackPermissionSet` is configured
(falling back to `member_default` when none is declared — non-breaking). This is the
foundation for SSO/JIT provisioning (mapping IdP claims → a declared default profile).
Proven by the `showcase-default-profile` dogfood test: a sign-up governed by a custom
default that grants only `showcase_announcement` can read it but is denied
`showcase_private_note` (which the `member_default` wildcard would have allowed).

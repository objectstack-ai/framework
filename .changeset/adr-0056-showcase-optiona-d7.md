---
"@objectstack/plugin-security": minor
"@objectstack/cli": patch
"@objectstack/example-showcase": patch
---

feat(security): public-form demo (Option A) + app-declared default profile wiring (ADR-0056 D7)

Wires ADR-0056's app-declarable default profile through the CLI so it actually
takes effect under `pnpm dev`. `@objectstack/plugin-security` exports a new
`appDefaultProfileName(permissions)` helper that extracts the first
`isProfile && isDefault` profile name from a stack; `@objectstack/cli` (`serve.ts`)
passes it as the SecurityPlugin `fallbackPermissionSet` (undefined → built-in
`member_default` preserved, so apps that declare no default are unaffected).

The showcase gains a working web-to-lead **public form** (`showcase_inquiry` +
an `allowAnonymous` FormView authorized by the declaration-derived
`publicFormGrant`, no `guest_portal` profile) and an app-declared default
profile (`showcase_member_default`), each covered by a dogfood proof over the
real HTTP stack.

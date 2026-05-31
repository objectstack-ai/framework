---
"@objectstack/plugin-security": patch
"@objectstack/cli": patch
---

Fix: the first-boot platform-admin promotion no longer gets stolen by the
`usr_system` seed identity, and the dev seed admin uses fixed, well-known
credentials.

**`@objectstack/plugin-security` — `bootstrapPlatformAdmin` skips the system user**

`5e831dea3` (#1392) added `ensureSeedIdentity` to the runtime SeedLoader,
which upserts a non-loginable system identity (`usr_system`, role `system`,
`system@objectstack.local`) to own seeded records — created *before* the first
human sign-up. Because `bootstrapPlatformAdmin` promoted the **earliest-created**
`sys_user`, on any app that ships seed data `usr_system` won the promotion and
the real admin login stayed at `role: user`. Login succeeded but Setup and
Studio (gated by `setup.access` / `studio.access` on `admin_full_access`) were
invisible — a silent, confusing regression.

`bootstrap-platform-admin.ts` now filters out the system account
(`id === SystemUserId.SYSTEM || role === 'system'`) when picking the first user
to promote, and the "an admin already exists" short-circuit ignores any
`admin_full_access` grant held by `usr_system` — so a database where it was
wrongly promoted self-heals on the next boot.

**`@objectstack/cli` — `os dev` seeds `admin@objectos.ai` / `admin123`**

The `--admin-email` / `--admin-password` defaults changed from
`admin@dev.local` / `admin12345` to the fixed, well-known
`admin@objectos.ai` / `admin123`, so tooling and docs never have to guess the
seeded credentials. Override with `--admin-email` / `--admin-password`.

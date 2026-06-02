---
"@objectstack/plugin-auth": patch
"@objectstack/cli": patch
"@objectstack/plugin-dev": patch
---

fix(dev): seed the dev admin in-process and fix the port-drift seed failure.

`os dev` (and `pnpm dev:showcase`) seeded the admin over HTTP against a
hard-coded `localhost:3000`. In dev, `serve` auto-shifts off a busy port, so
the seed POST hit the wrong server (or nothing) and the running instance never
got an admin. A second, divergent seed in `plugin-dev` inserted a
credential-less `sys_user` row that could not log in.

Consolidate to a single in-process seed:

- **`@objectstack/plugin-auth`** — `maybeSeedDevAdmin()` runs on `kernel:ready`
  and creates `admin@objectos.ai` / `admin123` through better-auth's real
  `signUpEmail` pipeline (hashed credential), so the account is loginable;
  `plugin-security` then promotes it to platform admin. Empty-DB only
  (excludes the system service account), idempotent, never overwrites an
  existing account. Hard-gated to `NODE_ENV=development`; opt out with
  `OS_SEED_ADMIN=0`.
- **`@objectstack/cli`** — removed the HTTP seed; `--seed-admin` now passes
  `OS_SEED_ADMIN[_EMAIL|_PASSWORD]` to the serve child. `serve` publishes its
  actually-bound port over IPC and to a `runtime.<env>.json` state file under
  `OS_HOME`.
- **`@objectstack/plugin-dev`** — removed the credential-less raw insert;
  `seedAdminUser` maps to the unified `OS_SEED_ADMIN` toggle.

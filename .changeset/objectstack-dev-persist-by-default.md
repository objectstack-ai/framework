---
'@objectstack/cli': minor
'@objectstack/example-showcase': patch
---

fix(cli): `objectstack dev` persists data by default (no more `:memory:` wipe on restart)

`objectstack dev` historically fell back to a `:memory:` SQLite database when no `--database` / `OS_DATABASE_URL` was given, so **every restart silently wiped all data and AI-authored metadata** — you'd build an app, restart, and it would be gone, which makes local app-building unusable.

`dev` now defaults to a persistent, project-anchored SQLite file at `<cwd>/.objectstack/data/dev.db` (gitignored, per-project). Existing opt-outs are unchanged and take precedence: `--fresh` (ephemeral temp DB), `--database <url>`, `OS_DATABASE_URL`/`DATABASE_URL`, or an explicit in-memory driver (`--database-driver memory` / `OS_DATABASE_DRIVER=memory`). Resolution is extracted into the testable `resolveDefaultDevDbUrl()` helper.

The **app-showcase** example drops its explicit `:memory:` datasource override (which would otherwise route data back to memory and defeat the new default), so it persists across restarts out of the box.

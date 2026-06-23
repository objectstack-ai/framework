---
"@objectstack/service-datasource": patch
"@objectstack/cli": patch
"@objectstack/runtime": patch
---

fix(cli): extend native better-sqlite3 → wasm SQLite auto-fallback to the persistent-file / `--artifact` dev path (#2229)

The native-`better-sqlite3` → wasm SQLite → in-memory step-down previously only
guarded the zero-config `:memory:` dev branch of `serve`. A normal
`objectstack dev` run never reaches it — `dev` injects a persistent `file:` DB
(so AI-authored data survives restarts) and `--artifact` boots resolve sqlite
through the datasource factory — both of which constructed
`better-sqlite3` directly with no probe and no fallback. An ABI mismatch (e.g.
a cached prebuilt binary built for a different Node version) was therefore not
caught at boot and surfaced later as a runtime `Find operation failed` on the
first query.

The probe-by-connect + step-down is now hoisted into a shared
`resolveSqliteDriver` helper (`@objectstack/service-datasource`) and applied to
both previously-unguarded sqlite construction sites: the explicit `sqlite` /
`file:` branch in `serve.ts` and the sqlite branch of the default datasource
driver factory. better-sqlite3 loads its native addon lazily (first query), so
the helper forces the load with a `SELECT 1` and, **in dev only**, steps down to
wasm SQLite (real SQL + on-disk persistence — the same `file:` keeps working)
then to the in-memory driver as a last resort, emitting the existing
`⚠ native better-sqlite3 unavailable …` warning. In production the native driver
is returned unprobed so a load failure surfaces loudly (fail-closed) rather than
silently degrading to a different engine.

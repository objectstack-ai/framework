---
"@objectstack/plugin-dev": patch
"@objectstack/service-datasource": patch
---

fix(build): don't bundle lazily-imported optional drivers (fixes build break from #1524).

After moving optional internal `@objectstack/*` peerDependencies off `peer` (to
stop the changesets fixed-group major cascade), tsup no longer auto-externalized
them and began bundling the lazily `await import()`-ed driver packages — pulling
in their optional native clients (`mysql` / `oracledb` via knex) and failing the
build. Fix: `service-datasource` externalizes `@objectstack/driver-*` in tsup
(kept as devDeps for tests); `plugin-dev` moves its framework packages to
`dependencies` (auto-externalized; it's a dev-only plugin). Full build green.

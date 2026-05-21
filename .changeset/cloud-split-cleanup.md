---
'@objectstack/cli': minor
---

CLI no longer hard-depends on `@objectstack/service-cloud`. The control plane
(`apps/cloud` + `@objectstack/service-cloud`) and tenant runtime (`apps/objectos`)
have been split into a private companion repo `objectstack-ai/cloud`. Framework
remains pure open-core.

User impact:
- `os serve --mode=cloud` keeps working in cloud-aware distributions — the CLI
  loads `@objectstack/service-cloud` via dynamic `import()` with try/catch and
  surfaces a clear "install the cloud distribution" hint when absent.
- Root `pnpm dev` / `pnpm start` / `pnpm doctor` scripts in this repo are
  removed (they were thin filters of `@objectstack/objectos`, which no longer
  lives here). For a runnable local stack, use one of the examples
  (`pnpm --filter @example/app-crm dev`).

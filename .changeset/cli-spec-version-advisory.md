---
'@objectstack/cli': minor
---

feat(cli): surface the migration guide when an app's specVersion trails the installed platform

`os validate`, `os build`/`os compile`, and `os doctor` now emit a non-blocking
advisory when the app's authored `manifest.specVersion` declares an OLDER major
than the `@objectstack/spec` actually installed in its `node_modules` — pointing
at the curated per-major migration guide (`https://docs.objectstack.ai/docs/releases/v<major>`,
guaranteed to exist by `scripts/check-release-notes.mjs`).

This closes a discoverability gap for downstream/third-party apps: on a platform
upgrade the release notes were only reachable by reverse-engineering per-package
`CHANGELOG.md` files. The advisory now surfaces the guide at the exact moment the
upgrade is exercised. It never fails a build/validate and is not gated by
`--strict`; it also appears in the `--json` output as `specVersionGap`. Logic
lives in a new shared `checkSpecVersionGap()` util (unit-tested; installed
version injectable for tests).

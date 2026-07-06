---
"@objectstack/cli": patch
"@objectstack/plugin-dev": patch
---

Drop the `@objectstack/studio` dependency from `cli` and `plugin-dev`. Since Studio is no longer default-loaded by `os dev` / `os start` / `os serve` (the console hosts it at `/_console/studio/...`), neither package imports it at runtime any more. The only remaining consumer was the ADR-0048 app-split test in `cli`, which now exercises the identical one-app-package code path via Setup + Account. The `@objectstack/studio` package itself is unchanged and still registerable explicitly.

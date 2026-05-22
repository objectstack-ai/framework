---
"@objectstack/account": patch
"@objectstack/console": patch
"@objectstack/studio": patch
---

Publish `@objectstack/account` and `@objectstack/console` to npm.

Previously both apps were marked `private: true`, which prevented `changeset publish`
from releasing them. The CLI (`@objectstack/cli`) resolves these packages from
`node_modules/@objectstack/{account,console,studio}` to serve their built `dist`
assets, so third-party projects could not consume them via `pnpm add`.

- Removed `private: true` from `apps/account` and `apps/console`.
- Added `publishConfig.access: public` to `account`, `console`, and `studio` for
  scoped-package publish safety.

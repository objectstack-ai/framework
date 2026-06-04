---
'@objectstack/hono': patch
---

feat(hono): re-export the `Hono` type from `@objectstack/hono`

Downstream apps that consume `createHonoApp()` only need the `Hono` type to
annotate the returned app. They can now `import type { Hono } from '@objectstack/hono'`
instead of adding their own `hono` dependency, which guarantees a single
`hono` across a `link:`/cross-package boundary (no duplicate-package
type-identity errors, no version-pin alignment). `hono` remains a normal
runtime dependency of this package, so standalone usage is unaffected.

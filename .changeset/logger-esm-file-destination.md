---
"@objectstack/core": patch
---

**`createLogger({ file })` now actually writes the file under ESM.** `openFileStream` loaded `fs` with a lazy `require()` to keep the browser-safe logger entry out of the `fs` bundle graph; esbuild rewrites that to its `__require` shim in the ESM output, which throws `Dynamic require of "fs" is not supported`, and a bare `catch {}` swallowed it. Since the workspace is `type: module`, every Node ESM consumer — `os serve`, `os dev` — silently got no file logging at all, while the CJS build kept working. The builtin now loads via `process.getBuiltinModule` (opaque to bundlers, works in both module systems, with a `require` fallback for Node < 20.16), and a `file` destination that cannot be opened reports itself on stderr instead of disappearing.

Turning the destination back on also fixed three faults that were unreachable while it never opened: `child()` opened a second stream per child and orphaned it, destroying a child logger closed the stream its parent and siblings were still writing to, and an async open failure (e.g. an unwritable path) hit an `'error'` event with no listener and took the process down.

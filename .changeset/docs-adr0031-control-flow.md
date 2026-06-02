---
"@objectstack/spec": patch
---

docs(automation): document ADR-0031 control-flow constructs; fix dangling reference card

- **guide**: `content/docs/guides/metadata/flow.mdx` now documents the structured
  control-flow constructs — the `loop` container, `parallel` block (implicit
  join), and `try_catch` (try/catch/retry) — with config examples and the
  region/DAG model. The Node Types table is updated accordingly.
- **doc generator**: `build-docs.ts` now cards only reference pages that were
  actually generated. Control-flow's schemas embed CEL-expression transforms
  (like `Flow`/`FlowEdge`) and so have no JSON-Schema page; the index previously
  carded every `.zod.ts`, producing a dangling "Control Flow" 404 link. Cards
  now align with `meta.json` (generated pages only).
- **doc generator (build fix)**: `escapeMdxDescription` now escapes a lone `<`
  or `{` that has no matching close (e.g. a SemVer range like `">=4.0 <5"` in a
  `.describe()`). MDX parsed the bare `<5` as a JSX tag and failed the entire
  docs build (`Unexpected character` in `kernel/manifest.mdx`); the docs site now
  builds again.

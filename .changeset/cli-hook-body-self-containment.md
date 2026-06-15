---
"@objectstack/cli": patch
---

fix(cli): keep non-self-contained hook/action handlers out of body-only lowering (#1876)

A hook/action handler that references a **module-scope identifier** (a helper,
an import, a top-level const) was lowered to a metadata-only `body` by
`objectstack build` — but that body ships without the referenced definition, so
it throws `ReferenceError` at runtime. Build was green; the app didn't boot —
exactly the build↔runtime parity gap #1876 describes.

`extractHookBody` now runs a conservative free-identifier analysis (via the
`ts` AST already available through `ts-morph`): it computes the handler's free
variables — names referenced but bound neither by the function (params/locals)
nor by the JS runtime (a generous global allow-list). When any are found,
extraction is refused, so `lowerCallables` falls back to **bundling** the real
function (esbuild carries the closure along) — no `ReferenceError`, no build
break. The analysis is biased to never over-report: a missed case preserves
today's behavior, and a false positive only causes a self-contained handler to
be bundled instead of inlined (a size cost, never a correctness or build
failure).

Note: the other #1876 repro — legacy `object`/`aggregate` dashboard widgets
passing build but rejected by the runtime — is already closed on `main` by the
ADR-0021 single-form cutover (`DashboardWidgetSchema` now requires
`dataset`/`values`, enforced by the same schema build and runtime both use).

---
'@objectstack/spec': patch
---

fix(spec): keep `lazySchema` proxies identity-compatible with `z.toJSONSchema` (objectui#2561)

zod's `toJSONSchema` keys its `seen` map on the node object it traverses — the `lazySchema` Proxy wherever a schema is referenced lazily (`z.lazy(() => X)` recursion getters, direct conversion roots) — while its wrapper-type processors (pipe/lazy/optional/default/…) look themselves up via the REAL instance captured at construction (`inst._zod.processJSONSchema = (ctx, …) => pipeProcessor(inst, …)`). The identity mismatch crashed conversion with `Cannot set properties of undefined (setting 'ref')`.

This stayed latent while lazy-referenced schemas were plain objects (the object processor never looks itself up); ADR-0089 D3a turned `PageComponentSchema` / `FormFieldSchema` into `.strict().transform(…)` **pipes**, which broke ObjectUI Studio's spec-derived Page/View inspector JSONSchema derivation under spec 15.

Fix: the proxy now serves a memoised `_zod` facade that prototype-delegates to the real internals and wraps only `processJSONSchema` to alias the proxy's `seen` entry onto the real instance before delegating. Parse behavior is unchanged; `OS_EAGER_SCHEMAS=1` remains the bypass. Regression tests cover the D3a pipe shape, recursion through `z.lazy(() => proxy)`, mixed proxy+real traversal, and the full `PageSchema` / `ViewSchema` Studio derivation paths.

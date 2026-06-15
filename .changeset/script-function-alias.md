---
"@objectstack/service-automation": patch
"@objectstack/cli": patch
---

feat(automation): accept `functionName` alias + `invoke_function` marker on script nodes (#1870 DX)

AI-authored templates commonly emit `config: { actionType: 'invoke_function', functionName: 'my_fn' }`,
but the runtime only read `config.function`. Now:
- `config.functionName` is accepted as an alias for `config.function` (runtime + build).
- `actionType: 'invoke_function'` is treated as a MARKER ("call the named function") — the
  name comes from `function`/`functionName`, not from actionType itself; it no longer
  tries to resolve a function literally named `invoke_function`.
- `objectstack build` errors on `actionType: 'invoke_function'` with no `function`/`functionName`
  (it names no callable) instead of letting it fail at runtime.

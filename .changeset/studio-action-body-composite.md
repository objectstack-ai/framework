---
"@objectstack/spec": patch
---

fix(spec): render action `body` as a composite editor (language + source) instead of a flat code field

An action's `body` is a discriminated union (`HookBodySchema`), the same shape hooks use, but `action.form.ts` mapped the whole field to `{ widget: 'code' }`, so the Studio inspector fed the union object to a single JS editor and rendered `[object Object]`. The layout now mirrors the working `hook.form.ts`: a composite with a `language` select, a `source` code editor, and the L2-only capability/timeout knobs.

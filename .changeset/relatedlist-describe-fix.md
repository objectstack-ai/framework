---
"@objectstack/spec": patch
---

Docs: correct the `Field.relatedList` JSDoc + `.describe()` to match the shipped behavior (#2579 follow-up). Non-primary related lists stack under a single shared "Related" tab and only `'primary'` earns its own tab — there is no count-based auto-split (the "count-aware" wording was a stale draft). Comment/description only; no code or behavior change.

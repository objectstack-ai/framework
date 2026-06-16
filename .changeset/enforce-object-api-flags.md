---
"@objectstack/rest": minor
---

feat(rest): enforce object-level API exposure (`enable.apiEnabled` / `enable.apiMethods`) on the REST data surface (ADR-0049 #1889). Previously these flags were parsed but unenforced — an object could not be hidden from the automatic API, a false sense of security. Now: `apiEnabled: false` → the object's `/api/v1/data/{object}` routes return 404 (existence not revealed); a non-empty `apiMethods` whitelist → operations outside it return 405. Enforced across list/get/create/query/update/delete/import/export/batch/createMany/updateMany/deleteMany. Default-allow (objects with no `enable` block, or `apiEnabled` unset/true and no `apiMethods`) behave exactly as before — no regression. This is the *external* API boundary only; internal callers (hooks, flows, objectql) are unaffected.

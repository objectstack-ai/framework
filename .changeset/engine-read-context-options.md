---
"@objectstack/objectql": minor
---

engine: accept execution context via the trailing `options` argument on the read
methods (`find` / `findOne` / `count` / `aggregate`), aligning them with the
write methods (`insert` / `update`).

Previously reads took context only inside the query (`query.context`) while
writes took it in a trailing `options.context`. The same `{ context }` object was
therefore correct as the 3rd argument to `insert` but **silently dropped** as the
3rd argument to `find` — a recurring footgun where an intended `isSystem` bypass
just vanished (e.g. control-plane reads returning empty once org-scoping hooks
were added). Now "execution context goes in the trailing `options` argument" is a
single rule across reads and writes. `query.context` remains fully supported; when
both are supplied, `options.context` wins.

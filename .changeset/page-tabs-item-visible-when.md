---
"@objectstack/spec": minor
---

Conditional tabs (#2606): `page:tabs` items accept an optional `visibleWhen` CEL predicate. When it evaluates FALSE the whole tab — header **and** panel — is omitted from the tab strip, unlike a child component's own `visibleWhen`, which hides only the panel content and leaves an empty tab header behind. The predicate binds the same environment as page-component `visibleWhen` (`record` + `current_user`, plus page state as `page.<var>`) and is re-evaluated live when page variables change.

Per ADR-0089 the key uses the canonical `*When` name from day one — the deprecated `visibility` / `visibleOn` aliases are **not** accepted on tab items (this surface is new; there is no legacy metadata to alias for).

Additive and back-compatible: items without `visibleWhen` behave exactly as before.

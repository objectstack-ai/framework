---
"@objectstack/spec": minor
---

Add `openIn` to `ActionSchema` — a declarative new-tab control for static `type:'url'` actions.

Counterpart to objectui issue #2043, which added a first-class `openIn?: 'self' | 'new-tab'`
field to its public `ActionSchema` and honors it in `ActionRunner.executeUrl` (read with
priority over the legacy `params.newTab` / external-URL heuristic). Until now
`@objectstack/spec`'s `ActionSchema` was a plain `z.object(...)` that **stripped** unknown
keys, so `openIn` written via `defineAction({...})` was silently dropped at build and never
reached objectui's runtime. Authors (e.g. plan-management) therefore couldn't use it.

```ts
defineAction({
  name: 'print_a3',
  label: '打印总表(A3)',
  type: 'url',
  target: '/print/a3?id=${record.id}',
  openIn: 'new-tab',   // now preserved end-to-end
});
```

- `openIn: 'new-tab'` — open a **static** `target` URL in a new tab. No handler, no pre-open.
- `openIn: 'self'` — navigate in place.
- omitted — external/absolute URLs open in a new tab; relative URLs navigate in place.

Kept distinct from the existing `opensInNewTab` / `newTabUrl` (those pre-open an
`about:blank` tab synchronously for **async** SSO-redirect handlers — not merged). It is a
static execution option and must stay OUT of `params` (which is user-input-collection only).

Consuming projects must upgrade `@objectstack/spec` to this version for the declarative
new-tab path to work end-to-end.

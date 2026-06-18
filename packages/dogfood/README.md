# @objectstack/dogfood

Runtime regression gate. Private (never published).

## Why

Static gates — `build`, unit tests, spec-liveness, CodeQL — verify each layer in
isolation, usually against mocks. They cannot catch a break that only appears
when the **real engine + strategies + services + HTTP context run together**.

The canonical example is [#2018](https://github.com/objectstack-ai/framework/pull/2018):
"organization timezone drives analytics date bucketing" was broken across three
seams (analytics strategy routing, in-memory count, REST execution-context).
Every static gate was green — 900+ unit tests included — because each layer was
individually correct and individually mocked. The bug was only visible by
booting the app and comparing a date bucket under UTC vs a non-UTC org timezone.

This package boots **real example apps in-process** (in-memory SQLite), wired
with the same service plugins `objectstack dev` loads, and exercises them
through the **real HTTP surface** (Hono request-injection — no ports, no
sockets, CI-stable). Tests act as a browser client would: sign in, hit
`/api/v1/...`, assert on real responses.

## Layout

- `src/harness.ts` — `bootDogfoodStack(config)` → `{ kernel, api, raw, signIn, apiAs, stop }`.
- `test/*.dogfood.test.ts` — golden flows. Each should assert on **observable
  output** (a number, a bucket label, a row count), not just "no error".

## Adding a golden test

1. Pick a real user flow that a static test can't cover (it spans engine +
   service + HTTP, or depends on seeded/written data).
2. `bootDogfoodStack(<appConfig>)`, `signIn()`, drive it via `api()/apiAs()`.
3. Assert on the concrete result.
4. **Prove it catches the bug**: temporarily revert the relevant fix and confirm
   the test goes red. A green-on-the-bug test is not a gate.

Runs in CI as the `Dogfood Regression Gate` job (and under `turbo run test`).

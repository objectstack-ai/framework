---
'@objectstack/runtime': minor
'@objectstack/types': minor
---

feat(runtime): env-overridable sandbox hook/action timeout default (#3259)

The QuickJS sandbox enforces a wall-clock deadline on every hook/action
invocation (250ms hooks / 5000ms actions). Each invocation compiles a fresh
WASM module, and a nested hook compiles ANOTHER one inside the parent's budget,
so on a heavily loaded or slow host — an oversubscribed CI runner, constrained
production hardware — that fixed VM-creation cost alone can trip the hook
default even while the VM is still making progress. On CI this surfaced as an
intermittent `hook '…' exceeded timeout of 250ms` flake on PRs that never
touched the sandbox path.

The per-invocation timeout DEFAULT is now resolvable from the environment via
`resolveSandboxTimeoutMs` (`@objectstack/types`), which `QuickJSScriptRunner`
consults, so an operator can raise the floor once, deployment-wide, instead of
re-tuning every call site:

- `OS_SANDBOX_HOOK_TIMEOUT_MS` — default hook budget (ms)
- `OS_SANDBOX_ACTION_TIMEOUT_MS` — default action budget (ms)

Precedence is unchanged: an explicit `hookTimeoutMs` / `actionTimeoutMs` passed
to the runner still wins over the env var, and a body's own declared `timeoutMs`
still wins over the resolved default (the smaller of the explicit values). Only
a positive integer is honored; unset / empty / non-numeric / non-positive keeps
the built-in 250ms / 5000ms defaults, so behaviour is byte-for-byte unchanged
when the vars are absent — production is unaffected unless it opts in.

CI's Test Core now sets `OS_SANDBOX_HOOK_TIMEOUT_MS=10000` so the shared-runner
load flake can't recur; genuine hangs stay bounded by each test's own timeout.

---
'@objectstack/runtime': patch
---

fix(runtime): surface the clean business message from a failed action, not the sandbox debug wrapper

A user throw inside a script/action body is wrapped by the sandbox as
`<kind> '<name>' threw: <msg>` for server logs, but the action HTTP endpoint
returned that whole wrapper as the client-facing `error` — so an action's error
toast leaked the debug prefix to end users (e.g. `action 'lead_apply_convert'
threw: Error: 线索信息不完整…` instead of just `线索信息不完整…`).

`SandboxError` now also carries `innerMessage`: the plain business message with
no `<kind> '<name>' threw:` wrapper and no default `Error: ` name prefix. The
action route surfaces `innerMessage` to the client and keeps the full wrapper in
the server log.

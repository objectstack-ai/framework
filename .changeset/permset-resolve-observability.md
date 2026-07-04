---
"@objectstack/plugin-security": patch
---

fix(security): surface swallowed permission-set resolution failures (#2565)

`PermissionEvaluator.resolvePermissionSets` swallowed metadata `list()` and
`sys_permission_set` dbLoader failures silently — fail-closed (unresolvable
sets grant nothing), but a transient DB error made custom permission sets
vanish with no trace, leaving the resulting 403s undiagnosable. The evaluator
now accepts an optional `{ logger }` and emits one `warn` per failed source,
naming the unresolved permission sets and the error. SecurityPlugin wires its
plugin logger into both call sites. Resolution behavior is byte-identical.

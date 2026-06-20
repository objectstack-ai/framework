---
"@objectstack/spec": minor
"@objectstack/plugin-sharing": minor
---

feat(sharing): configurable role-hierarchy widening — `role_and_subordinates` recipient (ADR-0056 D6)

Role-hierarchy access widening ("a manager sees records shared with their team") is now
**implemented and configurable per sharing rule**, not a hardcoded no-op. The
`role_and_subordinates` recipient (declarable on `sys_sharing_rule.recipient_type`) expands,
at evaluation time, to the named role **plus every subordinate role** by walking the
`sys_role.parent` hierarchy via a new `RoleGraphService` (mirroring the department/team
graphs; cycle-safe). Previously `Role.parent` was declared but never consumed — a silent
no-op flagged by the ADR-0056 audit. This is the Salesforce "grant access using hierarchies"
model expressed declaratively: each rule chooses whether to roll up the hierarchy. Unit-proven
(role-graph traversal, subordinate-user expansion, cycle safety); the recipient is added to
the authoring select + the `SharingRuleRecipientType` contract.

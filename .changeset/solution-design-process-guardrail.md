---
'@objectstack/service-ai': patch
---

fix(ai): solution_design no longer models a process/approval as a table

Asking the assistant to "design expense reimbursement" made it, by default, invent an `approval_record` TABLE to represent the approval process — a non-functional "process-as-data" anti-pattern. It only switched to a flow after the user pushed back.

Hardens the default in two places:

- **`propose_blueprint` generation prompt** (the "metadata architect" system message): status/lifecycle is modeled as a `select` field, never a table; it must NOT create `approval` / `approval_record` / `approval_step` / `workflow` / `process` objects (a process is a flow, its trail comes from platform history); the people a process references (approver/reviewer/owner) are `lookup` fields; and if the goal implies a process it adds an assumption that the approval *flow* is a separate step.

- **`solution_design` skill instructions**: the same modeling rules, plus — when the goal involves a process — the agent now PROACTIVELY drafts the approval flow after `apply_blueprint` (call `get_metadata_schema('flow')`, then `create_metadata(type:'flow', …)` with the approval node(s), bound to the same app package) instead of waiting for the user to ask "now create the flow". Optionally adds a `state_machine` rule to block illegal status transitions.

Regression-tested: `solution-design-guardrail.test.ts` asserts the skill instructions carry the no-process-as-table rule, status-as-select, and the proactive-flow step.

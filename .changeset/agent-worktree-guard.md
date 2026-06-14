---
---

chore(agents): enforce worktree-first discipline for parallel agents

Adds a PreToolUse guard (`.claude/hooks/guard-main-checkout.sh`) that blocks
`Edit`/`Write`/`NotebookEdit` while the session's checkout is on the shared
`main` branch, and promotes worktree-first to AGENTS.md Prime Directive #11.
Tooling/docs only — no package version impact (empty changeset to satisfy the
changeset check). Override a deliberate non-task main edit with
`OS_ALLOW_MAIN_EDITS=1`.

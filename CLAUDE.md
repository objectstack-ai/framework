# CLAUDE.md

**[AGENTS.md](./AGENTS.md) is the source of truth for working in this repo — read it.**
Its Prime Directives are binding. Do not rely on this file alone; the one rule that must
never be missed is inlined here because missing it corrupts other agents' work.

## ⛔ Worktree-first — before your FIRST file edit (AGENTS.md Prime Directive #11)

This repo — **and every sibling repo you touch (`objectui`, `cloud`)** — is edited by
**multiple agents at once**. The shared primary checkout has its HEAD switched and its
tree reset *under you*, silently clobbering uncommitted work. **A feature branch on the
shared checkout is NOT enough** — it still gets switched under you. You MUST be in a
**dedicated per-task worktree**:

```
git worktree add ../<repo>-<task> -b <branch> main && cd ../<repo>-<task> && pnpm install
```

Then make all edits there. This applies **per repo**: if a task spans `framework` and
`objectui`, create a worktree in *each*. A PreToolUse hook
(`.claude/hooks/guard-main-checkout.sh`) enforces this — it blocks `Edit`/`Write`/
`NotebookEdit` unless the edited file is in a linked worktree, and it checks the edited
file's own repo (so sibling repos are covered). Deliberate non-task exception:
`OS_ALLOW_MAIN_EDITS=1`. Follow the rule because it's correct, not because the hook fires.

See **AGENTS.md** for the full playbook: branch hygiene, the dev stack, PR flow, and the
rest of the Prime Directives.

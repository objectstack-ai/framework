#!/usr/bin/env bash
# guard-main-checkout.sh — PreToolUse guard enforcing AGENTS.md Prime Directive #11
# (worktree-first). Blocks Edit / Write / NotebookEdit while the session's checkout
# is on the shared `main` branch.
#
# Why: this repo is worked on by multiple agents in parallel. The shared `main`
# checkout has its HEAD switched and the tree reset *under you* by other agents,
# silently clobbering uncommitted edits (observed: a full session's work reverted
# twice). Dedicated per-task worktrees are physically isolated, so edits there are
# safe. This guard turns the documented discipline into a hard stop for the one
# place it actually fails — editing on `main`.
#
# Deliberate exception (a human quick-fix that will still land via PR, never task
# work committed straight to main): export OS_ALLOW_MAIN_EDITS=1 for the session.

set -uo pipefail

# Escape hatch.
if [ "${OS_ALLOW_MAIN_EDITS:-}" = "1" ]; then
  exit 0
fi

dir="${CLAUDE_PROJECT_DIR:-$PWD}"

# Not a git repo (or git unavailable) → nothing to guard, allow.
branch="$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null)" || exit 0

if [ "$branch" = "main" ]; then
  root="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$dir")"
  cat >&2 <<EOF
⛔ Blocked: editing files while on the shared 'main' checkout (branch=main, root=$root).

This repo is worked on by multiple agents in parallel — the shared 'main' tree gets
its HEAD switched and reset under you, silently clobbering uncommitted edits.

Per AGENTS.md Prime Directive #11 (worktree-first), create a dedicated worktree and
re-run your edits from there:

  git worktree add ../framework-<task> -b <branch> main
  cd ../framework-<task> && pnpm install

Deliberate exception (not task work): re-run with OS_ALLOW_MAIN_EDITS=1.
EOF
  exit 2
fi

exit 0

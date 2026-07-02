#!/usr/bin/env bash
# guard-main-checkout.sh — PreToolUse guard enforcing AGENTS.md Prime Directive #11
# (worktree-first). Blocks Edit / Write / NotebookEdit unless the file being edited
# lives in a dedicated git WORKTREE — not the shared primary checkout.
#
# Why: this repo (and siblings objectui/cloud) are edited by MULTIPLE agents at once.
# The shared primary checkout has its HEAD switched and its tree reset *under you* by
# other agents, silently clobbering uncommitted work. A feature branch on the shared
# checkout is NOT enough — it still gets switched under you. Only a dedicated per-task
# worktree is physically isolated.
#
# Hardened vs the old guard (two holes agents fell through):
#   1. Checks "am I in a linked worktree?" — not merely "branch != main". Creating a
#      feature branch on the shared checkout used to pass the guard; now it's blocked.
#   2. Checks the EDITED FILE's repo — not just $CLAUDE_PROJECT_DIR. So editing a
#      sibling repo (objectui/cloud) on its shared checkout from this session is
#      guarded too, instead of silently allowed.
#
# Deliberate exception (a human quick-fix that still lands via PR): OS_ALLOW_MAIN_EDITS=1.

set -uo pipefail

[ "${OS_ALLOW_MAIN_EDITS:-}" = "1" ] && exit 0

# PreToolUse passes the tool call as JSON on stdin; pull out tool_input.file_path.
input="$(cat 2>/dev/null || true)"
file=""
if command -v jq >/dev/null 2>&1; then
  file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi
if [ -z "$file" ]; then
  file="$(printf '%s' "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/^.*"\([^"]*\)"$/\1/' || true)"
fi

# Directory whose checkout we judge: the edited file's dir, else the project/cwd.
if [ -n "$file" ]; then chk="$(dirname "$file")"; else chk="${CLAUDE_PROJECT_DIR:-$PWD}"; fi

# Resolve the git dir for that path. Not a git repo (or git missing) → nothing to guard.
gitdir="$(git -C "$chk" rev-parse --git-dir 2>/dev/null)" || exit 0

# A linked worktree's git-dir lives under <common>/.git/worktrees/<name> → isolated → allow.
case "$gitdir" in
  */worktrees/*) exit 0 ;;
esac

# Otherwise this is the shared PRIMARY checkout → block regardless of branch.
root="$(git -C "$chk" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$chk")"
branch="$(git -C "$chk" rev-parse --abbrev-ref HEAD 2>/dev/null || printf '?')"
name="$(basename "$root")"
cat >&2 <<EOF
⛔ Blocked: editing on the shared PRIMARY checkout, not a worktree.
   repo: $root  (branch: $branch)

Per AGENTS.md Prime Directive #11 (worktree-first): this repo is edited by multiple
agents at once — the shared checkout gets its HEAD switched and tree reset under you,
silently clobbering uncommitted work. A feature branch on the shared checkout is NOT
enough; you must be in a dedicated worktree:

  git worktree add ../${name}-<task> -b <branch> main
  cd ../${name}-<task> && pnpm install    # then re-run your edits there

This guard now checks the edited file's OWN repo, so sibling repos (objectui / cloud)
are covered too — not just this project.

Deliberate non-task exception: re-run with OS_ALLOW_MAIN_EDITS=1.
EOF
exit 2

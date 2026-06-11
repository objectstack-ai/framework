#!/usr/bin/env bash
# Collect the raw material for a release-notes page in content/docs/releases/.
#
# The platform spans three repositories; a release page must aggregate all of
# them. For the release between two framework refs this prints:
#   1. ALL framework commits in the range (feat/fix first). Changesets are a
#      curated subset — commits land without one, so the full log is the
#      source of truth for coverage.
#   2. The changesets consumed by the release (full text — the best prose for
#      items that have one).
#   3. The objectui (Console UI) commit range, derived from the .objectui-sha
#      pin at each ref.
#   4. The cloud (control plane) commits inside the release's time window.
#      Cloud is not pinned by the framework (it tracks it via link: deps and
#      versions independently), so the window between the two refs' commit
#      dates is the best available scope — review its edges by hand.
#
# Usage:
#   scripts/collect-release-notes.sh <prev-ref> [<new-ref>]
#   scripts/collect-release-notes.sh "@objectstack/spec@8.0.1" "@objectstack/spec@9.0.0"
#   scripts/collect-release-notes.sh "@objectstack/spec@9.0.0"        # new-ref defaults to HEAD
#
# Output is markdown on stdout — pipe it to a file and write the curated
# release page from it:
#   scripts/collect-release-notes.sh "@objectstack/spec@9.0.0" > /tmp/v10-material.md
#
# Sibling checkouts are found at ../objectui and ../cloud; override with
# OBJECTUI_ROOT / CLOUD_ROOT.

set -euo pipefail

FRAMEWORK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OBJECTUI_ROOT="${OBJECTUI_ROOT:-$(cd "${FRAMEWORK_ROOT}/../objectui" 2>/dev/null && pwd || true)}"
CLOUD_ROOT="${CLOUD_ROOT:-$(cd "${FRAMEWORK_ROOT}/../cloud" 2>/dev/null && pwd || true)}"

PREV_REF="${1:?usage: collect-release-notes.sh <prev-ref> [<new-ref>]}"
NEW_REF="${2:-HEAD}"

cd "$FRAMEWORK_ROOT"

# Print a commit list with feat/fix first, the rest after — `chore!:` and
# similar breakage hides in the second bucket, so it stays visible.
print_log_split() { # <git-dir> <range-or-window...>
  local dir="$1"; shift
  local all
  all=$(git -C "$dir" log --no-merges --pretty='- %h %s' "$@")
  echo "### feat / fix"
  echo
  grep -E '^- [0-9a-f]+ (feat|fix)' <<< "$all" || echo "_none_"
  echo
  echo "### everything else (watch for chore!: / refactor!: breakage)"
  echo
  grep -Ev '^- [0-9a-f]+ (feat|fix)' <<< "$all" || echo "_none_"
}

echo "# Release material: ${PREV_REF} → ${NEW_REF}"
echo

echo "## 1. Framework — all commits in the range"
echo
print_log_split "$FRAMEWORK_ROOT" "${PREV_REF}".."${NEW_REF}"
echo

echo "## 2. Framework — changesets consumed in this release"
echo

# Changesets deleted anywhere in the range were consumed by `changeset
# version` for this release. (An endpoint diff would miss files added and
# consumed within the same dev cycle, so walk the log instead.)
consumed=$(git log --diff-filter=D --name-only --pretty=format: "${PREV_REF}".."${NEW_REF}" -- '.changeset/*.md' \
  | grep -v 'README' | grep . | sort -u || true)

if [[ -z "$consumed" ]]; then
  echo "_None found — is ${NEW_REF} past the 'chore: version packages' commit?_"
else
  while IFS= read -r f; do
    echo "### ${f}"
    echo
    echo '```md'
    # The file may have been added after PREV_REF; show its last pre-deletion state.
    git show "$(git log --diff-filter=D --pretty=%H -1 "${NEW_REF}" -- "$f")~1:$f" 2>/dev/null \
      || git show "${PREV_REF}:${f}"
    echo '```'
    echo
  done <<< "$consumed"
fi

echo "## 3. Console UI (objectui) — pin range"
echo

prev_sha=$(git show "${PREV_REF}:.objectui-sha" 2>/dev/null || true)
new_sha=$(git show "${NEW_REF}:.objectui-sha" 2>/dev/null || cat .objectui-sha)

echo "- previous pin: \`${prev_sha:-<none>}\`"
echo "- this release: \`${new_sha}\`"
echo

if [[ -z "$prev_sha" ]]; then
  echo "_No .objectui-sha at ${PREV_REF}; cannot compute the range._"
elif [[ "$prev_sha" == "$new_sha" ]]; then
  echo "_Console pin unchanged — no objectui delta in this release._"
elif [[ -z "$OBJECTUI_ROOT" || ! -d "$OBJECTUI_ROOT/.git" ]]; then
  echo "_objectui checkout not found (set OBJECTUI_ROOT); range is ${prev_sha}..${new_sha}_"
else
  print_log_split "$OBJECTUI_ROOT" "${prev_sha}..${new_sha}"
fi
echo

echo "## 4. Cloud (control plane) — time window"
echo

prev_date=$(git log -1 --format=%cI "${PREV_REF}")
new_date=$(git log -1 --format=%cI "${NEW_REF}")
echo "- window: ${prev_date} → ${new_date} (cloud is not pinned; window edges are approximate)"
echo

if [[ -z "$CLOUD_ROOT" || ! -d "$CLOUD_ROOT/.git" ]]; then
  echo "_cloud checkout not found (set CLOUD_ROOT); scan it by this window manually._"
else
  print_log_split "$CLOUD_ROOT" --since="$prev_date" --until="$new_date"
fi

echo
echo "---"
echo "_Write the curated page at content/docs/releases/, register it in"
echo "content/docs/releases/meta.json, and link it from index.mdx. Items with a"
echo "changeset have the best prose in section 2; section 1 is the completeness"
echo "check — every developer-visible feat/fix should be accounted for._"

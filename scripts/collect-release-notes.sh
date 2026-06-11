#!/usr/bin/env bash
# Collect the raw material for a release-notes page in content/docs/releases/.
#
# Aggregates, for the release between two framework refs:
#   1. The changesets consumed by the release (full text, grouped as the
#      per-package CHANGELOGs were generated from them).
#   2. The objectui (Console UI) commit range, derived from the .objectui-sha
#      pin at each ref, with feat/fix commits listed first.
#
# Usage:
#   scripts/collect-release-notes.sh <prev-ref> [<new-ref>]
#   scripts/collect-release-notes.sh "@objectstack/spec@8.0.1" "@objectstack/spec@9.0.0"
#   scripts/collect-release-notes.sh "@objectstack/spec@9.0.0"        # new-ref defaults to HEAD
#
# Output is markdown on stdout — pipe it to a file and write the curated
# release page from it:
#   scripts/collect-release-notes.sh "@objectstack/spec@9.0.0" > /tmp/v10-material.md

set -euo pipefail

FRAMEWORK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OBJECTUI_ROOT="${OBJECTUI_ROOT:-$(cd "${FRAMEWORK_ROOT}/../objectui" 2>/dev/null && pwd || true)}"

PREV_REF="${1:?usage: collect-release-notes.sh <prev-ref> [<new-ref>]}"
NEW_REF="${2:-HEAD}"

cd "$FRAMEWORK_ROOT"

echo "# Release material: ${PREV_REF} → ${NEW_REF}"
echo

echo "## Framework changesets consumed in this release"
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

echo "## Console UI (objectui) commit range"
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
  echo "### feat / fix"
  echo
  git -C "$OBJECTUI_ROOT" log --no-merges --pretty='- %h %s' "${prev_sha}..${new_sha}" \
    | grep -E '^- [0-9a-f]+ (feat|fix)' || echo "_none_"
  echo
  echo "### everything else"
  echo
  git -C "$OBJECTUI_ROOT" log --no-merges --pretty='- %h %s' "${prev_sha}..${new_sha}" \
    | grep -Ev '^- [0-9a-f]+ (feat|fix)' || echo "_none_"
fi

echo
echo "---"
echo "_Write the curated page at content/docs/releases/, register it in"
echo "content/docs/releases/meta.json, and link it from index.mdx._"

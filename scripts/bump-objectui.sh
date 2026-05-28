#!/usr/bin/env bash
# Bump the objectui SHA the framework workspace pins against.
#
# Usage:
#   scripts/bump-objectui.sh                # bump to current HEAD of ../objectui
#   scripts/bump-objectui.sh <sha>          # bump to an explicit SHA (or ref)
#   scripts/bump-objectui.sh --no-commit    # update file only, don't commit
#
# Assumes sibling layout:
#   ~/work/objectui
#   ~/work/framework   ← run from here
#
# objectui ships @object-ui/console as a static SPA. The framework
# release pipeline reads .objectui-sha, clones objectui at that commit,
# builds @object-ui/console, and copies dist/ into
# packages/console/ so @objectstack/console publishes a frozen,
# version-matched build alongside the rest of the framework.

set -euo pipefail

FRAMEWORK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OBJECTUI_ROOT="${OBJECTUI_ROOT:-$(cd "${FRAMEWORK_ROOT}/../objectui" 2>/dev/null && pwd || true)}"

NO_COMMIT=0
EXPLICIT_SHA=""
for arg in "$@"; do
  case "$arg" in
    --no-commit) NO_COMMIT=1 ;;
    -h|--help)
      sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) EXPLICIT_SHA="$arg" ;;
  esac
done

if [[ -z "${OBJECTUI_ROOT}" || ! -d "${OBJECTUI_ROOT}/.git" ]]; then
  echo "✗ Cannot find objectui checkout at ${FRAMEWORK_ROOT}/../objectui"
  echo "  Override with: OBJECTUI_ROOT=/path/to/objectui scripts/bump-objectui.sh"
  exit 1
fi

if [[ -n "$EXPLICIT_SHA" ]]; then
  NEW_SHA="$(git -C "$OBJECTUI_ROOT" rev-parse "$EXPLICIT_SHA^{commit}")"
else
  NEW_SHA="$(git -C "$OBJECTUI_ROOT" rev-parse HEAD)"
fi

OLD_SHA="$(cat "${FRAMEWORK_ROOT}/.objectui-sha" 2>/dev/null | tr -d '[:space:]' || echo '<none>')"

if [[ "$OLD_SHA" == "$NEW_SHA" ]]; then
  echo "→ Already at ${NEW_SHA:0:12}, nothing to do."
  exit 0
fi

echo "$NEW_SHA" > "${FRAMEWORK_ROOT}/.objectui-sha"
echo "→ objectui pin: ${OLD_SHA:0:12} → ${NEW_SHA:0:12}"

if [[ "$NO_COMMIT" -eq 1 ]]; then
  echo "→ --no-commit: leaving file unstaged."
  exit 0
fi

git -C "$FRAMEWORK_ROOT" add .objectui-sha
SHORT="${NEW_SHA:0:12}"
SUBJECT_LINE="$(git -C "$OBJECTUI_ROOT" log -1 --format=%s "$NEW_SHA")"
git -C "$FRAMEWORK_ROOT" commit -m "chore: bump objectui to ${SHORT}

${SUBJECT_LINE}

objectui@${NEW_SHA}"
echo "✓ Committed. Push with: git push"

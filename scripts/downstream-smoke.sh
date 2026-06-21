#!/usr/bin/env bash
# downstream-smoke.sh — pre-publish backward-compatibility gate (#2035).
#
# The spec package IS the third-party API. In-repo consumers (examples,
# @objectstack/dogfood, downstream-contract) co-evolve with the spec, so they
# cannot prove the *about-to-publish* spec still works for a real, independently
# authored consumer pinned to a PUBLISHED release.
#
# This clones objectstack-ai/hotcrm at a pinned tag, installs it (pulling the
# published @objectstack/* packages), overlays the freshly-built — i.e.
# unreleased — @objectstack/spec dist, and runs hotcrm's own typecheck +
# `objectstack validate`. A failure means the release would break a real third
# party: block the publish.
#
# Requires `pnpm run build` (or at least the spec build) to have run first.
# Override the pinned ref with HOTCRM_REF.
set -euo pipefail

HOTCRM_REF="${HOTCRM_REF:-v1.2.0}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC_DIST="$REPO_ROOT/packages/spec/dist"

if [ ! -d "$SPEC_DIST" ]; then
  echo "::error::spec dist not found at $SPEC_DIST — build it first (pnpm --filter @objectstack/spec build)."
  exit 1
fi

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

echo "→ Cloning objectstack-ai/hotcrm@${HOTCRM_REF} ..."
git clone --quiet --depth 1 --branch "$HOTCRM_REF" https://github.com/objectstack-ai/hotcrm.git "$WORK/hotcrm"
cd "$WORK/hotcrm"

echo "→ Installing hotcrm (published @objectstack/* deps) ..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install --no-frozen-lockfile

DEST="node_modules/@objectstack/spec/dist"
if [ ! -d "$DEST" ]; then
  echo "::error::hotcrm did not install @objectstack/spec — cannot run the gate."
  exit 1
fi

echo "→ Overlaying the unreleased @objectstack/spec dist into hotcrm ..."
rm -rf "$DEST"
cp -R "$SPEC_DIST" "$DEST"

echo "→ hotcrm typecheck (against unreleased spec) ..."
pnpm run typecheck

echo "→ hotcrm validate (loader parses all metadata against unreleased spec) ..."
pnpm run validate

echo "✅ Downstream smoke passed — unreleased @objectstack/spec is backward compatible with hotcrm@${HOTCRM_REF}."

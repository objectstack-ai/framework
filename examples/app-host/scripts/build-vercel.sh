#!/usr/bin/env bash
set -euo pipefail

# Build script for Vercel deployment of @example/app-host.
#
# Follows the Vercel deployment pattern:
#   - api/[[...route]].js is committed to the repo (Vercel detects it pre-build)
#   - esbuild bundles server/index.ts → api/_handler.js (self-contained bundle)
#   - The committed .js wrapper re-exports from _handler.js at runtime
#   - Studio SPA is built and copied to public/ for serving the UI
#
# Steps:
#   1. Build the project with turbo (includes studio)
#   2. Bundle the API serverless function (→ api/_handler.js)
#   3. Copy studio dist files to public/ for UI serving

echo "[build-vercel] Starting app-host build..."

# 1. Build the project with turbo (from monorepo root)
# This builds both app-host and studio
cd ../..
pnpm turbo run build --filter=@example/app-host --filter=@objectstack/studio
cd examples/app-host

# 2. Bundle API serverless function
node scripts/bundle-api.mjs

# 3. Copy studio dist files to public/ for UI serving
echo "[build-vercel] Copying studio dist to public/..."
rm -rf public
mkdir -p public
if [ -d "../../apps/studio/dist" ]; then
  cp -r ../../apps/studio/dist/* public/
  echo "[build-vercel]   ✓ Copied studio dist to public/"
else
  echo "[build-vercel]   ⚠ Studio dist not found (skipped)"
fi

echo "[build-vercel] Done. Static files in public/, serverless function in api/[[...route]].js → api/_handler.js"

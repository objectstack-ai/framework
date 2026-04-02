#!/usr/bin/env bash
set -euo pipefail

# Build script for Vercel deployment of @objectstack/studio.
#
# Vercel uses outputDirectory (vercel.json → "public") for BOTH static files
# and serverless function detection.  The api/ subdirectory MUST be inside
# the output directory — files at the project root are ignored.
#
# Steps:
#   1. Turbo build (Vite SPA → dist/)
#   2. Bundle the API serverless function (→ api/index.js)
#   3. Copy Vite output to public/ for Vercel CDN serving
#   4. Copy API function into public/api/ so Vercel detects it

echo "[build-vercel] Starting studio build..."

# 1. Build the studio SPA with turbo (from monorepo root)
cd ../..
pnpm turbo run build --filter=@objectstack/studio
cd apps/studio

# 2. Bundle API serverless function
node scripts/bundle-api.mjs

# 3. Copy Vite build output to public/ for static file serving
rm -rf public
mkdir -p public
cp -r dist/* public/

# 4. Copy API function into output directory for Vercel detection
#    Vercel only looks for serverless functions inside outputDirectory.
#    Without this step, api/index.js at the project root is invisible.
mkdir -p public/api
cp api/index.js public/api/
cp api/index.js.map public/api/ 2>/dev/null || true

echo "[build-vercel] Done. Static files + API function in public/"

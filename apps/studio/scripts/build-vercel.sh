#!/usr/bin/env bash
set -euo pipefail

# Build script for Vercel deployment of @objectstack/studio.
#
# Follows the same Vercel deployment pattern as hotcrm:
#   - api/[[...route]].js is committed to the repo (Vercel detects it pre-build)
#   - esbuild bundles server/index.ts → api/_handler.js (self-contained bundle)
#   - The committed .js wrapper re-exports from _handler.js at runtime
#   - Vite SPA output is copied to public/ for CDN serving
#
# Vercel routing (framework: null, no outputDirectory):
#   - Static files:        served from public/
#   - Serverless functions: detected from api/ at project root
#
# Steps:
#   1. Turbo build (Vite SPA → dist/)
#   2. Bundle the API serverless function (→ api/_handler.js)
#   3. Copy Vite output to public/ for Vercel CDN serving

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

echo "[build-vercel] Done. Static files in public/, serverless function in api/[[...route]].js → api/_handler.js"

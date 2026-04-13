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

# 3. Copy @ai-sdk packages into local node_modules for Vercel packaging.
#
#    The @ai-sdk packages are workspace dependencies that need to be copied from
#    the monorepo root. @libsql/client and better-sqlite3 are now direct dependencies
#    in apps/studio/package.json, so pnpm installs them automatically.
#
#    The vercel.json includeFiles pattern references node_modules/ relative to
#    apps/studio/, so we must copy @ai-sdk packages here for Vercel to include
#    them in the serverless function's deployment package.
echo "[build-vercel] Copying external modules to local node_modules..."
# Copy the @ai-sdk scope (dynamically loaded provider packages)
if [ -d "../../node_modules/@ai-sdk" ]; then
  mkdir -p "node_modules/@ai-sdk"
  for pkg in ../../node_modules/@ai-sdk/*/; do
    pkgname="$(basename "$pkg")"
    cp -rL "$pkg" "node_modules/@ai-sdk/$pkgname"
  done
  echo "[build-vercel]   ✓ Copied @ai-sdk/*"
else
  echo "[build-vercel]   ⚠ @ai-sdk not found (skipped)"
fi

# 4. Copy Vite build output to public/ for static file serving
rm -rf public
mkdir -p public
cp -r dist/* public/

echo "[build-vercel] Done. Static files in public/, serverless function in api/[[...route]].js → api/_handler.js"

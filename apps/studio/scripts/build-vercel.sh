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

# 3. Copy native/external modules into local node_modules for Vercel packaging.
#
#    Unlike hotcrm (which uses shamefully-hoist=true), this monorepo uses pnpm's
#    default strict node_modules structure. Transitive native dependencies like
#    better-sqlite3 only exist in the monorepo root's node_modules/.pnpm/ virtual
#    store — they're NOT symlinked into apps/studio/node_modules/.
#
#    The vercel.json includeFiles pattern references node_modules/ relative to
#    apps/studio/, so we must copy the actual module files here for Vercel to
#    include them in the serverless function's deployment package.
echo "[build-vercel] Copying external native modules to local node_modules..."
for mod in better-sqlite3; do
  src="../../node_modules/$mod"
  if [ -e "$src" ]; then
    dest="node_modules/$mod"
    mkdir -p "$(dirname "$dest")"
    cp -rL "$src" "$dest"
    echo "[build-vercel]   ✓ Copied $mod"
  else
    echo "[build-vercel]   ⚠ $mod not found at $src (skipped)"
  fi
done
# Copy the @libsql scope (client + its sub-dependencies like core, hrana-client)
if [ -d "../../node_modules/@libsql" ]; then
  mkdir -p "node_modules/@libsql"
  for pkg in ../../node_modules/@libsql/*/; do
    pkgname="$(basename "$pkg")"
    cp -rL "$pkg" "node_modules/@libsql/$pkgname"
  done
  echo "[build-vercel]   ✓ Copied @libsql/*"
else
  echo "[build-vercel]   ⚠ @libsql not found (skipped)"
fi
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

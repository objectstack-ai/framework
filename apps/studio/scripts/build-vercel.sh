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

# 3. Dereference symlinks in node_modules for Vercel packaging.
#
#    pnpm creates symlinks in node_modules/ by default. Vercel's serverless function
#    packaging doesn't support symlinked directories, so we need to replace symlinks
#    with actual file copies.
#
#    The vercel.json includeFiles pattern references node_modules/ relative to
#    apps/studio/, so we must ensure these directories contain real files, not symlinks.
echo "[build-vercel] Dereferencing symlinks in node_modules..."
for mod in better-sqlite3 @libsql/client; do
  if [ -L "node_modules/$mod" ] || [ -d "node_modules/$mod" ]; then
    # Get the real path that the symlink points to
    real_path=$(readlink -f "node_modules/$mod" 2>/dev/null || echo "")
    if [ -n "$real_path" ] && [ -d "$real_path" ]; then
      echo "[build-vercel]   Dereferencing $mod..."
      rm -rf "node_modules/$mod"
      cp -rL "$real_path" "node_modules/$mod"
      echo "[build-vercel]   ✓ Dereferenced $mod"
    fi
  fi
done
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

#!/usr/bin/env bash
set -euo pipefail

# Build script for Vercel deployment of @objectstack/server.
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
#   3. Copy native/external modules into local node_modules for Vercel packaging
#   4. Copy studio dist files to public/ for UI serving

echo "[build-vercel] Starting server build..."

# 1. Build the project with turbo (from monorepo root)
# This builds both server and studio
cd ../..
pnpm turbo run build --filter=@objectstack/server --filter=@objectstack/studio
cd apps/server

# 2. Bundle API serverless function
node scripts/bundle-api.mjs

# 3. Copy native/external modules into local node_modules for Vercel packaging.
#
#    This monorepo uses pnpm's default strict node_modules structure. External
#    dependencies marked in bundle-api.mjs (@libsql/client) only exist in the
#    monorepo root's node_modules/.pnpm/ virtual store.
#
#    The vercel.json includeFiles pattern references node_modules/ relative to
#    apps/server/, so we must copy the actual module files here for Vercel to
#    include them in the serverless function's deployment package.
#
#    Note: better-sqlite3 is NOT needed for Turso remote mode on Vercel.
echo "[build-vercel] Copying @libsql/client to local node_modules..."
src="../../node_modules/@libsql/client"
if [ -e "$src" ]; then
  dest="node_modules/@libsql/client"
  mkdir -p "$(dirname "$dest")"
  cp -rL "$src" "$dest"
  echo "[build-vercel]   ✓ Copied @libsql/client"
else
  echo "[build-vercel]   ⚠ @libsql/client not found at $src (skipped)"
fi

# Copy native binary subdirectories for @libsql/client
if [ -d "../../node_modules/@libsql" ]; then
  mkdir -p "node_modules/@libsql"
  for pkg in ../../node_modules/@libsql/*/; do
    pkgname="$(basename "$pkg")"
    if [ "$pkgname" != "client" ]; then  # client already copied above
      cp -rL "$pkg" "node_modules/@libsql/$pkgname"
      echo "[build-vercel]   ✓ Copied @libsql/$pkgname"
    fi
  done
else
  echo "[build-vercel]   ⚠ @libsql not found (skipped)"
fi

# 4. Copy studio dist files to public/ for UI serving
echo "[build-vercel] Copying studio dist to public/..."
rm -rf public
mkdir -p public
if [ -d "../studio/dist" ]; then
  cp -r ../studio/dist/* public/
  echo "[build-vercel]   ✓ Copied studio dist to public/"
else
  echo "[build-vercel]   ⚠ Studio dist not found (skipped)"
fi

echo "[build-vercel] Done. Static files in public/, serverless function in api/[[...route]].js → api/_handler.js"

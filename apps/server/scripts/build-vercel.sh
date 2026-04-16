#!/usr/bin/env bash
set -euo pipefail

# Build script for Vercel deployment of @objectstack/server.
#
# Follows the Vercel deployment pattern:
#   - api/[[...route]].js is committed to the repo (Vercel detects it pre-build)
#   - esbuild bundles server/index.ts → api/_handler.js (self-contained bundle)
#   - The committed .js wrapper re-exports from _handler.js at runtime
#   - Studio SPA is built and copied to public/ for serving the UI
#   - External dependencies installed in api/node_modules/ (no symlinks)
#
# Steps:
#   1. Build the project with turbo (includes studio)
#   2. Bundle the API serverless function (→ api/_handler.js)
#   3. Copy studio dist files to public/_studio/ for UI serving at /_studio path
#   4. Install external deps in api/node_modules/ (resolve pnpm symlinks)

echo "[build-vercel] Starting server build..."

# 1. Build the project with turbo (from monorepo root)
# This builds both server and studio
cd ../..
pnpm turbo run build --filter=@objectstack/server --filter=@objectstack/studio
cd apps/server

# 2. Bundle API serverless function
node scripts/bundle-api.mjs

# 3. Copy studio dist files to public/_studio/ for UI serving at /_studio path
echo "[build-vercel] Copying studio dist to public/_studio/..."
rm -rf public
mkdir -p public/_studio
if [ -d "../studio/dist" ]; then
  cp -r ../studio/dist/* public/_studio/
  echo "[build-vercel]   ✓ Copied studio dist to public/_studio/"
else
  echo "[build-vercel]   ⚠ Studio dist not found (skipped)"
fi

# 4. Install external dependencies in api/node_modules/ (no symlinks)
# pnpm uses symlinks in node_modules/, which Vercel's serverless function
# packaging cannot handle ("invalid deployment package" error).
# We use npm to install external packages as real files next to the handler.
echo "[build-vercel] Installing external dependencies for serverless function..."
cat > api/_package.json << 'DEPS'
{
  "private": true,
  "dependencies": {
    "@libsql/client": "0.14.0",
    "pino": "10.3.1",
    "pino-pretty": "13.1.3"
  }
}
DEPS
cd api
mv _package.json package.json
npm install --production --no-package-lock --ignore-scripts --loglevel error
rm package.json
cd ..
echo "[build-vercel]   ✓ External dependencies installed in api/node_modules/"

echo "[build-vercel] Done. Static files in public/_studio/, serverless function in api/[[...route]].js → api/_handler.js"

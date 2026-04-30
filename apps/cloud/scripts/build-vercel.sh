#!/usr/bin/env bash
set -euo pipefail

# Build script for Vercel deployment of @objectstack/cloud.
#
# Vercel's project root is `apps/cloud` (where vercel.json lives), so the
# final `public/` and `api/` directories MUST end up inside this directory
# — not inside any sibling app. Earlier this script was copy-pasted from
# apps/server and still cd'd into apps/server, which produced
# apps/server/public/ — Vercel then failed with:
#   Error: No Output Directory named "public" found
#
# Pattern:
#   - api/[[...route]].js committed in apps/cloud/api/
#   - esbuild bundles server/index.ts → api/_handler.js (self-contained)
#   - Studio + Account SPAs built in their own packages, copied to
#     apps/cloud/public/_studio/ and apps/cloud/public/_account/
#   - External native deps installed via npm into api/node_modules/
#     (pnpm symlinks confuse @vercel/node packaging)

echo "[build-vercel] Starting cloud build..."

# Resolve repo root regardless of where Vercel invokes the script from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"

# 1. Build the workspace packages we need (cloud + the two SPAs).
cd "$REPO_ROOT"
pnpm turbo run build \
  --filter=@objectstack/cloud \
  --filter=@objectstack/studio \
  --filter=@objectstack/account

# 1b. Compile objectstack.config.ts → dist/objectstack.json.
cd "$APP_DIR"
echo "[build-vercel] Compiling objectstack artifact..."
pnpm objectstack build
echo "[build-vercel]   ✓ dist/objectstack.json generated"

# 2. Bundle API serverless function (writes api/_handler.js).
node scripts/bundle-api.mjs

# 2b. Ship the artifact alongside the bundled function.
echo "[build-vercel] Copying artifact into api/dist/..."
mkdir -p api/dist
cp dist/objectstack.json api/dist/objectstack.json
echo "[build-vercel]   ✓ api/dist/objectstack.json ready"

# 3. Assemble the static output directory.
echo "[build-vercel] Assembling public/ output directory..."
rm -rf public
mkdir -p public/_studio public/_account

if [ -d "$REPO_ROOT/apps/studio/dist" ]; then
  cp -r "$REPO_ROOT/apps/studio/dist/." public/_studio/
  echo "[build-vercel]   ✓ Copied studio dist to public/_studio/"
else
  echo "[build-vercel]   ⚠ Studio dist not found (skipped)"
fi

if [ -d "$REPO_ROOT/apps/account/dist" ]; then
  cp -r "$REPO_ROOT/apps/account/dist/." public/_account/
  echo "[build-vercel]   ✓ Copied account dist to public/_account/"
else
  echo "[build-vercel]   ⚠ Account dist not found (skipped)"
fi

# 4. Install external native deps into api/node_modules/ (no symlinks).
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

echo "[build-vercel] Done. Static files in $APP_DIR/public, function in api/[[...route]].js → api/_handler.js"

#!/usr/bin/env bash
set -euo pipefail

# Build script for Vercel deployment of @example/app-host.
#
# Follows the Vercel deployment pattern:
#   - api/[[...route]].js is committed to the repo (Vercel detects it pre-build)
#   - esbuild bundles server/index.ts → api/_handler.js (self-contained bundle)
#   - The committed .js wrapper re-exports from _handler.js at runtime
#
# Steps:
#   1. Build the project with turbo
#   2. Bundle the API serverless function (→ api/_handler.js)
#   3. Copy native/external modules into local node_modules for Vercel packaging

echo "[build-vercel] Starting app-host build..."

# 1. Build the project with turbo (from monorepo root)
cd ../..
pnpm turbo run build --filter=@example/app-host
cd examples/app-host

# 2. Bundle API serverless function
node scripts/bundle-api.mjs

echo "[build-vercel] Done. Serverless function in api/[[...route]].js → api/_handler.js"

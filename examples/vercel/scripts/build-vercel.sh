#!/usr/bin/env bash
set -euo pipefail

# Build script for Vercel deployment of ObjectStack server with Hono.
#
# This script:
#   1. Builds the monorepo from the root using turbo
#   2. Bundles the serverless function using esbuild
#
# The bundled function is self-contained and ready for Vercel deployment.

echo "[build-vercel] Starting build..."

# 1. Build the monorepo from the root
cd ../..
pnpm turbo run build --filter=@example/vercel
cd examples/vercel

# 2. Bundle API serverless function
node scripts/bundle-api.mjs

echo "[build-vercel] Done. Serverless function ready at api/_handler.js"

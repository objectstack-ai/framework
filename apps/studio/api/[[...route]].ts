// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Serverless Function — Catch-all API route.
 *
 * This file MUST be committed to the repository so Vercel can detect it
 * as a serverless function during the pre-build phase.
 *
 * During the Vercel build step, `scripts/bundle-api.mjs` uses esbuild to
 * bundle `server/index.ts` (with all workspace dependencies inlined) and
 * outputs the result as `api/[[...route]].js`, which replaces this file
 * at deploy time.  The esbuild bundle is used instead of Vercel's native
 * TypeScript compilation because pnpm strict mode (no shamefully-hoist)
 * prevents @vercel/node from resolving workspace:* packages correctly.
 *
 * @see {@link ../server/index.ts} — the actual server entrypoint
 * @see {@link ../scripts/bundle-api.mjs} — the esbuild bundler
 * @see {@link https://github.com/objectstack-ai/hotcrm/blob/main/vercel.json} — reference deployment
 */

export { default, config } from '../server/index';

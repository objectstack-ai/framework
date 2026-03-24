/**
 * Pre-bundles the Vercel serverless API function.
 *
 * Vercel's @vercel/node builder resolves pnpm workspace packages via symlinks,
 * which can cause esbuild to resolve to TypeScript source files rather than
 * compiled dist output — producing ERR_MODULE_NOT_FOUND at runtime.
 *
 * This script bundles api/index.ts with ALL dependencies inlined (including
 * npm packages), so the deployed function is self-contained. Only packages
 * with native bindings and optional database drivers are kept external.
 *
 * Run from the apps/studio directory during the Vercel build step.
 */

import { build } from 'esbuild';
import { unlinkSync } from 'node:fs';

// Packages that cannot be bundled (native bindings / optional drivers)
const EXTERNAL = [
  '@libsql/client',
  'better-sqlite3',
  // Optional knex database drivers — never used at runtime, but knex requires() them
  'pg',
  'pg-native',
  'pg-query-stream',
  'mysql',
  'mysql2',
  'sqlite3',
  'oracledb',
  'tedious',
  // macOS-only native file watcher
  'fsevents',
];

await build({
  entryPoints: ['api/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2020',
  outfile: 'api/index.js',
  sourcemap: true,
  external: EXTERNAL,
  // Silence warnings about optional/unused require() calls in knex drivers
  logOverride: { 'require-resolve-not-external': 'silent' },
});

// Remove the TypeScript source so Vercel only sees the compiled .js bundle.
// Since package.json has "type": "module", .js files are treated as ESM —
// matching the esbuild `format: 'esm'` output.
unlinkSync('api/index.ts');

console.log('[bundle-api] Bundled api/index.ts → api/index.js');

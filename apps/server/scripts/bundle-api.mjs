/**
 * Pre-bundles the Vercel serverless API function.
 *
 * Vercel's @vercel/node builder resolves pnpm workspace packages via symlinks,
 * which can cause esbuild to resolve to TypeScript source files rather than
 * compiled dist output — producing ERR_MODULE_NOT_FOUND at runtime.
 *
 * This script bundles server/index.ts with ALL dependencies inlined (including
 * npm packages), so the deployed function is self-contained. Only packages
 * with native bindings are kept external.
 *
 * Run from the apps/server directory during the Vercel build step.
 */

import { build } from 'esbuild';

// Packages that cannot be bundled (native bindings / optional drivers)
const EXTERNAL = [
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
  // LibSQL client — has native bindings, must remain external for Vercel
  '@libsql/client',
  // Logging libraries - use dynamic require, must be external
  'pino',
  'pino-pretty',
];

await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  outfile: 'api/_handler.js',
  sourcemap: true,
  external: EXTERNAL,
  // Silence warnings about optional/unused require() calls in knex drivers
  logOverride: { 'require-resolve-not-external': 'silent' },
  // Vercel resolves ESM .js files correctly when "type": "module" is set.
  // CJS format would conflict with the project's "type": "module" setting,
  // causing Node.js to fail parsing require()/module.exports as ESM syntax.
  //
  // The createRequire banner provides a real `require` function in the ESM
  // scope.  esbuild's __require shim (generated for CJS→ESM conversion)
  // checks `typeof require !== "undefined"` and uses it when available,
  // which fixes "Dynamic require of <builtin> is not supported" errors
  // from CJS dependencies like knex/tarn that require() Node.js built-ins.
  banner: {
    js: [
      '// Bundled by esbuild — see scripts/bundle-api.mjs',
      'import { createRequire } from "module";',
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
});

console.log('[bundle-api] Bundled server/index.ts → api/_handler.js');

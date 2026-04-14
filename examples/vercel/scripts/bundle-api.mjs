/**
 * Pre-bundles the Vercel serverless API function.
 *
 * This script bundles server/index.ts with dependencies inlined,
 * creating a self-contained serverless function for Vercel deployment.
 *
 * Native packages like better-sqlite3 are kept external and will be
 * packaged separately by Vercel.
 */

import { build } from 'esbuild';

// Packages that cannot be bundled (native bindings / optional drivers)
const EXTERNAL = [
  'better-sqlite3',
  '@libsql/client',
  // Optional knex database drivers
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
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2020',
  outfile: 'api/_handler.js',
  sourcemap: true,
  external: EXTERNAL,
  logOverride: { 'require-resolve-not-external': 'silent' },
  banner: {
    js: [
      '// Bundled by esbuild — see scripts/bundle-api.mjs',
      'import { createRequire } from "module";',
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
});

console.log('[bundle-api] Bundled server/index.ts → api/_handler.js');

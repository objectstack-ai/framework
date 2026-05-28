// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Console UI Integration Utilities
 *
 * Mirrors `studio.ts` / `account.ts` but for the opinionated, fork-ready
 * runtime console. The Console SPA is mounted at `/_console/` by every
 * deployment that opts in (CLI dev server, self-host, Vercel). The
 * Console is built with `base: '/_console/'`, so its pre-built `dist/`
 * is served verbatim.
 *
 * Packages we look for, in priority order:
 *
 *   1. `@objectstack/console` — the framework-vendored, version-locked
 *      build. Shipped as a dist-only npm package frozen at the objectui
 *      SHA recorded in `<framework>/.objectui-sha`. This is what a
 *      fresh `pnpm add @objectstack/framework` install gets.
 *
 *   2. `@object-ui/console` — the upstream standalone package
 *      (https://github.com/objectstack-ai/objectui). Wins when present
 *      so cloud's Docker overlay (which `cp -r`s its build into
 *      `node_modules/@object-ui/console`) and advanced users who
 *      install a specific Console version directly still take
 *      precedence over the bundled vendor copy.
 *
 *      → Wait — the precedence question (vendor vs override) is the
 *      whole reason this file exists. We intentionally try the vendored
 *      `@objectstack/console` FIRST. Cloud's overlay flow continues to
 *      work because cloud rebuilds the framework image fresh: the
 *      Dockerfile's `cp -r` step is being updated in cloud to also (or
 *      instead) write to `node_modules/@objectstack/console` so its
 *      overlay still wins. End users who pin `@object-ui/console`
 *      directly get the fallback path.
 *
 *   3. Sibling-repo dev fallback — `../objectui/apps/console` — so the
 *      framework monorepo can be developed against an in-tree checkout
 *      of objectui without publishing every change.
 *
 * Pure static-asset dependency: there are zero JS imports against
 * either package anywhere in the framework — we only need to find a
 * directory containing `dist/index.html`.
 */
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

// ─── Constants ──────────────────────────────────────────────────────

/** URL mount path for the Console portal inside the ObjectStack server */
export const CONSOLE_PATH = '/_console';

/**
 * npm package names to search for the Console SPA, in priority order.
 * The first one that resolves to a directory with `dist/index.html` wins.
 */
const CONSOLE_PACKAGES = [
  '@objectstack/console', // 1. framework-vendored build (default)
  '@object-ui/console',   // 2. upstream / cloud overlay / explicit user pin
] as const;

// ─── Path Resolution ────────────────────────────────────────────────

/**
 * Resolve the filesystem path to a Console SPA package.
 *
 * Two-pass strategy:
 *   - Pass 1: walk {@link CONSOLE_PACKAGES} in priority order and return
 *     the first candidate whose `dist/index.html` exists. This is what
 *     the CLI actually wants — a usable build to serve.
 *   - Pass 2: if no candidate has a built dist, return the first
 *     candidate that resolves at all, so `hasConsoleDist()` can surface
 *     a clear "package present but unbuilt" warning instead of "package
 *     not installed".
 *
 * Why two passes: on a developer laptop the vendored
 * `@objectstack/console` workspace dep is present but its `dist/` is
 * gitignored and only built in CI, while `@object-ui/console` (kept as
 * a devDependency) ships with a real prebuilt `dist/`. Without the
 * "prefer-with-dist" tiebreak, local dev would silently stop mounting
 * the Console.
 *
 * Each candidate is located via, in order:
 *   1. `require.resolve('<pkg>/package.json')` from the consumer cwd
 *      and from this CLI's own location. We resolve the `package.json`
 *      subpath (not the bare specifier) because `@objectstack/console`
 *      is a static-asset-only package with no JS `main` / `"."` export
 *      — bare resolution would throw `ERR_PACKAGE_PATH_NOT_EXPORTED`.
 *   2. Direct `<cwd>/node_modules/<pkg>` filesystem check.
 *   3. Only for `@object-ui/console`: sibling-repo dev fallback
 *      `../objectui/apps/console`, matched by `package.json.name`.
 */
export function resolveConsolePath(): string | null {
  const cwd = process.cwd();

  const resolutionBases = [
    pathToFileURL(path.join(cwd, 'package.json')).href, // consumer workspace
    import.meta.url,                                      // CLI package itself
  ];

  /** Collect every existing candidate dir, preserving priority order. */
  const candidates: string[] = [];

  for (const pkgName of CONSOLE_PACKAGES) {
    // 1: node module resolution from cwd and from the CLI itself, via
    //    the package.json subpath (always exported, even by dist-only pkgs).
    for (const base of resolutionBases) {
      try {
        const req = createRequire(base);
        const resolvedPkgJson = req.resolve(`${pkgName}/package.json`);
        const dir = path.dirname(resolvedPkgJson);
        try {
          const pkg = JSON.parse(fs.readFileSync(resolvedPkgJson, 'utf-8'));
          if (pkg.name === pkgName && !candidates.includes(dir)) {
            candidates.push(dir);
          }
        } catch {
          // package.json unreadable — fall through to next strategy
        }
      } catch {
        // Not resolvable from this base — try next.
      }
    }

    // 2: direct filesystem check in cwd/node_modules.
    const directPath = path.join(cwd, 'node_modules', ...pkgName.split('/'));
    if (
      fs.existsSync(path.join(directPath, 'package.json')) &&
      !candidates.includes(directPath)
    ) {
      candidates.push(directPath);
    }
  }

  // 3: sibling-repo dev fallback for the upstream package. Useful when
  // iterating on the Console source inside `objectui` while running the
  // framework CLI here.
  for (const candidate of [
    path.resolve(cwd, '../objectui/apps/console'),
    path.resolve(cwd, '../../objectui/apps/console'),
  ]) {
    const pkgPath = path.join(candidate, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name === '@object-ui/console' && !candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    } catch {
      // Skip invalid package.json
    }
  }

  if (candidates.length === 0) return null;

  // Pass 1: prefer a candidate that actually has a built dist.
  for (const dir of candidates) {
    if (hasConsoleDist(dir)) return dir;
  }

  // Pass 2: nothing built yet — return the highest-priority candidate so
  // the caller can surface a "console package present but no dist found"
  // warning rather than "console not installed".
  return candidates[0];
}

/**
 * Check whether the Console portal has a pre-built `dist/` directory.
 */
export function hasConsoleDist(consolePath: string): boolean {
  return fs.existsSync(path.join(consolePath, 'dist', 'index.html'));
}

// ─── Plugin Factory ─────────────────────────────────────────────────

/**
 * Create a lightweight kernel plugin that serves the pre-built Console
 * portal static files at `/_console/*`.
 *
 * Identical SPA-fallback semantics to `createAccountStaticPlugin` and
 * `createAccountStaticPlugin`:
 *   - `index.html` is read fresh on every fallback hit (so a rebuild
 *     producing new hashed asset names doesn't leave the browser
 *     pointing at stale URLs).
 *   - Hashed asset paths under `/_console/assets/*` never SPA-fallback —
 *     a real 404 surfaces a rebuild/deploy mismatch instead of the
 *     dreaded "asset returns text/html" silent failure.
 */
export function createConsoleStaticPlugin(distPath: string, options?: { isDev?: boolean; rootRedirect?: boolean }) {
  return {
    name: 'com.objectstack.console-static',

    init: async () => {},

    start: async (ctx: any) => {
      const httpServer = ctx.getService?.('http.server');
      if (!httpServer?.getRawApp) {
        ctx.logger?.warn?.('Console static: http.server service not found — skipping');
        return;
      }

      const app = httpServer.getRawApp();
      const absoluteDist = path.resolve(distPath);

      const indexPath = path.join(absoluteDist, 'index.html');
      if (!fs.existsSync(indexPath)) {
        ctx.logger?.warn?.(`Console static: dist not found at ${absoluteDist}`);
        return;
      }

      const readIndexHtml = () => {
        const raw = fs.readFileSync(indexPath, 'utf-8');
        // Inject <base href="${CONSOLE_PATH}/"> so:
        //   1. Relative asset URLs ('./assets/...') resolve to the
        //      correct mount path regardless of where the user navigated.
        //   2. The SPA can derive its React Router basename from
        //      `document.baseURI` at runtime, freeing the published
        //      build from being pinned to a specific mount.
        //
        // Idempotent — bails if the build already shipped a <base>.
        if (/<base\s/i.test(raw)) return raw;
        const baseTag = `<base href="${CONSOLE_PATH}/">`;
        return raw.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${baseTag}`);
      };

      // The Console is the default end-user surface — root `/` redirects
      // here whenever the Console is mounted (`rootRedirect !== false`).
      // The CLI's serve.ts gates whether the Console mounts at all via
      // `--no-console` / `OS_DISABLE_CONSOLE=1`; once mounted, claiming
      // `/` is the intended behaviour in both dev and production
      // deployments.
      if (options?.rootRedirect !== false) {
        app.get('/', (c: any) => c.redirect(`${CONSOLE_PATH}/`));
      }

      // Redirect bare path to trailing-slash (SPA convention)
      app.get(CONSOLE_PATH, (c: any) => c.redirect(`${CONSOLE_PATH}/`));

      // Serve static files with SPA fallback
      app.get(`${CONSOLE_PATH}/*`, async (c: any) => {
        const reqPath = c.req.path.substring(CONSOLE_PATH.length) || '/';
        const filePath = path.join(absoluteDist, reqPath);

        // Security: prevent path traversal
        if (!filePath.startsWith(absoluteDist)) {
          return c.text('Forbidden', 403);
        }

        // Try serving the exact file (HTML files go through the base-tag
        // injection path so all entry points stay path-portable).
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          if (filePath.endsWith('.html')) {
            return new Response(readIndexHtml(), {
              headers: { 'content-type': 'text/html; charset=utf-8' },
            });
          }
          const content = fs.readFileSync(filePath);
          return new Response(content, {
            headers: { 'content-type': mimeType(filePath) },
          });
        }

        // Hashed-asset paths must never SPA-fallback.
        if (reqPath.startsWith('/assets/')) {
          return c.text('Not Found', 404);
        }

        // SPA fallback
        return new Response(readIndexHtml(), {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      });

      // Suppress unused-parameter lint when isDev isn't needed.
      void options;
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json',
};

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

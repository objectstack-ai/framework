# @objectstack/studio

## 3.3.1

### Patch Changes

- @objectstack/spec@3.3.1
- @objectstack/client@3.3.1
- @objectstack/client-react@3.3.1
- @objectstack/metadata@3.3.1
- @objectstack/objectql@3.3.1
- @objectstack/runtime@3.3.1
- @objectstack/driver-memory@3.3.1
- @objectstack/plugin-audit@3.3.1
- @objectstack/plugin-auth@3.3.1
- @objectstack/plugin-msw@3.3.1
- @objectstack/plugin-security@3.3.1
- @objectstack/hono@3.3.1
- @objectstack/service-feed@3.3.1
- @objectstack/driver-turso@3.3.1

## 3.3.1

### Patch Changes

- Fix Vercel deployment crash (`ERR_MODULE_NOT_FOUND` for `@objectstack/metadata/src/index.ts`)
  - Change `bundle-api.mjs` output from `api/index.mjs` to `api/index.js` so Vercel's @vercel/node runtime uses the pre-bundled self-contained bundle directly instead of compiling from TypeScript source (which resolves workspace symlinks to `.ts` source files)
  - Since `package.json` has `"type": "module"`, `.js` files are treated as ESM — matching the esbuild `format: 'esm'` output

## 3.3.0

### Patch Changes

- Updated dependencies [814a6c4]
  - @objectstack/plugin-auth@3.3.0
  - @objectstack/spec@3.3.0
  - @objectstack/client@3.3.0
  - @objectstack/client-react@3.3.0
  - @objectstack/metadata@3.3.0
  - @objectstack/objectql@3.3.0
  - @objectstack/runtime@3.3.0
  - @objectstack/driver-memory@3.3.0
  - @objectstack/plugin-msw@3.3.0
  - @objectstack/plugin-security@3.3.0
  - @objectstack/hono@3.3.0
  - @objectstack/service-feed@3.3.0
  - @objectstack/plugin-audit@3.2.10

## 3.2.9

### Patch Changes

- Updated dependencies [c3065dd]
  - @objectstack/objectql@3.2.9
  - @objectstack/client@3.2.9
  - @objectstack/plugin-msw@3.2.9
  - @objectstack/plugin-auth@3.2.9
  - @objectstack/spec@3.2.9
  - @objectstack/client-react@3.2.9
  - @objectstack/metadata@3.2.9
  - @objectstack/runtime@3.2.9
  - @objectstack/driver-memory@3.2.9
  - @objectstack/plugin-security@3.2.9
  - @objectstack/hono@3.2.9
  - @objectstack/service-feed@3.2.9
  - @objectstack/plugin-audit@3.2.9

## 3.2.8

### Patch Changes

- Updated dependencies [1fe5612]
  - @objectstack/plugin-auth@3.2.8
  - @objectstack/spec@3.2.8
  - @objectstack/client@3.2.8
  - @objectstack/client-react@3.2.8
  - @objectstack/metadata@3.2.8
  - @objectstack/objectql@3.2.8
  - @objectstack/runtime@3.2.8
  - @objectstack/driver-memory@3.2.8
  - @objectstack/plugin-msw@3.2.8
  - @objectstack/plugin-security@3.2.8
  - @objectstack/hono@3.2.8
  - @objectstack/service-feed@3.2.8
  - @objectstack/plugin-audit@3.2.8

## 3.2.10

### Patch Changes

- Fix Vercel deployment crash (`ERR_MODULE_NOT_FOUND` for `api/_kernel`)
  - Inline `_kernel.ts` content into `api/index.ts` to eliminate the bare extensionless relative import that broke Node's ESM resolver
  - Move `hono` from `devDependencies` to `dependencies` so it is available in the Vercel serverless runtime
  - Use explicit `.js` file extensions for relative imports in the API entrypoint (`create-broker-shim.js`, `objectstack.config.js`) per ESM best practice
  - Delete `api/_kernel.ts` — all kernel/service initialisation is now co-located in `api/index.ts`

## 3.2.9

### Minor Changes

- Migrate Vercel API entrypoint from `api/[...path].ts` to `api/index.ts` (Hono + Vercel Node adapter)
  - Replace Next.js-style catch-all with a proper Hono app exported via `handle(app)` from `hono/vercel`
  - Add `/api/*` → `/api` rewrite in `vercel.json` for native Hono routing
  - Rename `getApp()` → `ensureApp()` and export `ensureKernel()` from `_kernel.ts`
  - Remove path-normalisation workaround (no longer needed with Vercel rewrites)
  - Add deployment smoke tests for `/api/v1/meta` and `/api/v1/packages`

## 3.2.8

### Minor Changes

- Switch Vercel deployment from MSW (browser mock) to real server mode
  - Add `api/[...path].ts` Vercel serverless catch-all using Hono + `@objectstack/hono`
  - Add `api/_kernel.ts` server-side kernel singleton with broker shim
  - Extract broker shim to `src/lib/create-broker-shim.ts` (shared by MSW and server modes)
  - Update `vercel.json` to set `VITE_RUNTIME_MODE=server` and `VITE_SERVER_URL=""`
  - Add `hono` and `@objectstack/hono` dependencies
  - Update deployment documentation

## 3.2.7

### Patch Changes

- @objectstack/spec@3.2.7
- @objectstack/client@3.2.7
- @objectstack/client-react@3.2.7
- @objectstack/metadata@3.2.7
- @objectstack/objectql@3.2.7
- @objectstack/runtime@3.2.7
- @objectstack/driver-memory@3.2.7
- @objectstack/plugin-msw@3.2.7

## 3.2.6

### Patch Changes

- @objectstack/spec@3.2.6
- @objectstack/client@3.2.6
- @objectstack/client-react@3.2.6
- @objectstack/metadata@3.2.6
- @objectstack/objectql@3.2.6
- @objectstack/runtime@3.2.6
- @objectstack/driver-memory@3.2.6
- @objectstack/plugin-msw@3.2.6

## 3.2.5

### Patch Changes

- @objectstack/spec@3.2.5
- @objectstack/client@3.2.5
- @objectstack/client-react@3.2.5
- @objectstack/metadata@3.2.5
- @objectstack/objectql@3.2.5
- @objectstack/runtime@3.2.5
- @objectstack/driver-memory@3.2.5
- @objectstack/plugin-msw@3.2.5

## 3.2.4

### Patch Changes

- @objectstack/spec@3.2.4
- @objectstack/client@3.2.4
- @objectstack/client-react@3.2.4
- @objectstack/metadata@3.2.4
- @objectstack/objectql@3.2.4
- @objectstack/runtime@3.2.4
- @objectstack/driver-memory@3.2.4
- @objectstack/plugin-msw@3.2.4

## 3.2.3

### Patch Changes

- @objectstack/spec@3.2.3
- @objectstack/client@3.2.3
- @objectstack/client-react@3.2.3
- @objectstack/metadata@3.2.3
- @objectstack/objectql@3.2.3
- @objectstack/runtime@3.2.3
- @objectstack/driver-memory@3.2.3
- @objectstack/plugin-msw@3.2.3

## 3.2.2

### Patch Changes

- Updated dependencies [46defbb]
  - @objectstack/spec@3.2.2
  - @objectstack/driver-memory@3.2.2
  - @objectstack/client@3.2.2
  - @objectstack/client-react@3.2.2
  - @objectstack/metadata@3.2.2
  - @objectstack/objectql@3.2.2
  - @objectstack/plugin-msw@3.2.2
  - @objectstack/runtime@3.2.2

## 3.2.1

### Patch Changes

- Updated dependencies [850b546]
  - @objectstack/spec@3.2.1
  - @objectstack/client@3.2.1
  - @objectstack/client-react@3.2.1
  - @objectstack/metadata@3.2.1
  - @objectstack/objectql@3.2.1
  - @objectstack/driver-memory@3.2.1
  - @objectstack/plugin-msw@3.2.1
  - @objectstack/runtime@3.2.1

## 3.2.0

### Patch Changes

- Updated dependencies [5901c29]
  - @objectstack/spec@3.2.0
  - @objectstack/client@3.2.0
  - @objectstack/client-react@3.2.0
  - @objectstack/metadata@3.2.0
  - @objectstack/objectql@3.2.0
  - @objectstack/driver-memory@3.2.0
  - @objectstack/plugin-msw@3.2.0
  - @objectstack/runtime@3.2.0

## 3.1.1

### Patch Changes

- Updated dependencies [953d667]
  - @objectstack/spec@3.1.1
  - @objectstack/client@3.1.1
  - @objectstack/client-react@3.1.1
  - @objectstack/metadata@3.1.1
  - @objectstack/objectql@3.1.1
  - @objectstack/driver-memory@3.1.1
  - @objectstack/plugin-msw@3.1.1
  - @objectstack/runtime@3.1.1

## 3.1.0

### Patch Changes

- Updated dependencies [0088830]
  - @objectstack/spec@3.1.0
  - @objectstack/client@3.1.0
  - @objectstack/client-react@3.1.0
  - @objectstack/metadata@3.1.0
  - @objectstack/objectql@3.1.0
  - @objectstack/driver-memory@3.1.0
  - @objectstack/plugin-msw@3.1.0
  - @objectstack/runtime@3.1.0

## 3.0.11

### Patch Changes

- Updated dependencies [92d9d99]
  - @objectstack/spec@3.0.11
  - @objectstack/client@3.0.11
  - @objectstack/client-react@3.0.11
  - @objectstack/metadata@3.0.11
  - @objectstack/objectql@3.0.11
  - @objectstack/driver-memory@3.0.11
  - @objectstack/plugin-msw@3.0.11
  - @objectstack/runtime@3.0.11

## 3.0.10

### Patch Changes

- Updated dependencies [d1e5d31]
  - @objectstack/spec@3.0.10
  - @objectstack/client@3.0.10
  - @objectstack/client-react@3.0.10
  - @objectstack/metadata@3.0.10
  - @objectstack/objectql@3.0.10
  - @objectstack/driver-memory@3.0.10
  - @objectstack/plugin-msw@3.0.10
  - @objectstack/runtime@3.0.10

## 3.0.9

### Patch Changes

- Updated dependencies [15e0df6]
  - @objectstack/spec@3.0.9
  - @objectstack/client@3.0.9
  - @objectstack/client-react@3.0.9
  - @objectstack/metadata@3.0.9
  - @objectstack/objectql@3.0.9
  - @objectstack/driver-memory@3.0.9
  - @objectstack/plugin-msw@3.0.9
  - @objectstack/runtime@3.0.9

## 3.0.8

### Patch Changes

- Updated dependencies [5a968a2]
  - @objectstack/spec@3.0.8
  - @objectstack/client@3.0.8
  - @objectstack/client-react@3.0.8
  - @objectstack/metadata@3.0.8
  - @objectstack/objectql@3.0.8
  - @objectstack/driver-memory@3.0.8
  - @objectstack/plugin-msw@3.0.8
  - @objectstack/runtime@3.0.8

## 3.0.7

### Patch Changes

- Updated dependencies [0119bd7]
- Updated dependencies [5426bdf]
  - @objectstack/spec@3.0.7
  - @objectstack/client@3.0.7
  - @objectstack/client-react@3.0.7
  - @objectstack/metadata@3.0.7
  - @objectstack/objectql@3.0.7
  - @objectstack/driver-memory@3.0.7
  - @objectstack/plugin-msw@3.0.7
  - @objectstack/runtime@3.0.7

## 3.0.6

### Patch Changes

- Updated dependencies [5df254c]
  - @objectstack/spec@3.0.6
  - @objectstack/client@3.0.6
  - @objectstack/client-react@3.0.6
  - @objectstack/metadata@3.0.6
  - @objectstack/objectql@3.0.6
  - @objectstack/driver-memory@3.0.6
  - @objectstack/plugin-msw@3.0.6
  - @objectstack/runtime@3.0.6

## 3.0.5

### Patch Changes

- Updated dependencies [23a4a68]
  - @objectstack/spec@3.0.5
  - @objectstack/client@3.0.5
  - @objectstack/client-react@3.0.5
  - @objectstack/metadata@3.0.5
  - @objectstack/objectql@3.0.5
  - @objectstack/driver-memory@3.0.5
  - @objectstack/plugin-msw@3.0.5
  - @objectstack/runtime@3.0.5

## 3.0.4

### Patch Changes

- Updated dependencies [d738987]
- Updated dependencies [437b0b8]
  - @objectstack/spec@3.0.4
  - @objectstack/objectql@3.0.4
  - @objectstack/client@3.0.4
  - @objectstack/client-react@3.0.4
  - @objectstack/metadata@3.0.4
  - @objectstack/driver-memory@3.0.4
  - @objectstack/plugin-msw@3.0.4
  - @objectstack/runtime@3.0.4

## 3.0.3

### Patch Changes

- c7267f6: Patch release for maintenance updates and improvements.
- Updated dependencies [c7267f6]
  - @objectstack/spec@3.0.3
  - @objectstack/client@3.0.3
  - @objectstack/client-react@3.0.3
  - @objectstack/metadata@3.0.3
  - @objectstack/objectql@3.0.3
  - @objectstack/runtime@3.0.3
  - @objectstack/driver-memory@3.0.3
  - @objectstack/plugin-msw@3.0.3

## 3.0.2

### Patch Changes

- Updated dependencies [28985f5]
  - @objectstack/spec@3.0.2
  - @objectstack/client@3.0.2
  - @objectstack/client-react@3.0.2
  - @objectstack/metadata@3.0.2
  - @objectstack/objectql@3.0.2
  - @objectstack/driver-memory@3.0.2
  - @objectstack/plugin-msw@3.0.2
  - @objectstack/runtime@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [389725a]
  - @objectstack/spec@3.0.1
  - @objectstack/client@3.0.1
  - @objectstack/client-react@3.0.1
  - @objectstack/metadata@3.0.1
  - @objectstack/objectql@3.0.1
  - @objectstack/driver-memory@3.0.1
  - @objectstack/plugin-msw@3.0.1
  - @objectstack/runtime@3.0.1

## 3.0.0

### Major Changes

- Release v3.0.0 — unified version bump for all ObjectStack packages.

### Patch Changes

- Updated dependencies
  - @objectstack/spec@3.0.0
  - @objectstack/client@3.0.0
  - @objectstack/client-react@3.0.0
  - @objectstack/metadata@3.0.0
  - @objectstack/objectql@3.0.0
  - @objectstack/runtime@3.0.0
  - @objectstack/driver-memory@3.0.0
  - @objectstack/plugin-msw@3.0.0

## 2.0.7

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.7
  - @objectstack/client@2.0.7
  - @objectstack/client-react@2.0.7
  - @objectstack/metadata@2.0.7
  - @objectstack/objectql@2.0.7
  - @objectstack/driver-memory@2.0.7
  - @objectstack/plugin-msw@2.0.7
  - @objectstack/runtime@2.0.7

## 2.0.6

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@2.0.6
  - @objectstack/client@2.0.6
  - @objectstack/client-react@2.0.6
  - @objectstack/metadata@2.0.6
  - @objectstack/objectql@2.0.6
  - @objectstack/runtime@2.0.6
  - @objectstack/driver-memory@2.0.6
  - @objectstack/plugin-msw@2.0.6

## 2.0.5

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.5
  - @objectstack/client@2.0.5
  - @objectstack/client-react@2.0.5
  - @objectstack/metadata@2.0.5
  - @objectstack/objectql@2.0.5
  - @objectstack/driver-memory@2.0.5
  - @objectstack/plugin-msw@2.0.5
  - @objectstack/runtime@2.0.5

## 2.0.4

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@2.0.4
  - @objectstack/client@2.0.4
  - @objectstack/client-react@2.0.4
  - @objectstack/metadata@2.0.4
  - @objectstack/objectql@2.0.4
  - @objectstack/runtime@2.0.4
  - @objectstack/driver-memory@2.0.4
  - @objectstack/plugin-msw@2.0.4

## 2.0.3

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@2.0.3
  - @objectstack/client@2.0.3
  - @objectstack/client-react@2.0.3
  - @objectstack/metadata@2.0.3
  - @objectstack/objectql@2.0.3
  - @objectstack/runtime@2.0.3
  - @objectstack/driver-memory@2.0.3
  - @objectstack/plugin-msw@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies [1db8559]
  - @objectstack/spec@2.0.2
  - @objectstack/client@2.0.2
  - @objectstack/client-react@2.0.2
  - @objectstack/metadata@2.0.2
  - @objectstack/objectql@2.0.2
  - @objectstack/driver-memory@2.0.2
  - @objectstack/plugin-msw@2.0.2
  - @objectstack/runtime@2.0.2

## 2.0.1

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@2.0.1
  - @objectstack/client@2.0.1
  - @objectstack/client-react@2.0.1
  - @objectstack/metadata@2.0.1
  - @objectstack/objectql@2.0.1
  - @objectstack/runtime@2.0.1
  - @objectstack/driver-memory@2.0.1
  - @objectstack/plugin-msw@2.0.1

## 2.0.0

### Patch Changes

- Updated dependencies [38e5dd5]
- Updated dependencies [38e5dd5]
  - @objectstack/spec@2.0.0
  - @example/app-crm@1.2.1
  - @example/app-todo@1.2.1
  - @objectstack/client@2.0.0
  - @objectstack/client-react@2.0.0
  - @objectstack/metadata@2.0.0
  - @objectstack/objectql@2.0.0
  - @objectstack/driver-memory@2.0.0
  - @objectstack/plugin-msw@2.0.0
  - @objectstack/runtime@2.0.0

## 0.9.16

### Patch Changes

- Updated dependencies
  - @objectstack/spec@1.0.12
  - @objectstack/client@1.0.12
  - @objectstack/client-react@1.0.12
  - @objectstack/runtime@1.0.12
  - @example/app-crm@0.9.15
  - @example/app-todo@0.9.15
  - @objectstack/metadata@1.0.12
  - @objectstack/objectql@1.0.12
  - @objectstack/driver-memory@1.0.12
  - @objectstack/plugin-msw@1.0.12

## 0.9.15

### Patch Changes

- Simplify console runtime config: remove demo mode, unify VITE_RUNTIME_MODE (msw/server), add Vercel deployment configs

# @objectstack/example-host

## Unreleased

### Patch Changes

- **Fixed missing `Access-Control-Allow-Origin` header on Vercel deployment.** Two code paths in `server/index.ts` previously returned raw `Response` objects that bypassed the Hono app (and therefore the CORS middleware registered inside `createHonoApp`):
  - `OPTIONS` preflight requests went through full kernel bootstrap, which is slow and can fail on cold start — causing the browser to see a preflight with no CORS headers and block every subsequent `/api/v1/*` GET.
  - Bootstrap-failure `503` responses had no CORS headers at all, surfacing in the browser as a generic "missing Access-Control-Allow-Origin" error instead of the real status code.
  - Fix: `OPTIONS` is now short-circuited **before** `ensureApp()` with a proper CORS preflight response; the `503` bootstrap-failure response is now wrapped with the same CORS headers via `withCorsHeaders()`. Both helpers honour the same `CORS_ENABLED` / `CORS_ORIGIN` / `CORS_CREDENTIALS` / `CORS_MAX_AGE` env vars as the Hono adapter, so behaviour is identical whether or not the kernel has finished booting.
- **Unified Studio mount path to `/_studio/` for all deployments** (CLI embedded, Vercel, self-host).
  - `vercel.json`: studio SPA now serves under `/_studio/:path*` with a dedicated rewrite to `/_studio/index.html`. Root `/` and bare `/_studio` redirect to `/_studio/`. Asset caching headers scoped to `/_studio/assets/*`. `VITE_BASE=/_studio/` is set in `build.env`.
  - `scripts/build-vercel.sh`: studio dist is copied to `public/_studio/` (previously `public/`), so Vercel serves it under the same sub-path the CLI uses. This resolves the deep-link / sidebar-click routing failures that occurred when the Studio was mounted at the public root.

## 4.0.4

### Patch Changes

- Updated dependencies [326b66b]
  - @objectstack/spec@4.0.4
  - @example/app-crm@4.0.4
  - @example/app-todo@4.0.4
  - @example/plugin-bi@4.0.4
  - @objectstack/metadata@4.0.4
  - @objectstack/objectql@4.0.4
  - @objectstack/driver-memory@4.0.4
  - @objectstack/driver-turso@4.0.4
  - @objectstack/plugin-audit@4.0.4
  - @objectstack/plugin-auth@4.0.4
  - @objectstack/plugin-hono-server@4.0.4
  - @objectstack/plugin-security@4.0.4
  - @objectstack/plugin-setup@4.0.4
  - @objectstack/runtime@4.0.4
  - @objectstack/service-ai@4.0.4
  - @objectstack/service-analytics@4.0.4
  - @objectstack/service-automation@4.0.4
  - @objectstack/service-feed@4.0.4
  - @objectstack/hono@4.0.4

## 4.0.3

### Patch Changes

- @example/app-crm@4.0.3
- @example/app-todo@4.0.3
- @objectstack/plugin-auth@4.0.3
- @objectstack/spec@4.0.3
- @objectstack/metadata@4.0.3
- @objectstack/objectql@4.0.3
- @objectstack/runtime@4.0.3
- @objectstack/driver-memory@4.0.3
- @objectstack/plugin-hono-server@4.0.3
- @example/plugin-bi@4.0.3

## 4.0.2

### Patch Changes

- Updated dependencies [5f659e9]
  - @objectstack/plugin-hono-server@4.0.2
  - @objectstack/driver-memory@4.0.2
  - @objectstack/spec@4.0.2
  - @example/app-todo@4.0.2
  - @example/app-crm@4.0.2
  - @example/plugin-bi@4.0.2
  - @objectstack/metadata@4.0.2
  - @objectstack/objectql@4.0.2
  - @objectstack/plugin-auth@4.0.2
  - @objectstack/runtime@4.0.2

## 3.0.26

### Patch Changes

- Updated dependencies [f08ffc3]
- Updated dependencies [e0b0a78]
  - @objectstack/spec@4.0.0
  - @objectstack/runtime@4.0.0
  - @objectstack/objectql@4.0.0
  - @objectstack/plugin-auth@4.0.0
  - @example/app-crm@3.0.26
  - @example/app-todo@3.0.26
  - @example/plugin-bi@3.0.26
  - @objectstack/metadata@4.0.0
  - @objectstack/driver-memory@4.0.0
  - @objectstack/plugin-hono-server@4.0.0

## 3.0.25

### Patch Changes

- @objectstack/spec@3.3.1
- @objectstack/metadata@3.3.1
- @objectstack/objectql@3.3.1
- @objectstack/runtime@3.3.1
- @objectstack/driver-memory@3.3.1
- @objectstack/plugin-auth@3.3.1
- @objectstack/plugin-hono-server@3.3.1
- @example/app-crm@3.0.25
- @example/app-todo@3.0.25
- @example/plugin-bi@3.0.25

## 3.0.24

### Patch Changes

- Updated dependencies [814a6c4]
  - @objectstack/plugin-auth@3.3.0
  - @objectstack/spec@3.3.0
  - @objectstack/metadata@3.3.0
  - @objectstack/objectql@3.3.0
  - @objectstack/runtime@3.3.0
  - @objectstack/driver-memory@3.3.0
  - @objectstack/plugin-hono-server@3.3.0
  - @example/app-crm@3.0.24
  - @example/app-todo@3.0.24
  - @example/plugin-bi@3.0.24

## 3.0.23

### Patch Changes

- Updated dependencies [0bc7b0c]
- Updated dependencies [c3065dd]
  - @objectstack/plugin-hono-server@3.2.9
  - @objectstack/objectql@3.2.9
  - @example/app-crm@3.0.23
  - @example/app-todo@3.0.23
  - @objectstack/plugin-auth@3.2.9
  - @objectstack/spec@3.2.9
  - @objectstack/metadata@3.2.9
  - @objectstack/runtime@3.2.9
  - @objectstack/driver-memory@3.2.9
  - @example/plugin-bi@3.0.23

## 3.0.22

### Patch Changes

- Updated dependencies [1fe5612]
  - @objectstack/plugin-auth@3.2.8
  - @objectstack/spec@3.2.8
  - @objectstack/metadata@3.2.8
  - @objectstack/objectql@3.2.8
  - @objectstack/runtime@3.2.8
  - @objectstack/driver-memory@3.2.8
  - @objectstack/plugin-hono-server@3.2.8
  - @example/app-crm@3.0.22
  - @example/app-todo@3.0.22
  - @example/plugin-bi@3.0.22

## 3.0.21

### Patch Changes

- Updated dependencies [35a1ebb]
  - @objectstack/plugin-auth@3.2.7
  - @objectstack/spec@3.2.7
  - @objectstack/metadata@3.2.7
  - @objectstack/objectql@3.2.7
  - @objectstack/runtime@3.2.7
  - @objectstack/driver-memory@3.2.7
  - @objectstack/plugin-hono-server@3.2.7
  - @example/app-crm@3.0.21
  - @example/app-todo@3.0.21
  - @example/plugin-bi@3.0.21

## 3.0.20

### Patch Changes

- @objectstack/spec@3.2.6
- @objectstack/metadata@3.2.6
- @objectstack/objectql@3.2.6
- @objectstack/runtime@3.2.6
- @objectstack/driver-memory@3.2.6
- @objectstack/plugin-hono-server@3.2.6
- @example/app-crm@3.0.20
- @example/app-todo@3.0.20
- @example/plugin-bi@3.0.20

## 3.0.19

### Patch Changes

- @objectstack/spec@3.2.5
- @objectstack/metadata@3.2.5
- @objectstack/objectql@3.2.5
- @objectstack/runtime@3.2.5
- @objectstack/driver-memory@3.2.5
- @objectstack/plugin-hono-server@3.2.5
- @example/app-crm@3.0.19
- @example/app-todo@3.0.19
- @example/plugin-bi@3.0.19

## 3.0.18

### Patch Changes

- @objectstack/spec@3.2.4
- @objectstack/metadata@3.2.4
- @objectstack/objectql@3.2.4
- @objectstack/runtime@3.2.4
- @objectstack/driver-memory@3.2.4
- @objectstack/plugin-hono-server@3.2.4
- @example/app-crm@3.0.18
- @example/app-todo@3.0.18
- @example/plugin-bi@3.0.18

## 3.0.17

### Patch Changes

- @objectstack/spec@3.2.3
- @objectstack/metadata@3.2.3
- @objectstack/objectql@3.2.3
- @objectstack/runtime@3.2.3
- @objectstack/driver-memory@3.2.3
- @objectstack/plugin-hono-server@3.2.3
- @example/app-crm@3.0.17
- @example/app-todo@3.0.17
- @example/plugin-bi@3.0.17

## 3.0.16

### Patch Changes

- Updated dependencies [46defbb]
  - @objectstack/spec@3.2.2
  - @objectstack/driver-memory@3.2.2
  - @example/app-crm@3.0.16
  - @example/app-todo@3.0.16
  - @example/plugin-bi@3.0.16
  - @objectstack/metadata@3.2.2
  - @objectstack/objectql@3.2.2
  - @objectstack/plugin-hono-server@3.2.2
  - @objectstack/runtime@3.2.2

## 3.0.15

### Patch Changes

- Updated dependencies [850b546]
  - @objectstack/spec@3.2.1
  - @example/app-crm@3.0.15
  - @example/app-todo@3.0.15
  - @example/plugin-bi@3.0.15
  - @objectstack/metadata@3.2.1
  - @objectstack/objectql@3.2.1
  - @objectstack/driver-memory@3.2.1
  - @objectstack/plugin-hono-server@3.2.1
  - @objectstack/runtime@3.2.1

## 3.0.14

### Patch Changes

- Updated dependencies [5901c29]
  - @objectstack/spec@3.2.0
  - @example/app-crm@3.0.14
  - @example/app-todo@3.0.14
  - @example/plugin-bi@3.0.14
  - @objectstack/metadata@3.2.0
  - @objectstack/objectql@3.2.0
  - @objectstack/driver-memory@3.2.0
  - @objectstack/plugin-hono-server@3.2.0
  - @objectstack/runtime@3.2.0

## 3.0.13

### Patch Changes

- Updated dependencies [953d667]
  - @objectstack/spec@3.1.1
  - @example/app-crm@3.0.13
  - @example/app-todo@3.0.13
  - @example/plugin-bi@3.0.13
  - @objectstack/metadata@3.1.1
  - @objectstack/objectql@3.1.1
  - @objectstack/driver-memory@3.1.1
  - @objectstack/plugin-hono-server@3.1.1
  - @objectstack/runtime@3.1.1

## 3.0.12

### Patch Changes

- Updated dependencies [0088830]
  - @objectstack/spec@3.1.0
  - @example/app-crm@3.0.12
  - @example/app-todo@3.0.12
  - @example/plugin-bi@3.0.12
  - @objectstack/metadata@3.1.0
  - @objectstack/objectql@3.1.0
  - @objectstack/driver-memory@3.1.0
  - @objectstack/plugin-hono-server@3.1.0
  - @objectstack/runtime@3.1.0

## 3.0.11

### Patch Changes

- Updated dependencies [92d9d99]
  - @objectstack/spec@3.0.11
  - @example/app-crm@3.0.11
  - @example/app-todo@3.0.11
  - @example/plugin-bi@3.0.11
  - @objectstack/metadata@3.0.11
  - @objectstack/objectql@3.0.11
  - @objectstack/driver-memory@3.0.11
  - @objectstack/plugin-hono-server@3.0.11
  - @objectstack/runtime@3.0.11

## 3.0.10

### Patch Changes

- Updated dependencies [d1e5d31]
  - @objectstack/spec@3.0.10
  - @example/app-crm@3.0.10
  - @example/app-todo@3.0.10
  - @example/plugin-bi@3.0.10
  - @objectstack/metadata@3.0.10
  - @objectstack/objectql@3.0.10
  - @objectstack/driver-memory@3.0.10
  - @objectstack/plugin-hono-server@3.0.10
  - @objectstack/runtime@3.0.10

## 3.0.9

### Patch Changes

- Updated dependencies [15e0df6]
  - @objectstack/spec@3.0.9
  - @example/app-crm@3.0.9
  - @example/app-todo@3.0.9
  - @example/plugin-bi@3.0.9
  - @objectstack/metadata@3.0.9
  - @objectstack/objectql@3.0.9
  - @objectstack/driver-memory@3.0.9
  - @objectstack/plugin-hono-server@3.0.9
  - @objectstack/runtime@3.0.9

## 3.0.8

### Patch Changes

- Updated dependencies [5a968a2]
  - @objectstack/spec@3.0.8
  - @example/app-crm@3.0.8
  - @example/app-todo@3.0.8
  - @example/plugin-bi@3.0.8
  - @objectstack/metadata@3.0.8
  - @objectstack/objectql@3.0.8
  - @objectstack/driver-memory@3.0.8
  - @objectstack/plugin-hono-server@3.0.8
  - @objectstack/runtime@3.0.8

## 1.2.16

### Patch Changes

- Updated dependencies [0119bd7]
- Updated dependencies [5426bdf]
  - @objectstack/spec@3.0.7
  - @example/app-crm@1.2.16
  - @example/app-todo@1.2.16
  - @example/plugin-bi@1.2.16
  - @objectstack/metadata@3.0.7
  - @objectstack/objectql@3.0.7
  - @objectstack/driver-memory@3.0.7
  - @objectstack/plugin-hono-server@3.0.7
  - @objectstack/runtime@3.0.7

## 1.2.15

### Patch Changes

- Updated dependencies [5df254c]
  - @objectstack/spec@3.0.6
  - @example/app-crm@1.2.15
  - @example/app-todo@1.2.15
  - @example/plugin-bi@1.2.15
  - @objectstack/metadata@3.0.6
  - @objectstack/objectql@3.0.6
  - @objectstack/driver-memory@3.0.6
  - @objectstack/plugin-hono-server@3.0.6
  - @objectstack/runtime@3.0.6

## 1.2.14

### Patch Changes

- Updated dependencies [23a4a68]
  - @objectstack/spec@3.0.5
  - @example/app-crm@1.2.14
  - @example/app-todo@1.2.14
  - @example/plugin-bi@1.2.14
  - @objectstack/metadata@3.0.5
  - @objectstack/objectql@3.0.5
  - @objectstack/driver-memory@3.0.5
  - @objectstack/plugin-hono-server@3.0.5
  - @objectstack/runtime@3.0.5

## 1.2.13

### Patch Changes

- Updated dependencies [d738987]
- Updated dependencies [437b0b8]
  - @objectstack/spec@3.0.4
  - @objectstack/objectql@3.0.4
  - @example/app-crm@1.2.13
  - @example/app-todo@1.2.13
  - @example/plugin-bi@1.2.13
  - @objectstack/metadata@3.0.4
  - @objectstack/driver-memory@3.0.4
  - @objectstack/plugin-hono-server@3.0.4
  - @objectstack/runtime@3.0.4

## 1.2.12

### Patch Changes

- Updated dependencies [c7267f6]
  - @objectstack/spec@3.0.3
  - @objectstack/metadata@3.0.3
  - @objectstack/objectql@3.0.3
  - @objectstack/runtime@3.0.3
  - @objectstack/driver-memory@3.0.3
  - @objectstack/plugin-hono-server@3.0.3
  - @example/app-crm@1.2.12
  - @example/app-todo@1.2.12
  - @example/plugin-bi@1.2.12

## 1.2.11

### Patch Changes

- Updated dependencies [28985f5]
  - @objectstack/spec@3.0.2
  - @example/app-crm@1.2.11
  - @example/app-todo@1.2.11
  - @example/plugin-bi@1.2.11
  - @objectstack/metadata@3.0.2
  - @objectstack/objectql@3.0.2
  - @objectstack/driver-memory@3.0.2
  - @objectstack/plugin-hono-server@3.0.2
  - @objectstack/runtime@3.0.2

## 1.2.10

### Patch Changes

- Updated dependencies [389725a]
  - @objectstack/spec@3.0.1
  - @example/app-crm@1.2.10
  - @example/app-todo@1.2.10
  - @example/plugin-bi@1.2.10
  - @objectstack/metadata@3.0.1
  - @objectstack/objectql@3.0.1
  - @objectstack/driver-memory@3.0.1
  - @objectstack/plugin-hono-server@3.0.1
  - @objectstack/runtime@3.0.1

## 1.2.9

### Patch Changes

- Updated dependencies
  - @objectstack/spec@3.0.0
  - @objectstack/metadata@3.0.0
  - @objectstack/objectql@3.0.0
  - @objectstack/runtime@3.0.0
  - @objectstack/driver-memory@3.0.0
  - @objectstack/plugin-hono-server@3.0.0
  - @example/app-crm@1.2.9
  - @example/app-todo@1.2.9
  - @example/plugin-bi@1.2.9

## 1.2.8

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.7
  - @example/app-crm@1.2.8
  - @example/app-todo@1.2.8
  - @example/plugin-bi@1.2.8
  - @objectstack/metadata@2.0.7
  - @objectstack/objectql@2.0.7
  - @objectstack/driver-memory@2.0.7
  - @objectstack/plugin-hono-server@2.0.7
  - @objectstack/runtime@2.0.7

## 1.2.7

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.6
  - @objectstack/metadata@2.0.6
  - @objectstack/objectql@2.0.6
  - @objectstack/runtime@2.0.6
  - @objectstack/driver-memory@2.0.6
  - @objectstack/plugin-hono-server@2.0.6
  - @example/app-crm@1.2.7
  - @example/app-todo@1.2.7
  - @example/plugin-bi@1.2.7

## 1.2.6

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.5
  - @example/app-crm@1.2.6
  - @example/app-todo@1.2.6
  - @example/plugin-bi@1.2.6
  - @objectstack/metadata@2.0.5
  - @objectstack/objectql@2.0.5
  - @objectstack/driver-memory@2.0.5
  - @objectstack/plugin-hono-server@2.0.5
  - @objectstack/runtime@2.0.5

## 1.2.5

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.4
  - @objectstack/metadata@2.0.4
  - @objectstack/objectql@2.0.4
  - @objectstack/runtime@2.0.4
  - @objectstack/driver-memory@2.0.4
  - @objectstack/plugin-hono-server@2.0.4
  - @example/app-crm@1.2.5
  - @example/app-todo@1.2.5
  - @example/plugin-bi@1.2.5

## 1.2.4

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.3
  - @objectstack/metadata@2.0.3
  - @objectstack/objectql@2.0.3
  - @objectstack/runtime@2.0.3
  - @objectstack/driver-memory@2.0.3
  - @objectstack/plugin-hono-server@2.0.3
  - @example/app-crm@1.2.4
  - @example/app-todo@1.2.4
  - @example/plugin-bi@1.2.4

## 1.2.3

### Patch Changes

- Updated dependencies [1db8559]
  - @objectstack/spec@2.0.2
  - @example/app-crm@1.2.3
  - @example/app-todo@1.2.3
  - @example/plugin-bi@1.2.3
  - @objectstack/metadata@2.0.2
  - @objectstack/objectql@2.0.2
  - @objectstack/driver-memory@2.0.2
  - @objectstack/plugin-hono-server@2.0.2
  - @objectstack/runtime@2.0.2

## 1.2.2

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.1
  - @objectstack/metadata@2.0.1
  - @objectstack/objectql@2.0.1
  - @objectstack/runtime@2.0.1
  - @objectstack/driver-memory@2.0.1
  - @objectstack/plugin-hono-server@2.0.1
  - @example/app-crm@1.2.2
  - @example/app-todo@1.2.2
  - @example/plugin-bi@1.2.2

## 1.2.1

### Patch Changes

- Updated dependencies [38e5dd5]
- Updated dependencies [38e5dd5]
  - @objectstack/spec@2.0.0
  - @example/app-crm@1.2.1
  - @example/app-todo@1.2.1
  - @example/plugin-bi@1.2.1
  - @objectstack/metadata@2.0.0
  - @objectstack/objectql@2.0.0
  - @objectstack/driver-memory@2.0.0
  - @objectstack/plugin-hono-server@2.0.0
  - @objectstack/runtime@2.0.0

## 0.9.15

### Patch Changes

- Updated dependencies
  - @objectstack/spec@1.0.12
  - @objectstack/runtime@1.0.12
  - @example/app-crm@0.9.15
  - @example/app-todo@0.9.15
  - @example/plugin-bi@1.0.1
  - @objectstack/metadata@1.0.12
  - @objectstack/objectql@1.0.12
  - @objectstack/driver-memory@1.0.12
  - @objectstack/plugin-hono-server@1.0.12

## 0.9.14

### Patch Changes

- @objectstack/spec@1.0.11
- @objectstack/metadata@1.0.11
- @objectstack/objectql@1.0.11
- @objectstack/runtime@1.0.11
- @objectstack/driver-memory@1.0.11
- @objectstack/plugin-hono-server@1.0.11
- @example/app-todo@0.9.14
- @example/app-crm@0.9.14
- @example/plugin-bi@0.9.14

## 0.9.13

### Patch Changes

- @objectstack/metadata@1.0.10
- @objectstack/objectql@1.0.10
- @objectstack/driver-memory@1.0.10
- @objectstack/plugin-hono-server@1.0.10
- @objectstack/runtime@1.0.10
- @example/app-crm@0.9.13
- @example/app-todo@0.9.13
- @example/plugin-bi@0.9.13
- @objectstack/spec@1.0.10

## 0.9.12

### Patch Changes

- Updated dependencies [b9f8c68]
  - @objectstack/objectql@1.0.9
  - @objectstack/spec@1.0.9
  - @objectstack/metadata@1.0.9
  - @objectstack/runtime@1.0.9
  - @objectstack/driver-memory@1.0.9
  - @objectstack/plugin-hono-server@1.0.9
  - @example/app-todo@0.9.12
  - @example/app-crm@0.9.12
  - @example/plugin-bi@0.9.12

## 0.9.11

### Patch Changes

- Updated dependencies [8f2a3a2]
  - @objectstack/plugin-hono-server@1.0.8
  - @example/app-crm@0.9.11
  - @example/app-todo@0.9.11
  - @example/plugin-bi@0.9.11
  - @objectstack/spec@1.0.8
  - @objectstack/metadata@1.0.8
  - @objectstack/objectql@1.0.8
  - @objectstack/runtime@1.0.8
  - @objectstack/driver-memory@1.0.8

## 0.9.10

### Patch Changes

- Updated dependencies [ebdf787]
  - @objectstack/runtime@1.0.7
  - @objectstack/plugin-hono-server@1.0.7
  - @example/app-todo@0.9.10
  - @example/app-crm@0.9.10
  - @example/plugin-bi@0.9.10
  - @objectstack/spec@1.0.7
  - @objectstack/metadata@1.0.7
  - @objectstack/objectql@1.0.7
  - @objectstack/driver-memory@1.0.7

## 0.9.9

### Patch Changes

- Updated dependencies [a7f7b9d]
  - @objectstack/spec@1.0.6
  - @example/app-crm@0.9.9
  - @example/app-todo@0.9.9
  - @example/plugin-bi@0.9.9
  - @objectstack/metadata@1.0.6
  - @objectstack/objectql@1.0.6
  - @objectstack/driver-memory@1.0.6
  - @objectstack/plugin-hono-server@1.0.6
  - @objectstack/runtime@1.0.6

## 0.9.8

### Patch Changes

- Updated dependencies [b1d24bd]
- Updated dependencies [877b864]
  - @objectstack/objectql@1.0.5
  - @objectstack/runtime@1.0.5
  - @objectstack/plugin-hono-server@1.0.5
  - @objectstack/driver-memory@1.0.5
  - @objectstack/metadata@1.0.5
  - @objectstack/spec@1.0.5
  - @example/app-todo@0.9.8
  - @example/app-crm@0.9.8
  - @example/plugin-bi@0.9.8

## 0.9.7

### Patch Changes

- Updated dependencies [5d13533]
  - @objectstack/plugin-hono-server@1.0.4
  - @objectstack/objectql@1.0.4
  - @example/app-crm@0.9.7
  - @example/app-todo@0.9.7
  - @example/plugin-bi@0.9.7
  - @objectstack/spec@1.0.4
  - @objectstack/metadata@1.0.4
  - @objectstack/runtime@1.0.4
  - @objectstack/driver-memory@1.0.4

## 0.9.6

### Patch Changes

- Updated dependencies [fb2eabd]
- Updated dependencies [22a48f0]
  - @objectstack/runtime@1.0.3
  - @objectstack/plugin-hono-server@1.0.3
  - @objectstack/objectql@1.0.3
  - @objectstack/metadata@1.0.3
  - @objectstack/driver-memory@1.0.3
  - @example/app-crm@0.9.6
  - @example/app-todo@0.9.6
  - @example/plugin-bi@0.9.6
  - @objectstack/spec@1.0.3

## 0.9.5

### Patch Changes

- Updated dependencies [a0a6c85]
- Updated dependencies [109fc5b]
  - @objectstack/spec@1.0.2
  - @objectstack/metadata@1.0.2
  - @objectstack/objectql@1.0.2
  - @objectstack/runtime@1.0.2
  - @objectstack/driver-memory@1.0.2
  - @objectstack/plugin-hono-server@1.0.2
  - @example/app-crm@0.9.5
  - @example/app-todo@0.9.5
  - @example/plugin-bi@0.9.5

## 0.9.4

### Patch Changes

- Updated dependencies
  - @objectstack/runtime@1.0.1
  - @objectstack/spec@1.0.1
  - @objectstack/metadata@1.0.1
  - @objectstack/objectql@1.0.1
  - @objectstack/driver-memory@1.0.1
  - @objectstack/plugin-hono-server@1.0.1
  - @example/app-crm@0.9.4
  - @example/app-todo@0.9.4
  - @example/plugin-bi@0.9.4

## 0.9.3

### Patch Changes

- Updated dependencies
  - @objectstack/spec@1.0.0
  - @objectstack/runtime@1.0.0
  - @objectstack/metadata@1.0.0
  - @objectstack/objectql@1.0.0
  - @objectstack/driver-memory@1.0.0
  - @objectstack/plugin-hono-server@1.0.0
  - @example/app-crm@0.9.3
  - @example/app-todo@0.9.3
  - @example/plugin-bi@0.9.3

## 0.9.2

### Patch Changes

- @example/app-crm@0.9.2
- @example/app-todo@0.9.2
- @example/plugin-bi@0.9.2
- @objectstack/metadata@0.9.2
- @objectstack/objectql@0.9.2
- @objectstack/driver-memory@0.9.2
- @objectstack/plugin-hono-server@0.9.2
- @objectstack/runtime@0.9.2

## 0.9.1

### Patch Changes

- Updated dependencies
  - @objectstack/metadata@0.9.1
  - @objectstack/objectql@0.9.1
  - @objectstack/runtime@0.9.1
  - @objectstack/driver-memory@0.9.1
  - @objectstack/plugin-hono-server@0.9.1
  - @example/app-crm@0.9.1
  - @example/app-todo@0.9.1
  - @example/plugin-bi@0.9.1

## 0.7.5

### Patch Changes

- Updated dependencies [555e6a7]
  - @objectstack/objectql@0.8.2
  - @objectstack/example-crm@0.7.5
  - @objectstack/plugin-bi@0.7.5
  - @objectstack/example-todo@0.7.5
  - @objectstack/metadata@0.8.2
  - @objectstack/driver-memory@0.8.2
  - @objectstack/plugin-hono-server@0.8.2
  - @objectstack/runtime@0.8.2

## 0.7.4

### Patch Changes

- @objectstack/example-crm@0.7.4
- @objectstack/example-todo@0.7.4
- @objectstack/objectql@0.8.1
- @objectstack/runtime@0.8.1
- @objectstack/driver-memory@0.8.1
- @objectstack/plugin-hono-server@0.8.1
- @objectstack/plugin-bi@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies
  - @objectstack/objectql@1.0.0
  - @objectstack/runtime@1.0.0
  - @objectstack/driver-memory@1.0.0
  - @objectstack/plugin-hono-server@1.0.0
  - @objectstack/example-crm@0.7.3
  - @objectstack/plugin-bi@0.7.3
  - @objectstack/example-todo@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies [fb41cc0]
  - @objectstack/objectql@0.7.2
  - @objectstack/runtime@0.7.2
  - @objectstack/driver-memory@0.7.2
  - @objectstack/plugin-hono-server@0.7.2
  - @objectstack/example-crm@0.7.2
  - @objectstack/plugin-bi@0.7.2
  - @objectstack/example-todo@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies
  - @objectstack/driver-memory@0.7.1
  - @objectstack/objectql@0.7.1
  - @objectstack/plugin-hono-server@0.7.1
  - @objectstack/runtime@0.7.1
  - @objectstack/example-crm@0.7.1
  - @objectstack/plugin-bi@0.7.1
  - @objectstack/example-todo@0.7.1

## 0.6.1

### Patch Changes

- Updated dependencies
  - @objectstack/driver-memory@0.6.1
  - @objectstack/objectql@0.6.1
  - @objectstack/plugin-hono-server@0.6.1
  - @objectstack/runtime@0.6.1
  - @objectstack/example-crm@0.6.1
  - @objectstack/plugin-bi@0.6.1
  - @objectstack/example-todo@0.6.1

## 0.6.0

### Minor Changes

- b2df5f7: Unified version bump to 0.5.0

  - Standardized all package versions to 0.5.0 across the monorepo
  - Fixed driver-memory package.json paths for proper module resolution
  - Ensured all packages are in sync for the 0.5.0 release

### Patch Changes

- Updated dependencies [b2df5f7]
  - @objectstack/driver-memory@0.6.0
  - @objectstack/objectql@0.6.0
  - @objectstack/plugin-hono-server@0.6.0
  - @objectstack/runtime@0.6.0
  - @objectstack/example-todo@0.6.0
  - @objectstack/example-crm@0.6.0
  - @objectstack/plugin-bi@0.6.0

## 0.1.9

### Patch Changes

- Updated dependencies
  - @objectstack/driver-memory@0.4.2
  - @objectstack/objectql@0.4.2
  - @objectstack/plugin-hono-server@0.4.2
  - @objectstack/runtime@0.4.2
  - @objectstack/example-crm@1.0.9
  - @objectstack/plugin-bi@1.0.9
  - @objectstack/example-todo@1.0.9

## 0.1.8

### Patch Changes

- Updated dependencies
  - @objectstack/driver-memory@0.4.1
  - @objectstack/objectql@0.4.1
  - @objectstack/plugin-hono-server@0.4.1
  - @objectstack/runtime@0.4.1
  - @objectstack/example-crm@1.0.8
  - @objectstack/plugin-bi@1.0.8
  - @objectstack/example-todo@1.0.8

## 0.1.7

### Patch Changes

- Updated dependencies
  - @objectstack/driver-memory@0.3.3
  - @objectstack/objectql@0.3.3
  - @objectstack/plugin-hono-server@0.3.3
  - @objectstack/runtime@0.3.3
  - @objectstack/example-crm@1.0.7
  - @objectstack/plugin-bi@1.0.7
  - @objectstack/example-todo@1.0.7

## 0.1.6

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/example-crm@1.0.6
  - @objectstack/plugin-bi@1.0.6
  - @objectstack/example-todo@1.0.6
  - @objectstack/driver-memory@0.3.2
  - @objectstack/objectql@0.3.2
  - @objectstack/plugin-hono-server@0.3.2
  - @objectstack/runtime@0.3.2

## 0.1.5

### Patch Changes

- Updated dependencies
  - @objectstack/runtime@0.3.1
  - @objectstack/driver-memory@0.3.1
  - @objectstack/objectql@0.3.1
  - @objectstack/plugin-hono-server@0.3.1
  - @objectstack/example-crm@1.0.5
  - @objectstack/plugin-bi@1.0.5
  - @objectstack/example-todo@1.0.5

## 0.1.4

### Patch Changes

- @objectstack/example-crm@1.0.4
- @objectstack/plugin-bi@1.0.4
- @objectstack/example-todo@1.0.4
- @objectstack/driver-memory@1.0.0
- @objectstack/objectql@1.0.0
- @objectstack/plugin-hono-server@1.0.0
- @objectstack/runtime@1.0.0

## 0.1.3

### Patch Changes

- Updated dependencies
  - @objectstack/driver-memory@0.2.1
  - @objectstack/objectql@0.2.1
  - @objectstack/plugin-hono-server@0.2.1
  - @objectstack/runtime@0.2.1
  - @objectstack/example-crm@1.0.3
  - @objectstack/plugin-bi@1.0.3
  - @objectstack/example-todo@1.0.3

## 0.1.2

### Patch Changes

- Updated dependencies
  - @objectstack/objectql@0.2.0
  - @objectstack/runtime@0.2.0
  - @objectstack/driver-memory@0.2.0
  - @objectstack/plugin-hono-server@1.0.0
  - @objectstack/example-crm@1.0.2
  - @objectstack/plugin-bi@1.0.2
  - @objectstack/example-todo@1.0.2

## 0.1.1

### Patch Changes

- Updated dependencies
  - @objectstack/driver-memory@0.1.1
  - @objectstack/objectql@0.1.1
  - @objectstack/plugin-hono-server@0.1.1
  - @objectstack/runtime@0.1.1
  - @objectstack/example-crm@1.0.1
  - @objectstack/plugin-bi@1.0.1
  - @objectstack/example-todo@1.0.1

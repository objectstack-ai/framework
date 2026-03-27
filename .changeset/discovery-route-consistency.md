---
"@objectstack/spec": minor
"@objectstack/client": minor
"@objectstack/runtime": patch
"@objectstack/express": patch
"@objectstack/fastify": patch
"@objectstack/hono": patch
"@objectstack/nestjs": patch
"@objectstack/nextjs": patch
"@objectstack/nuxt": patch
"@objectstack/sveltekit": patch
---

Fix discovery API endpoint routing and protocol consistency.

**Discovery route standardization:**
- All adapters (Express, Fastify, Hono, NestJS, Next.js, Nuxt, SvelteKit) now mount the discovery endpoint at `{prefix}/discovery` instead of `{prefix}` root.
- `.well-known/objectstack` redirects now point to `{prefix}/discovery`.
- Client `connect()` fallback URL changed from `/api/v1` to `/api/v1/discovery`.
- Runtime dispatcher handles both `/discovery` (standard) and `/` (legacy) for backward compatibility.

**Schema & route alignment:**
- Added `storage` (service: `file-storage`) and `feed` (service: `data`) routes to `DEFAULT_DISPATCHER_ROUTES`.
- Added `feed` and `discovery` fields to `ApiRoutesSchema`.
- Unified `GetDiscoveryResponseSchema` with `DiscoverySchema` as single source of truth.
- Client `getRoute('feed')` fallback updated from `/api/v1/data` to `/api/v1/feed`.

**Type safety:**
- Extracted `ApiRouteType` from `ApiRoutes` keys for type-safe client route resolution.
- Removed `as any` type casting in client route access.

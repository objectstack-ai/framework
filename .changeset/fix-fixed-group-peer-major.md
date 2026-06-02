---
"@objectstack/cli": patch
"@objectstack/express": patch
"@objectstack/sveltekit": patch
"@objectstack/hono": patch
"@objectstack/nuxt": patch
"@objectstack/nextjs": patch
"@objectstack/nestjs": patch
"@objectstack/fastify": patch
"@objectstack/plugin-msw": patch
"@objectstack/plugin-dev": patch
"@objectstack/service-datasource": patch
"@objectstack/service-ai": patch
---

fix(release): stop the fixed-group major cascade caused by internal `@objectstack/*` peerDependencies.

These packages declared workspace peerDependencies on other framework packages
in the changesets `fixed` group. Inside a fixed group, changesets rewrites those
peer ranges on every release and treats a peer-range change as breaking → major,
which cascaded to **all 69 packages → 8.0.0** on *any* minor changeset. Required
internal peers are now regular `dependencies`; optional ones move to
`devDependencies` (kept for in-workspace tests, no longer a published peer edge).
Releases now bump correctly (patch/minor) instead of a spurious major.

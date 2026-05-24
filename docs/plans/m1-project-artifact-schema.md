# Plan: M1 — Artifact Envelope Schema (packages/spec)

> **v5.0 update (2026):** Throughout this document, the term *project* has been renamed to *environment* (no aliases; CLI flags, URL paths, schemas, env vars all hard-renamed). See ADR-0006 for the rationale and `.changeset/v5-project-to-environment-rename.md` for the breaking-change list. The body below is preserved verbatim for historical context.


## Context

ROADMAP M1 is the prerequisite for everything downstream (M2–M5, D1, D3).
The goal is a Zod schema for the **project build artifact envelope** — the JSON blob
that `objectstack compile` writes to `dist/objectstack.json` and `objectstack publish`
uploads to `POST /api/v1/cloud/projects/:projectId/metadata`.

The existing `package-artifact.zod.ts` describes a **plugin marketplace .tgz** (file
listings, digital signatures, etc.). M1 is a different concept: a **project metadata
snapshot** produced by the CLI and consumed by the control plane + ObjectOS.

### Schema scope (narrow on purpose)

`ProjectArtifactSchema` describes **only the `GET /api/v1/cloud/projects/:projectId/artifact`
response shape** — the assembled artifact ObjectOS pulls from the control plane.

It is explicitly NOT:
- the CLI compile output (`dist/objectstack.json` stays a raw `ObjectStackDefinitionSchema`);
- the POST publish request body (the CLI uploads `ObjectStackDefinitionSchema` directly);
- the POST publish response shape (`PublishResponseSchema` is deferred to M5).

Narrowing to a single use case lets every envelope field stay required, instead of
forcing half of them optional to accommodate multiple lifecycle stages.

---

## Design Decisions

| Decision | Rationale |
|:---|:---|
| No root re-export in `packages/spec/src/index.ts` | Root only exports key utilities; consumers use subpath `@objectstack/spec/cloud` |
| New `Sha256DigestSchema` instead of reusing `ArtifactChecksumSchema` | `ArtifactChecksumSchema` is a file-list checksum map for marketplace .tgz; M1 needs a single artifact digest |
| No top-level `functions` field | Functions/hooks are part of `ObjectStackDefinitionSchema` (stack application definition); not envelope concerns |
| No top-level `manifest` field | Naming is ambiguous with `metadata.manifest` (app's `ManifestSchema`); runtime requirements shape is undefined in Phase 1 — omit entirely |
| `schemaVersion: '0.1'` | Pre-stable version; signals breaking changes are expected |
| `commitId` required (not optional) | Assigned by control plane; CLI receives it in the publish response |
| `checksum` covers only the `metadata` block | `sha256(canonicalJSON(metadata))` using stable key ordering (e.g. `fast-json-stable-stringify`). Envelope-level fields (`commitId`, `builtAt`, …) are excluded so the digest stays stable across re-assembly |
| `PublishResponseSchema` deferred to M5 | M1 only defines the GET response envelope; POST response shape is M5's concern |

---

## New File

**`packages/spec/src/cloud/project-artifact.zod.ts`**

```ts
import { z } from 'zod';
import { lazySchema } from '../shared/lazy-schema';
import { ObjectStackDefinitionSchema } from '../stack.zod';

// --- SHA-256 digest of a single artifact payload ---
export const Sha256DigestSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'Must be a 64-character lowercase hex SHA-256 digest')
  .describe('SHA-256 digest (64 hex chars)');

export type Sha256Digest = z.infer<typeof Sha256DigestSchema>;

// --- Artifact envelope ---
export const ProjectArtifactSchema = lazySchema(() => z.object({
  /** Envelope format version. Increment on breaking changes. */
  schemaVersion: z.literal('0.1').default('0.1'),

  /** Control-plane project ID this artifact belongs to. */
  projectId: z.string(),

  /** Metadata revision assigned by the control plane on publish. */
  commitId: z.string(),

  /** SHA-256 digest of the canonical JSON serialization of the `metadata` block (stable key ordering). Computed by the control plane when assembling the GET response. */
  checksum: Sha256DigestSchema,

  /** Build timestamp (ISO 8601). */
  builtAt: z.string().datetime().optional(),

  /** CLI version that produced this artifact (e.g. "objectstack-cli@0.4.0"). */
  builtWith: z.string().optional(),

  /**
   * Full compiled metadata definition.
   * Includes objects, views, flows, hooks, functions, agents, etc.
   * This is the direct output of `objectstack compile`.
   */
  metadata: ObjectStackDefinitionSchema,
}));

export type ProjectArtifact      = z.infer<typeof ProjectArtifactSchema>;
export type ProjectArtifactInput = z.input<typeof ProjectArtifactSchema>;
```

---

## Export wiring

**`packages/spec/src/cloud/index.ts`** — add named export:
```ts
export * from './project-artifact.zod';
```

No root re-export. Consumers import via subpath:
```ts
import { ProjectArtifactSchema, Sha256DigestSchema } from '@objectstack/spec/cloud';
```

---

## Critical files

| File | Action |
|:---|:---|
| `packages/spec/src/cloud/project-artifact.zod.ts` | **Create** |
| `packages/spec/src/cloud/index.ts` | Add export |
| `packages/spec/src/stack.zod.ts` | Read-only (import `ObjectStackDefinitionSchema`) |
| `packages/spec/src/kernel/package-artifact.zod.ts` | Read-only reference only — do NOT import from it |

---

## Verification

1. `pnpm build` — `packages/spec` builds clean.
2. `pnpm test` — no regressions.
3. Smoke: `import { ProjectArtifactSchema } from '@objectstack/spec/cloud'` resolves correctly.
4. Parse a minimal valid payload:
   ```ts
   ProjectArtifactSchema.parse({
     projectId: 'proj_123',
     commitId: 'abc',
     checksum: 'a'.repeat(64),
     metadata: { /* minimal ObjectStackDefinition */ },
   });
   ```

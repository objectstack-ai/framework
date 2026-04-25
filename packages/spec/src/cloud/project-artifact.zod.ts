// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { lazySchema } from '../shared/lazy-schema';
import { ObjectStackDefinitionSchema } from '../stack.zod';

/**
 * # Project Artifact Envelope (M1)
 *
 * Describes the response shape of `GET /api/v1/cloud/projects/:projectId/artifact`
 * — the assembled artifact ObjectOS pulls from the control plane.
 *
 * Distinct from the marketplace `PackageArtifactSchema` (a .tgz file listing).
 * This envelope wraps the compiled `ObjectStackDefinitionSchema` produced by
 * `objectstack compile` together with control-plane assigned identity
 * (`commitId`, `checksum`).
 */

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

  /**
   * SHA-256 digest of the canonical JSON serialization of the `metadata`
   * block (stable key ordering). Computed by the control plane when
   * assembling the GET response.
   */
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

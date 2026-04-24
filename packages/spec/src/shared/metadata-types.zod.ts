// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { SnakeCaseIdentifierSchema } from './identifiers.zod';

// ============================================================================
// Shared Metadata Types
// ============================================================================

/** Supported metadata file formats */
import { lazySchema } from './lazy-schema';
export const MetadataFormatSchema = lazySchema(() => z.enum(['yaml', 'json', 'typescript', 'javascript'])
  .describe('Metadata file format'));
export type MetadataFormat = z.infer<typeof MetadataFormatSchema>;

/** Base metadata record fields shared across kernel and system layers */
export const BaseMetadataRecordSchema = lazySchema(() => z.object({
  id: z.string().describe('Unique metadata record identifier'),
  type: z.string().describe('Metadata type (e.g. "object", "view", "flow")'),
  name: SnakeCaseIdentifierSchema.describe('Machine name (snake_case)'),
  format: MetadataFormatSchema.optional().describe('Source file format'),
}).describe('Base metadata record fields shared across kernel and system'));
export type BaseMetadataRecord = z.infer<typeof BaseMetadataRecordSchema>;

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @module ui/sharing
 *
 * Sharing & Embedding Protocol
 *
 * Defines schemas for public link sharing, embed configuration,
 * domain restrictions, and password protection for apps, pages, and forms.
 */

import { z } from 'zod';

/**
 * Sharing Config Schema
 * Configuration for public sharing of an app, page, or form.
 * Supports public links, password protection, domain restrictions, and expiration.
 */
export const SharingConfigSchema = z.object({
  enabled: z.boolean().default(false).describe('Enable public sharing'),
  publicLink: z.string().optional().describe('Generated public share URL'),
  password: z.string().optional().describe('Password required to access shared link'),
  allowedDomains: z.array(z.string()).optional()
    .describe('Restrict access to specific email domains (e.g. ["example.com"])'),
  expiresAt: z.string().optional()
    .describe('Expiration date/time in ISO 8601 format'),
  allowAnonymous: z.boolean().optional().default(false)
    .describe('Allow access without authentication'),
});

/**
 * Embed Config Schema
 * Configuration for iframe embedding of an app, page, or form.
 * Supports origin restrictions, display options, and responsive sizing.
 */
export const EmbedConfigSchema = z.object({
  enabled: z.boolean().default(false).describe('Enable iframe embedding'),
  allowedOrigins: z.array(z.string()).optional()
    .describe('Allowed iframe parent origins (e.g. ["https://example.com"])'),
  width: z.string().optional().default('100%').describe('Embed width (CSS value)'),
  height: z.string().optional().default('600px').describe('Embed height (CSS value)'),
  showHeader: z.boolean().optional().default(true).describe('Show interface header in embed'),
  showNavigation: z.boolean().optional().default(false).describe('Show navigation in embed'),
  responsive: z.boolean().optional().default(true).describe('Enable responsive resizing'),
});

// Type Exports
export type SharingConfig = z.infer<typeof SharingConfigSchema>;
export type EmbedConfig = z.infer<typeof EmbedConfigSchema>;

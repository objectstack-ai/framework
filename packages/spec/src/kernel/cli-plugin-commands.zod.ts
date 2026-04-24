// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { PackageArtifactSchema, ArtifactChecksumSchema, ArtifactSignatureSchema } from './package-artifact.zod';

/**
 * # CLI Plugin Commands Protocol
 *
 * Defines the input/output schemas for the `os plugin` CLI commands
 * that manage the package build → validate → publish lifecycle.
 *
 * ## Commands
 * ```
 * os plugin build      — Build a .tgz artifact from the current project
 * os plugin validate   — Validate an artifact's structure, checksums, and signature
 * os plugin publish    — Upload an artifact to the marketplace
 * ```
 *
 * ## Architecture Alignment
 * - **npm**: `npm pack` → `npm publish`
 * - **Helm**: `helm package` → `helm push`
 * - **VS Code**: `vsce package` → `vsce publish`
 * - **Salesforce**: `sf package version create` → `sf package version promote`
 */

// ==========================================
// os plugin build
// ==========================================

/**
 * Options for the `os plugin build` command.
 * Reads the project manifest and produces a .tgz artifact.
 */
import { lazySchema } from '../shared/lazy-schema';
export const PluginBuildOptionsSchema = lazySchema(() => z.object({
  /** Project root directory (defaults to cwd) */
  directory: z.string().optional()
    .describe('Project root directory (defaults to current working directory)'),

  /** Output directory for the built artifact */
  outDir: z.string().optional()
    .describe('Output directory for the built artifact (defaults to ./dist)'),

  /** Archive format */
  format: z.enum(['tgz', 'zip']).default('tgz')
    .describe('Archive format for the artifact'),

  /** Whether to sign the artifact */
  sign: z.boolean().default(false)
    .describe('Whether to digitally sign the artifact'),

  /** Path to the private key for signing */
  privateKeyPath: z.string().optional()
    .describe('Path to RSA/ECDSA private key file for signing'),

  /** Signing algorithm */
  signAlgorithm: z.enum(['RSA-SHA256', 'RSA-SHA384', 'RSA-SHA512', 'ECDSA-SHA256']).optional()
    .describe('Signing algorithm to use'),

  /** Checksum algorithm */
  checksumAlgorithm: z.enum(['sha256', 'sha384', 'sha512']).default('sha256')
    .describe('Hash algorithm for file checksums'),

  /** Whether to include seed data */
  includeData: z.boolean().default(true)
    .describe('Whether to include seed data in the artifact'),

  /** Whether to include locale/translation files */
  includeLocales: z.boolean().default(true)
    .describe('Whether to include locale/translation files'),
}).describe('Options for the os plugin build command'));

export type PluginBuildOptions = z.infer<typeof PluginBuildOptionsSchema>;

/**
 * Result of the `os plugin build` command.
 */
export const PluginBuildResultSchema = lazySchema(() => z.object({
  /** Whether the build succeeded */
  success: z.boolean().describe('Whether the build succeeded'),

  /** Path to the generated artifact file */
  artifactPath: z.string().optional()
    .describe('Absolute path to the generated artifact file'),

  /** Artifact metadata (validated against PackageArtifactSchema) */
  artifact: PackageArtifactSchema.optional()
    .describe('Artifact metadata'),

  /** Total file count in the artifact */
  fileCount: z.number().int().min(0).optional()
    .describe('Total number of files in the artifact'),

  /** Total artifact size in bytes */
  size: z.number().int().min(0).optional()
    .describe('Total artifact size in bytes'),

  /** Build duration in milliseconds */
  durationMs: z.number().optional()
    .describe('Build duration in milliseconds'),

  /** Error message if build failed */
  errorMessage: z.string().optional()
    .describe('Error message if build failed'),

  /** Warnings emitted during build */
  warnings: z.array(z.string()).optional()
    .describe('Warnings emitted during build'),
}).describe('Result of the os plugin build command'));

export type PluginBuildResult = z.infer<typeof PluginBuildResultSchema>;

// ==========================================
// os plugin validate
// ==========================================

/**
 * Validation severity levels.
 */
export const ValidationSeverityEnum = z.enum([
  'error',    // Must fix — artifact is invalid
  'warning',  // Should fix — may cause issues
  'info',     // Informational — suggestion
]).describe('Validation issue severity');

/**
 * A single validation finding.
 */
export const ValidationFindingSchema = lazySchema(() => z.object({
  /** Finding severity */
  severity: ValidationSeverityEnum.describe('Issue severity level'),

  /** Rule or check that produced this finding */
  rule: z.string().describe('Validation rule identifier'),

  /** Human-readable message */
  message: z.string().describe('Human-readable finding description'),

  /** File path within the artifact (if applicable) */
  path: z.string().optional()
    .describe('Relative file path within the artifact'),
}).describe('A single validation finding'));

export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;

/**
 * Options for the `os plugin validate` command.
 */
export const PluginValidateOptionsSchema = lazySchema(() => z.object({
  /** Path to the .tgz artifact file to validate */
  artifactPath: z.string()
    .describe('Path to the artifact file to validate'),

  /** Whether to verify the digital signature */
  verifySignature: z.boolean().default(true)
    .describe('Whether to verify the digital signature'),

  /** Path to the public key for signature verification */
  publicKeyPath: z.string().optional()
    .describe('Path to the public key for signature verification'),

  /** Whether to verify SHA256 checksums of all files */
  verifyChecksums: z.boolean().default(true)
    .describe('Whether to verify checksums of all files'),

  /** Whether to validate metadata schema compliance */
  validateMetadata: z.boolean().default(true)
    .describe('Whether to validate metadata against schemas'),

  /** Target platform version for compatibility check */
  platformVersion: z.string().optional()
    .describe('Platform version for compatibility verification'),
}).describe('Options for the os plugin validate command'));

export type PluginValidateOptions = z.infer<typeof PluginValidateOptionsSchema>;

/**
 * Result of the `os plugin validate` command.
 */
export const PluginValidateResultSchema = lazySchema(() => z.object({
  /** Whether the artifact is valid (no error-level findings) */
  valid: z.boolean().describe('Whether the artifact passed validation'),

  /** Artifact metadata extracted from the archive */
  artifact: PackageArtifactSchema.optional()
    .describe('Extracted artifact metadata'),

  /** Checksum verification result */
  checksumVerification: z.object({
    /** Whether all checksums match */
    passed: z.boolean().describe('Whether all checksums match'),
    /** Checksum details */
    checksums: ArtifactChecksumSchema.optional().describe('Verified checksums'),
    /** Files with mismatched checksums */
    mismatches: z.array(z.string()).optional()
      .describe('Files with checksum mismatches'),
  }).optional().describe('Checksum verification result'),

  /** Signature verification result */
  signatureVerification: z.object({
    /** Whether the signature is valid */
    passed: z.boolean().describe('Whether the signature is valid'),
    /** Signature details */
    signature: ArtifactSignatureSchema.optional().describe('Signature details'),
    /** Reason for failure */
    failureReason: z.string().optional().describe('Signature verification failure reason'),
  }).optional().describe('Signature verification result'),

  /** Platform compatibility result */
  platformCompatibility: z.object({
    /** Whether the artifact is compatible with the target platform */
    compatible: z.boolean().describe('Whether artifact is compatible'),
    /** Required platform version range */
    requiredRange: z.string().optional().describe('Required platform version range'),
    /** Target platform version checked against */
    targetVersion: z.string().optional().describe('Target platform version'),
  }).optional().describe('Platform compatibility check result'),

  /** All validation findings */
  findings: z.array(ValidationFindingSchema)
    .describe('All validation findings'),

  /** Counts by severity */
  summary: z.object({
    errors: z.number().int().min(0).describe('Error count'),
    warnings: z.number().int().min(0).describe('Warning count'),
    infos: z.number().int().min(0).describe('Info count'),
  }).optional().describe('Finding counts by severity'),
}).describe('Result of the os plugin validate command'));

export type PluginValidateResult = z.infer<typeof PluginValidateResultSchema>;

// ==========================================
// os plugin publish
// ==========================================

/**
 * Options for the `os plugin publish` command.
 */
export const PluginPublishOptionsSchema = lazySchema(() => z.object({
  /** Path to the .tgz artifact file to publish */
  artifactPath: z.string()
    .describe('Path to the artifact file to publish'),

  /** Marketplace API base URL */
  registryUrl: z.string().url().optional()
    .describe('Marketplace API base URL'),

  /** Authentication token for the marketplace API */
  token: z.string().optional()
    .describe('Authentication token for marketplace API'),

  /** Release notes for this version */
  releaseNotes: z.string().optional()
    .describe('Release notes for this version'),

  /** Whether this is a pre-release */
  preRelease: z.boolean().default(false)
    .describe('Whether this is a pre-release version'),

  /** Whether to skip validation before publishing */
  skipValidation: z.boolean().default(false)
    .describe('Whether to skip local validation before publish'),

  /** Access level for the published package */
  access: z.enum(['public', 'restricted']).default('public')
    .describe('Package access level on the marketplace'),

  /** Tags for categorization */
  tags: z.array(z.string()).optional()
    .describe('Tags for marketplace categorization'),
}).describe('Options for the os plugin publish command'));

export type PluginPublishOptions = z.infer<typeof PluginPublishOptionsSchema>;

/**
 * Result of the `os plugin publish` command.
 */
export const PluginPublishResultSchema = lazySchema(() => z.object({
  /** Whether the publish succeeded */
  success: z.boolean().describe('Whether the publish succeeded'),

  /** Package ID that was published */
  packageId: z.string().optional()
    .describe('Published package identifier'),

  /** Version that was published */
  version: z.string().optional()
    .describe('Published version string'),

  /** Artifact reference in the marketplace */
  artifactUrl: z.string().url().optional()
    .describe('URL of the published artifact in the marketplace'),

  /** SHA256 checksum of the uploaded artifact */
  sha256: z.string().optional()
    .describe('SHA256 checksum of the uploaded artifact'),

  /** Submission ID for tracking the review process */
  submissionId: z.string().optional()
    .describe('Marketplace submission ID for review tracking'),

  /** Error message if publish failed */
  errorMessage: z.string().optional()
    .describe('Error message if publish failed'),

  /** Human-readable status message */
  message: z.string().optional()
    .describe('Human-readable status message'),
}).describe('Result of the os plugin publish command'));

export type PluginPublishResult = z.infer<typeof PluginPublishResultSchema>;

// ==========================================
// Export Types
// ==========================================

export type ValidationSeverity = z.infer<typeof ValidationSeverityEnum>;

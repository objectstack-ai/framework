// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import {
  ConnectorSchema,
} from '../connector.zod';

/**
 * File Storage Connector Protocol Template
 * 
 * Specialized connector for file storage systems (S3, Azure Blob, Google Cloud Storage, etc.)
 * Extends the base connector with file-specific features like multipart uploads,
 * versioning, and metadata extraction.
 */

/**
 * File Storage Provider Types
 */
import { lazySchema } from '../../shared/lazy-schema';
export const FileStorageProviderSchema = lazySchema(() => z.enum([
  's3',                    // Amazon S3
  'azure_blob',            // Azure Blob Storage
  'gcs',                   // Google Cloud Storage
  'dropbox',               // Dropbox
  'box',                   // Box
  'onedrive',              // Microsoft OneDrive
  'google_drive',          // Google Drive
  'sharepoint',            // SharePoint
  'ftp',                   // FTP/SFTP
  'local',                 // Local file system
  'custom',                // Custom file storage
]).describe('File storage provider type'));

export type FileStorageProvider = z.infer<typeof FileStorageProviderSchema>;

/**
 * File Access Pattern
 */
export const FileAccessPatternSchema = lazySchema(() => z.enum([
  'public_read',           // Public read access
  'private',               // Private access
  'authenticated_read',    // Requires authentication
  'bucket_owner_read',     // Bucket owner has read access
  'bucket_owner_full',     // Bucket owner has full control
]).describe('File access pattern'));

export type FileAccessPattern = z.infer<typeof FileAccessPatternSchema>;

/**
 * File Metadata Configuration
 */
export const FileMetadataConfigSchema = lazySchema(() => z.object({
  extractMetadata: z.boolean().default(true).describe('Extract file metadata'),
  
  metadataFields: z.array(z.enum([
    'content_type',
    'file_size',
    'last_modified',
    'etag',
    'checksum',
    'creator',
    'created_at',
    'custom',
  ])).optional().describe('Metadata fields to extract'),
  
  customMetadata: z.record(z.string(), z.string()).optional().describe('Custom metadata key-value pairs'),
}));

export type FileMetadataConfig = z.infer<typeof FileMetadataConfigSchema>;

/**
 * Multipart Upload Configuration
 */
export const MultipartUploadConfigSchema = lazySchema(() => z.object({
  enabled: z.boolean().default(true).describe('Enable multipart uploads'),
  
  partSize: z.number().min(5 * 1024 * 1024).default(5 * 1024 * 1024).describe('Part size in bytes (min 5MB)'),
  
  maxConcurrentParts: z.number().min(1).max(10).default(5).describe('Maximum concurrent part uploads'),
  
  threshold: z.number().min(5 * 1024 * 1024).default(100 * 1024 * 1024).describe('File size threshold for multipart upload in bytes'),
}));

export type MultipartUploadConfig = z.infer<typeof MultipartUploadConfigSchema>;

/**
 * File Versioning Configuration
 */
export const FileVersioningConfigSchema = lazySchema(() => z.object({
  enabled: z.boolean().default(false).describe('Enable file versioning'),
  
  maxVersions: z.number().min(1).max(100).optional().describe('Maximum versions to retain'),
  
  retentionDays: z.number().min(1).optional().describe('Version retention period in days'),
}));

export type FileVersioningConfig = z.infer<typeof FileVersioningConfigSchema>;

/**
 * File Filter Configuration
 */
export const FileFilterConfigSchema = lazySchema(() => z.object({
  includePatterns: z.array(z.string()).optional().describe('File patterns to include (glob)'),
  
  excludePatterns: z.array(z.string()).optional().describe('File patterns to exclude (glob)'),
  
  minFileSize: z.number().min(0).optional().describe('Minimum file size in bytes'),
  
  maxFileSize: z.number().min(1).optional().describe('Maximum file size in bytes'),
  
  allowedExtensions: z.array(z.string()).optional().describe('Allowed file extensions'),
  
  blockedExtensions: z.array(z.string()).optional().describe('Blocked file extensions'),
}));

export type FileFilterConfig = z.infer<typeof FileFilterConfigSchema>;

/**
 * File Storage Bucket/Container Configuration
 */
export const StorageBucketSchema = lazySchema(() => z.object({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Bucket identifier in ObjectStack (snake_case)'),
  label: z.string().describe('Display label'),
  bucketName: z.string().describe('Actual bucket/container name in storage system'),
  region: z.string().optional().describe('Storage region'),
  enabled: z.boolean().default(true).describe('Enable sync for this bucket'),
  prefix: z.string().optional().describe('Prefix/path within bucket'),
  accessPattern: FileAccessPatternSchema.optional().describe('Access pattern'),
  fileFilters: FileFilterConfigSchema.optional().describe('File filter configuration'),
}));

export type StorageBucket = z.infer<typeof StorageBucketSchema>;

/**
 * File Storage Connector Configuration Schema
 */
export const FileStorageConnectorSchema = lazySchema(() => ConnectorSchema.extend({
  type: z.literal('file_storage'),
  
  /**
   * File storage provider
   */
  provider: FileStorageProviderSchema.describe('File storage provider type'),
  
  /**
   * Storage configuration
   */
  storageConfig: z.object({
    endpoint: z.string().url().optional().describe('Custom endpoint URL'),
    region: z.string().optional().describe('Default region'),
    pathStyle: z.boolean().optional().default(false).describe('Use path-style URLs (for S3-compatible)'),
  }).optional().describe('Storage configuration'),
  
  /**
   * Buckets/containers to sync
   */
  buckets: z.array(StorageBucketSchema).describe('Buckets/containers to sync'),
  
  /**
   * File metadata configuration
   */
  metadataConfig: FileMetadataConfigSchema.optional().describe('Metadata extraction configuration'),
  
  /**
   * Multipart upload configuration
   */
  multipartConfig: MultipartUploadConfigSchema.optional().describe('Multipart upload configuration'),
  
  /**
   * File versioning configuration
   */
  versioningConfig: FileVersioningConfigSchema.optional().describe('File versioning configuration'),
  
  /**
   * Enable server-side encryption
   */
  encryption: z.object({
    enabled: z.boolean().default(false).describe('Enable server-side encryption'),
    algorithm: z.enum(['AES256', 'aws:kms', 'custom']).optional().describe('Encryption algorithm'),
    kmsKeyId: z.string().optional().describe('KMS key ID (for aws:kms)'),
  }).optional().describe('Encryption configuration'),
  
  /**
   * Lifecycle policy
   */
  lifecyclePolicy: z.object({
    enabled: z.boolean().default(false).describe('Enable lifecycle policy'),
    deleteAfterDays: z.number().min(1).optional().describe('Delete files after N days'),
    archiveAfterDays: z.number().min(1).optional().describe('Archive files after N days'),
  }).optional().describe('Lifecycle policy'),
  
  /**
   * Content processing configuration
   */
  contentProcessing: z.object({
    extractText: z.boolean().default(false).describe('Extract text from documents'),
    generateThumbnails: z.boolean().default(false).describe('Generate image thumbnails'),
    thumbnailSizes: z.array(z.object({
      width: z.number().min(1),
      height: z.number().min(1),
    })).optional().describe('Thumbnail sizes'),
    virusScan: z.boolean().default(false).describe('Scan for viruses'),
  }).optional().describe('Content processing configuration'),
  
  /**
   * Download/upload buffer size
   */
  bufferSize: z.number().min(1024).default(64 * 1024).describe('Buffer size in bytes'),
  
  /**
   * Enable transfer acceleration (for supported providers)
   */
  transferAcceleration: z.boolean().default(false).describe('Enable transfer acceleration'),
}));

export type FileStorageConnector = z.infer<typeof FileStorageConnectorSchema>;

// ============================================================================
// Helper Functions & Examples
// ============================================================================

/**
 * Example: Amazon S3 Connector Configuration
 */
export const s3ConnectorExample = {
  name: 's3_production_assets',
  label: 'Production S3 Assets',
  type: 'file_storage',
  provider: 's3',
  authentication: {
    type: 'api_key',
    apiKey: '${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}',
    headerName: 'Authorization',
  },
  storageConfig: {
    region: 'us-east-1',
    pathStyle: false,
  },
  buckets: [
    {
      name: 'product_images',
      label: 'Product Images',
      bucketName: 'my-company-product-images',
      region: 'us-east-1',
      enabled: true,
      prefix: 'products/',
      accessPattern: 'public_read',
      fileFilters: {
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
      },
    },
    {
      name: 'customer_documents',
      label: 'Customer Documents',
      bucketName: 'my-company-customer-docs',
      region: 'us-east-1',
      enabled: true,
      accessPattern: 'private',
      fileFilters: {
        allowedExtensions: ['.pdf', '.docx', '.xlsx'],
        maxFileSize: 50 * 1024 * 1024, // 50MB
      },
    },
  ],
  metadataConfig: {
    extractMetadata: true,
    metadataFields: ['content_type', 'file_size', 'last_modified', 'etag'],
  },
  multipartConfig: {
    enabled: true,
    partSize: 5 * 1024 * 1024, // 5MB
    maxConcurrentParts: 5,
    threshold: 100 * 1024 * 1024, // 100MB
  },
  versioningConfig: {
    enabled: true,
    maxVersions: 10,
  },
  encryption: {
    enabled: true,
    algorithm: 'aws:kms',
    kmsKeyId: '${AWS_KMS_KEY_ID}',
  },
  contentProcessing: {
    extractText: true,
    generateThumbnails: true,
    thumbnailSizes: [
      { width: 150, height: 150 },
      { width: 300, height: 300 },
      { width: 600, height: 600 },
    ],
    virusScan: true,
  },
  syncConfig: {
    strategy: 'incremental',
    direction: 'bidirectional',
    realtimeSync: true,
    conflictResolution: 'latest_wins',
    batchSize: 100,
  },
  transferAcceleration: true,
  status: 'active',
  enabled: true,
};

/**
 * Example: Google Drive Connector Configuration
 */
export const googleDriveConnectorExample = {
  name: 'google_drive_team',
  label: 'Google Drive Team Folder',
  type: 'file_storage',
  provider: 'google_drive',
  authentication: {
    type: 'oauth2',
    clientId: '${GOOGLE_CLIENT_ID}',
    clientSecret: '${GOOGLE_CLIENT_SECRET}',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    grantType: 'authorization_code',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  },
  buckets: [
    {
      name: 'team_drive',
      label: 'Team Drive',
      bucketName: 'shared-team-drive',
      enabled: true,
      fileFilters: {
        excludePatterns: ['*.tmp', '~$*'],
      },
    },
  ],
  metadataConfig: {
    extractMetadata: true,
    metadataFields: ['content_type', 'file_size', 'last_modified', 'creator', 'created_at'],
  },
  versioningConfig: {
    enabled: true,
    maxVersions: 5,
  },
  syncConfig: {
    strategy: 'incremental',
    direction: 'bidirectional',
    realtimeSync: true,
    conflictResolution: 'latest_wins',
    batchSize: 50,
  },
  status: 'active',
  enabled: true,
};

/**
 * Example: Azure Blob Storage Connector Configuration
 */
export const azureBlobConnectorExample = {
  name: 'azure_blob_storage',
  label: 'Azure Blob Storage',
  type: 'file_storage',
  provider: 'azure_blob',
  authentication: {
    type: 'api_key',
    apiKey: '${AZURE_STORAGE_ACCOUNT_KEY}',
    headerName: 'x-ms-blob-type',
  },
  storageConfig: {
    endpoint: 'https://myaccount.blob.core.windows.net',
  },
  buckets: [
    {
      name: 'archive_container',
      label: 'Archive Container',
      bucketName: 'archive',
      enabled: true,
      accessPattern: 'private',
    },
  ],
  metadataConfig: {
    extractMetadata: true,
    metadataFields: ['content_type', 'file_size', 'last_modified', 'etag'],
  },
  encryption: {
    enabled: true,
    algorithm: 'AES256',
  },
  lifecyclePolicy: {
    enabled: true,
    archiveAfterDays: 90,
    deleteAfterDays: 365,
  },
  syncConfig: {
    strategy: 'incremental',
    direction: 'import',
    schedule: '0 1 * * *', // Daily at 1 AM
    batchSize: 200,
  },
  status: 'active',
  enabled: true,
};

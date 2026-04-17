// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Filesystem Metadata Loader
 * 
 * Loads metadata from the filesystem using glob patterns
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import { createHash } from 'node:crypto';
import type {
  MetadataLoadOptions,
  MetadataLoadResult,
  MetadataStats,
  MetadataLoaderContract,
  MetadataFormat,
  MetadataSaveOptions,
  MetadataSaveResult,
} from '@objectstack/spec/system';
import type { Logger } from '@objectstack/core';
import type { MetadataLoader } from './loader-interface.js';
import type { MetadataSerializer } from '../serializers/serializer-interface.js';

export class FilesystemLoader implements MetadataLoader {
  readonly contract: MetadataLoaderContract = {
    name: 'filesystem',
    protocol: 'file:',
    capabilities: {
      read: true,
      write: true,
      watch: true,
      list: true,
    },
    supportedFormats: ['json', 'yaml', 'typescript', 'javascript'],
    supportsWatch: true,
    supportsWrite: true,
    supportsCache: true,
  };

  private cache = new Map<string, { data: any; etag: string; timestamp: number }>();

  constructor(
    private rootDir: string,
    private serializers: Map<MetadataFormat, MetadataSerializer>,
    private logger?: Logger
  ) {}

  async load(
    type: string,
    name: string,
    options?: MetadataLoadOptions
  ): Promise<MetadataLoadResult> {
    const startTime = Date.now();
    const { validate: _validate = true, useCache = true, ifNoneMatch } = options || {};

    try {
      // Find the file
      const filePath = await this.findFile(type, name);

      if (!filePath) {
        return {
          data: null,
          fromCache: false,
          notModified: false,
          loadTime: Date.now() - startTime,
        };
      }

      // Get stats
      const stats = await this.stat(type, name);

      if (!stats) {
        return {
          data: null,
          fromCache: false,
          notModified: false,
          loadTime: Date.now() - startTime,
        };
      }

      // Check cache
      if (useCache && ifNoneMatch && stats.etag === ifNoneMatch) {
        return {
          data: null,
          fromCache: true,
          notModified: true,
          etag: stats.etag,
          stats,
          loadTime: Date.now() - startTime,
        };
      }

      // Check memory cache
      const cacheKey = `${type}:${name}`;
      if (useCache && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        if (cached.etag === stats.etag) {
          return {
            data: cached.data,
            fromCache: true,
            notModified: false,
            etag: stats.etag,
            stats,
            loadTime: Date.now() - startTime,
          };
        }
      }

      // Load and deserialize
      const content = await fs.readFile(filePath, 'utf-8');
      const serializer = this.getSerializer(stats.format!);

      if (!serializer) {
        throw new Error(`No serializer found for format: ${stats.format}`);
      }

      const data = serializer.deserialize(content);

      // Update cache
      if (useCache) {
        this.cache.set(cacheKey, {
          data,
          etag: stats.etag || '',
          timestamp: Date.now(),
        });
      }

      return {
        data,
        fromCache: false,
        notModified: false,
        etag: stats.etag,
        stats,
        loadTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger?.error('Failed to load metadata', undefined, {
        type,
        name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async loadMany<T = any>(
    type: string,
    options?: MetadataLoadOptions
  ): Promise<T[]> {
    const { patterns = ['**/*'], recursive: _recursive = true, limit } = options || {};

    const typeDir = path.join(this.rootDir, type);
    const items: T[] = [];

    try {
      // Build glob patterns
      const globPatterns = patterns.map(pattern =>
        path.join(typeDir, pattern)
      );

      for (const pattern of globPatterns) {
        const files = await glob(pattern, {
          ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*[*]*'],
          nodir: true,
        });

        for (const file of files) {
          if (limit && items.length >= limit) {
            break;
          }

          try {
            const content = await fs.readFile(file, 'utf-8');
            const format = this.detectFormat(file);
            const serializer = this.getSerializer(format);

            if (serializer) {
              const data = serializer.deserialize<T>(content);
              items.push(data);
            }
          } catch (error) {
            this.logger?.warn('Failed to load file', {
              file,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (limit && items.length >= limit) {
          break;
        }
      }

      return items;
    } catch (error) {
      this.logger?.error('Failed to load many', undefined, {
        type,
        patterns,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async exists(type: string, name: string): Promise<boolean> {
    const filePath = await this.findFile(type, name);
    return filePath !== null;
  }

  async stat(type: string, name: string): Promise<MetadataStats | null> {
    const filePath = await this.findFile(type, name);

    if (!filePath) {
      return null;
    }

    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const etag = this.generateETag(content);
      const format = this.detectFormat(filePath);

      return {
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        etag,
        format,
        path: filePath,
      };
    } catch (error) {
      this.logger?.error('Failed to stat file', undefined, {
        type,
        name,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async list(type: string): Promise<string[]> {
    const typeDir = path.join(this.rootDir, type);

    try {
      const files = await glob('**/*', {
        cwd: typeDir,
        ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*'],
        nodir: true,
      });

      return files.map(file => {
        const ext = path.extname(file);
        const basename = path.basename(file, ext);
        return basename;
      });
    } catch (error) {
      this.logger?.error('Failed to list', undefined, {
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async save(
    type: string,
    name: string,
    data: any,
    options?: MetadataSaveOptions
  ): Promise<MetadataSaveResult> {
    const startTime = Date.now();
    const {
      format = 'typescript',
      prettify = true,
      indent = 2,
      sortKeys = false,
      backup = false,
      overwrite = true,
      atomic = true,
      path: customPath,
    } = options || {};

    try {
      // Get serializer
      const serializer = this.getSerializer(format);
      if (!serializer) {
        throw new Error(`No serializer found for format: ${format}`);
      }

      // Determine file path
      const typeDir = path.join(this.rootDir, type);
      const fileName = `${name}${serializer.getExtension()}`;
      const filePath = customPath || path.join(typeDir, fileName);

      // Check if file exists
      if (!overwrite) {
        try {
          await fs.access(filePath);
          throw new Error(`File already exists: ${filePath}`);
        } catch (error) {
          // File doesn't exist, continue
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      }

      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Create backup if requested
      let backupPath: string | undefined;
      if (backup) {
        try {
          await fs.access(filePath);
          backupPath = `${filePath}.bak`;
          await fs.copyFile(filePath, backupPath);
        } catch {
          // File doesn't exist, no backup needed
        }
      }

      // Serialize data
      const content = serializer.serialize(data, {
        prettify,
        indent,
        sortKeys,
      });

      // Write to disk (atomic or direct)
      if (atomic) {
        const tempPath = `${filePath}.tmp`;
        await fs.writeFile(tempPath, content, 'utf-8');
        await fs.rename(tempPath, filePath);
      } else {
        await fs.writeFile(filePath, content, 'utf-8');
      }

      // Update cache logic if needed (e.g., invalidate or update)
      // For now, we rely on the watcher to pick up changes

      return {
        success: true,
        path: filePath,
        // format, // Not in schema
        size: Buffer.byteLength(content, 'utf-8'),
        backupPath,
        saveTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger?.error('Failed to save metadata', undefined, {
        type,
        name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Find file for a given type and name
   */
  private async findFile(type: string, name: string): Promise<string | null> {
    const typeDir = path.join(this.rootDir, type);
    const extensions = ['.json', '.yaml', '.yml', '.ts', '.js'];

    for (const ext of extensions) {
      const filePath = path.join(typeDir, `${name}${ext}`);

      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        // File doesn't exist, try next extension
      }
    }

    return null;
  }

  /**
   * Detect format from file extension
   */
  private detectFormat(filePath: string): MetadataFormat {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.json':
        return 'json';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.ts':
        return 'typescript';
      case '.js':
        return 'javascript';
      default:
        return 'json'; // Default to JSON
    }
  }

  /**
   * Get serializer for format
   */
  private getSerializer(format: MetadataFormat): MetadataSerializer | undefined {
    return this.serializers.get(format);
  }

  /**
   * Generate ETag for content
   * Uses SHA-256 hash truncated to 32 characters for reasonable collision resistance
   * while keeping ETag headers compact (full 64-char hash is overkill for this use case)
   */
  private generateETag(content: string): string {
    const hash = createHash('sha256').update(content).digest('hex').substring(0, 32);
    return `"${hash}"`;
  }
}

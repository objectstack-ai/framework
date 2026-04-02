// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata History Retention and Cleanup
 *
 * Manages automatic cleanup of old history records based on retention policies.
 * Supports both age-based and count-based retention strategies.
 */

import type { IDataDriver } from '@objectstack/spec/contracts';
import type { MetadataHistoryRetentionPolicy } from '@objectstack/spec/system';
import type { DatabaseLoader } from '../loaders/database-loader.js';

/**
 * History Cleanup Manager
 *
 * Handles automatic cleanup of metadata history records based on
 * configured retention policies.
 */
export class HistoryCleanupManager {
  private policy: MetadataHistoryRetentionPolicy;
  private dbLoader: DatabaseLoader;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(policy: MetadataHistoryRetentionPolicy, dbLoader: DatabaseLoader) {
    this.policy = policy;
    this.dbLoader = dbLoader;
  }

  /**
   * Start automatic cleanup if enabled in the policy.
   */
  start(): void {
    if (!this.policy.autoCleanup) {
      return;
    }

    const intervalMs = (this.policy.cleanupIntervalHours ?? 24) * 60 * 60 * 1000;

    // Run cleanup immediately on start
    void this.runCleanup();

    // Schedule periodic cleanup
    this.cleanupTimer = setInterval(() => {
      void this.runCleanup();
    }, intervalMs);
  }

  /**
   * Stop automatic cleanup.
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Run cleanup based on the retention policy.
   * Removes history records that exceed the configured limits.
   */
  async runCleanup(): Promise<{ deleted: number; errors: number }> {
    const driver = (this.dbLoader as any).driver as IDataDriver;
    const historyTableName = (this.dbLoader as any).historyTableName as string;
    const tenantId = (this.dbLoader as any).tenantId as string | undefined;

    let deleted = 0;
    let errors = 0;

    try {
      // Age-based cleanup
      if (this.policy.maxAgeDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.policy.maxAgeDays);
        const cutoffISO = cutoffDate.toISOString();

        const filter: Record<string, unknown> = {
          recorded_at: { $lt: cutoffISO },
        };

        if (tenantId) {
          filter.tenant_id = tenantId;
        }

        try {
          const oldRecords = await driver.find(historyTableName, {
            object: historyTableName,
            where: filter,
            fields: ['id'],
          });

          for (const record of oldRecords) {
            try {
              await driver.delete(historyTableName, record.id as string);
              deleted++;
            } catch {
              errors++;
            }
          }
        } catch {
          errors++;
        }
      }

      // Count-based cleanup per metadata item
      if (this.policy.maxVersions) {
        try {
          // Get all unique metadata IDs
          const metadataIds = await driver.find(historyTableName, {
            object: historyTableName,
            where: tenantId ? { tenant_id: tenantId } : {},
            fields: ['metadata_id'],
          });

          const uniqueIds = new Set<string>();
          for (const record of metadataIds) {
            if (record.metadata_id) {
              uniqueIds.add(record.metadata_id as string);
            }
          }

          // For each metadata item, keep only the latest N versions
          for (const metadataId of uniqueIds) {
            const filter: Record<string, unknown> = { metadata_id: metadataId };
            if (tenantId) {
              filter.tenant_id = tenantId;
            }

            try {
              // Get all history records for this metadata item, ordered by version desc
              const historyRecords = await driver.find(historyTableName, {
                object: historyTableName,
                where: filter,
                orderBy: [{ field: 'version', order: 'desc' as const }],
              });

              // If we have more records than the limit, delete the excess
              if (historyRecords.length > this.policy.maxVersions) {
                const toDelete = historyRecords.slice(this.policy.maxVersions);
                for (const record of toDelete) {
                  try {
                    await driver.delete(historyTableName, record.id as string);
                    deleted++;
                  } catch {
                    errors++;
                  }
                }
              }
            } catch {
              errors++;
            }
          }
        } catch {
          errors++;
        }
      }
    } catch (error) {
      console.error('History cleanup failed:', error);
      errors++;
    }

    return { deleted, errors };
  }

  /**
   * Get cleanup statistics without actually deleting anything.
   * Useful for previewing what would be cleaned up.
   */
  async getCleanupStats(): Promise<{
    recordsByAge: number;
    recordsByCount: number;
    total: number;
  }> {
    const driver = (this.dbLoader as any).driver as IDataDriver;
    const historyTableName = (this.dbLoader as any).historyTableName as string;
    const tenantId = (this.dbLoader as any).tenantId as string | undefined;

    let recordsByAge = 0;
    let recordsByCount = 0;

    try {
      // Count records that would be deleted by age
      if (this.policy.maxAgeDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.policy.maxAgeDays);
        const cutoffISO = cutoffDate.toISOString();

        const filter: Record<string, unknown> = {
          recorded_at: { $lt: cutoffISO },
        };

        if (tenantId) {
          filter.tenant_id = tenantId;
        }

        recordsByAge = await driver.count(historyTableName, {
          object: historyTableName,
          where: filter,
        });
      }

      // Count records that would be deleted by version limit
      if (this.policy.maxVersions) {
        const metadataIds = await driver.find(historyTableName, {
          object: historyTableName,
          where: tenantId ? { tenant_id: tenantId } : {},
          fields: ['metadata_id'],
        });

        const uniqueIds = new Set<string>();
        for (const record of metadataIds) {
          if (record.metadata_id) {
            uniqueIds.add(record.metadata_id as string);
          }
        }

        for (const metadataId of uniqueIds) {
          const filter: Record<string, unknown> = { metadata_id: metadataId };
          if (tenantId) {
            filter.tenant_id = tenantId;
          }

          const count = await driver.count(historyTableName, {
            object: historyTableName,
            where: filter,
          });

          if (count > this.policy.maxVersions) {
            recordsByCount += count - this.policy.maxVersions;
          }
        }
      }
    } catch (error) {
      console.error('Failed to get cleanup stats:', error);
    }

    // Note: There may be overlap between age-based and count-based cleanup
    // so the total is not simply the sum
    return {
      recordsByAge,
      recordsByCount,
      total: Math.max(recordsByAge, recordsByCount),
    };
  }
}

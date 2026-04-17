// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDataDriver, ObjectDefinition } from '@objectstack/spec';
import { TursoDriver } from '@objectstack/driver-turso';

/**
 * Tenant Schema Initialization Service
 *
 * Initializes tenant databases with:
 * - Base system schema (metadata tables)
 * - System objects (sys_user_preference, sys_api_key, etc.)
 * - Package-specific objects
 */
export class TenantSchemaInitializer {
  /**
   * Initialize a tenant database with base schema
   *
   * @param tenantDatabaseUrl - Tenant database URL
   * @param tenantAuthToken - Tenant database auth token
   * @param baseObjects - Base objects to create (optional)
   */
  async initializeTenantSchema(
    tenantDatabaseUrl: string,
    tenantAuthToken: string,
    baseObjects: ObjectDefinition[] = [],
  ): Promise<void> {
    // Create driver for tenant database
    const driver = new TursoDriver({
      url: tenantDatabaseUrl,
      authToken: tenantAuthToken,
    });

    try {
      // Connect to tenant database
      await driver.connect();

      // Step 1: Create metadata system tables
      await this.createMetadataTables(driver);

      // Step 2: Create base objects
      for (const objectDef of baseObjects) {
        await driver.syncSchema(objectDef);
      }

      // Step 3: Initialize system metadata
      await this.initializeSystemMetadata(driver);
    } finally {
      // Always disconnect
      await driver.disconnect();
    }
  }

  /**
   * Create metadata system tables
   *
   * These tables store the tenant's metadata (objects, fields, views, etc.)
   */
  private async createMetadataTables(driver: IDataDriver): Promise<void> {
    // Create sys_metadata table for storing metadata items
    const metadataObject: ObjectDefinition = {
      name: 'sys_metadata',
      label: 'System Metadata',
      pluralLabel: 'System Metadata',
      fields: {
        id: {
          name: 'id',
          label: 'ID',
          type: 'text',
          required: true,
          readonly: true,
        },
        type: {
          name: 'type',
          label: 'Type',
          type: 'text',
          required: true,
        },
        name: {
          name: 'name',
          label: 'Name',
          type: 'text',
          required: true,
        },
        data: {
          name: 'data',
          label: 'Data',
          type: 'textarea',
          required: true,
        },
        package_id: {
          name: 'package_id',
          label: 'Package ID',
          type: 'text',
          required: false,
        },
        version: {
          name: 'version',
          label: 'Version',
          type: 'number',
          required: true,
          defaultValue: 1,
        },
        created_at: {
          name: 'created_at',
          label: 'Created At',
          type: 'datetime',
          required: true,
          defaultValue: 'NOW()',
        },
        updated_at: {
          name: 'updated_at',
          label: 'Updated At',
          type: 'datetime',
          required: true,
          defaultValue: 'NOW()',
        },
      },
      enable: {
        apiEnabled: true,
        apiMethods: ['get', 'list', 'create', 'update', 'delete'],
      },
    };

    await driver.syncSchema(metadataObject);
  }

  /**
   * Initialize system metadata
   *
   * Creates initial metadata records for the tenant
   */
  private async initializeSystemMetadata(driver: IDataDriver): Promise<void> {
    // This would typically:
    // 1. Create default views
    // 2. Create default dashboards
    // 3. Set up navigation structure
    // 4. Configure default settings

    // For now, this is a placeholder
    // TODO: Implement system metadata initialization
  }

  /**
   * Install package schema into tenant database
   *
   * @param tenantDatabaseUrl - Tenant database URL
   * @param tenantAuthToken - Tenant database auth token
   * @param packageObjects - Package objects to install
   */
  async installPackageSchema(
    tenantDatabaseUrl: string,
    tenantAuthToken: string,
    packageObjects: ObjectDefinition[],
  ): Promise<void> {
    const driver = new TursoDriver({
      url: tenantDatabaseUrl,
      authToken: tenantAuthToken,
    });

    try {
      await driver.connect();

      // Install each package object
      for (const objectDef of packageObjects) {
        await driver.syncSchema(objectDef);
      }
    } finally {
      await driver.disconnect();
    }
  }

  /**
   * Uninstall package schema from tenant database
   *
   * @param tenantDatabaseUrl - Tenant database URL
   * @param tenantAuthToken - Tenant database auth token
   * @param packageObjectNames - Package object names to uninstall
   */
  async uninstallPackageSchema(
    tenantDatabaseUrl: string,
    tenantAuthToken: string,
    packageObjectNames: string[],
  ): Promise<void> {
    const driver = new TursoDriver({
      url: tenantDatabaseUrl,
      authToken: tenantAuthToken,
    });

    try {
      await driver.connect();

      // Drop each package object table
      for (const objectName of packageObjectNames) {
        // Note: This requires implementation of dropTable in IDataDriver
        // For now, this is a placeholder
        // TODO: Implement table dropping
      }
    } finally {
      await driver.disconnect();
    }
  }
}

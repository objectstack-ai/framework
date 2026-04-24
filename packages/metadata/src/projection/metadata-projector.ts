// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata Projection Service
 *
 * Implements the dual-table architecture pattern:
 * - sys_metadata: Source of truth for package management, versioning
 * - Type-specific tables (sys_object, sys_view, etc.): Queryable projections
 *
 * When metadata is saved to sys_metadata, this service projects it into
 * the appropriate type-specific table so Studio can query it via Object Protocol.
 */

import type { IDataDriver, IDataEngine } from '@objectstack/spec/contracts';
import { StorageNameMapping } from '@objectstack/spec/system';

/**
 * Configuration for the MetadataProjector
 */
export interface MetadataProjectorOptions {
  /** The IDataDriver instance to use for database operations */
  driver?: IDataDriver;

  /** The IDataEngine (ObjectQL) instance — preferred over raw driver */
  engine?: IDataEngine;

  /** Organization ID for multi-tenant isolation */
  organizationId?: string;

  /** Environment ID — null = platform-global, set = env-scoped */
  environmentId?: string;
}

/**
 * MetadataProjector
 *
 * Handles projection from sys_metadata to type-specific tables.
 */
export class MetadataProjector {
  private driver?: IDataDriver;
  private engine?: IDataEngine;
  /** Reserved for future multi-tenant projection scoping */
  readonly scope: { organizationId?: string; environmentId?: string };

  // Map of metadata types to their target table names
  private readonly typeTableMap: Record<string, string> = {
    object: 'sys_object',
    view: 'sys_view',
    agent: 'sys_agent',
    tool: 'sys_tool',
    flow: 'sys_flow',
    // Add more as needed: dashboard, app, action, workflow, etc.
  };

  constructor(options: MetadataProjectorOptions) {
    if (!options.driver && !options.engine) {
      throw new Error('MetadataProjector requires either a driver or engine');
    }
    this.driver = options.driver;
    this.engine = options.engine;
    this.scope = {
      organizationId: options.organizationId,
      environmentId: options.environmentId,
    };
  }

  /**
   * Project metadata to type-specific table
   */
  async project(type: string, name: string, data: any): Promise<void> {
    const targetTable = this.typeTableMap[type];
    if (!targetTable) {
      // Not all metadata types have projections (e.g., 'field' might not)
      return;
    }

    const projectedData = this.transformToProjection(type, name, data);
    if (!projectedData) {
      return;
    }

    try {
      // Check if projection already exists
      const existing = await this._findOne(targetTable, {
        where: { name },
      });

      if (existing) {
        // Update existing projection
        await this._update(targetTable, existing.id as string, projectedData);
      } else {
        // Create new projection
        const id = this.generateId();
        await this._create(targetTable, {
          id,
          ...projectedData,
        });
      }
    } catch (error) {
      // Log but don't fail the main save operation
      console.error(`Failed to project ${type}/${name} to ${targetTable}:`, error);
    }
  }

  /**
   * Delete projection from type-specific table
   */
  async deleteProjection(type: string, name: string): Promise<void> {
    const targetTable = this.typeTableMap[type];
    if (!targetTable) {
      return;
    }

    try {
      // Find the projection
      const existing = await this._findOne(targetTable, {
        where: { name },
      });

      if (existing) {
        await this._delete(targetTable, existing.id as string);
      }
    } catch (error) {
      console.error(`Failed to delete projection ${type}/${name} from ${targetTable}:`, error);
    }
  }

  /**
   * Transform metadata into projection record
   */
  private transformToProjection(type: string, name: string, data: any): Record<string, any> | null {
    const now = new Date().toISOString();

    switch (type) {
      case 'object':
        return this.projectObject(name, data, now);
      case 'view':
        return this.projectView(name, data, now);
      case 'agent':
        return this.projectAgent(name, data, now);
      case 'tool':
        return this.projectTool(name, data, now);
      case 'flow':
        return this.projectFlow(name, data, now);
      default:
        return null;
    }
  }

  /**
   * Project object metadata to sys_object
   */
  private projectObject(name: string, data: any, now: string): Record<string, any> {
    return {
      name,
      label: data.label || name,
      plural_label: data.pluralLabel || data.label || name,
      description: data.description || '',
      icon: data.icon || 'database',
      namespace: data.namespace || 'default',
      tags: Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || ''),
      active: data.active !== false,
      is_system: data.isSystem || false,
      abstract: data.abstract || false,
      datasource: data.datasource || 'default',
      table_name: data.name ? StorageNameMapping.resolveTableName({ name: data.name }) : name,
      // Serialize complex structures as JSON
      fields_json: data.fields ? JSON.stringify(data.fields) : null,
      indexes_json: data.indexes ? JSON.stringify(data.indexes) : null,
      validations_json: data.validations ? JSON.stringify(data.validations) : null,
      state_machines_json: data.stateMachines ? JSON.stringify(data.stateMachines) : null,
      capabilities_json: data.enable ? JSON.stringify(data.enable) : null,
      // Denormalized fields
      field_count: data.fields ? Object.keys(data.fields).length : 0,
      display_name_field: data.displayNameField || null,
      title_format: data.titleFormat || null,
      compact_layout: Array.isArray(data.compactLayout) ? data.compactLayout.join(',') : (data.compactLayout || null),
      // Capabilities (denormalized for easier querying)
      track_history: data.enable?.trackHistory || false,
      searchable: data.enable?.searchable !== false,
      api_enabled: data.enable?.apiEnabled !== false,
      files: data.enable?.files || false,
      feeds: data.enable?.feeds || false,
      activities: data.enable?.activities || false,
      trash: data.enable?.trash !== false,
      mru: data.enable?.mru !== false,
      clone: data.enable?.clone !== false,
      // Package management
      package_id: data.packageId || null,
      managed_by: data.managedBy || 'user',
      // Audit
      created_by: data.createdBy || null,
      created_at: data.createdAt || now,
      updated_by: data.updatedBy || null,
      updated_at: now,
    };
  }

  /**
   * Project view metadata to sys_view
   */
  private projectView(name: string, data: any, now: string): Record<string, any> {
    return {
      name,
      label: data.label || name,
      description: data.description || '',
      object_name: data.object || '',
      view_type: data.type || 'grid',
      // Serialize configurations as JSON
      columns_json: data.columns ? JSON.stringify(data.columns) : null,
      filters_json: data.filters ? JSON.stringify(data.filters) : null,
      sort_json: data.sort ? JSON.stringify(data.sort) : null,
      config_json: data.config ? JSON.stringify(data.config) : null,
      // Display options
      page_size: data.pageSize || 25,
      show_search: data.showSearch !== false,
      show_filters: data.showFilters !== false,
      // Classification
      namespace: data.namespace || 'default',
      // Package management
      package_id: data.packageId || null,
      managed_by: data.managedBy || 'user',
      // Audit
      created_by: data.createdBy || null,
      created_at: data.createdAt || now,
      updated_by: data.updatedBy || null,
      updated_at: now,
    };
  }

  /**
   * Project agent metadata to sys_agent
   */
  private projectAgent(name: string, data: any, now: string): Record<string, any> {
    return {
      name,
      label: data.label || name,
      description: data.description || '',
      agent_type: data.type || 'conversational',
      // Model configuration
      model: data.model || null,
      temperature: data.temperature ?? 0.7,
      max_tokens: data.maxTokens || null,
      top_p: data.topP || null,
      // System prompt
      system_prompt: data.systemPrompt || null,
      // Tools and skills as JSON
      tools_json: data.tools ? JSON.stringify(data.tools) : null,
      skills_json: data.skills ? JSON.stringify(data.skills) : null,
      // Memory
      memory_enabled: data.memoryEnabled || false,
      memory_window: data.memoryWindow || 10,
      // Classification
      namespace: data.namespace || 'default',
      // Package management
      package_id: data.packageId || null,
      managed_by: data.managedBy || 'user',
      // Audit
      created_by: data.createdBy || null,
      created_at: data.createdAt || now,
      updated_by: data.updatedBy || null,
      updated_at: now,
    };
  }

  /**
   * Project tool metadata to sys_tool
   */
  private projectTool(name: string, data: any, now: string): Record<string, any> {
    return {
      name,
      label: data.label || name,
      description: data.description || '',
      // Parameters and implementation
      parameters_json: data.parameters ? JSON.stringify(data.parameters) : null,
      handler_code: data.handler || null,
      // Classification
      namespace: data.namespace || 'default',
      // Package management
      package_id: data.packageId || null,
      managed_by: data.managedBy || 'user',
      // Audit
      created_by: data.createdBy || null,
      created_at: data.createdAt || now,
      updated_by: data.updatedBy || null,
      updated_at: now,
    };
  }

  /**
   * Project flow metadata to sys_flow
   */
  private projectFlow(name: string, data: any, now: string): Record<string, any> {
    return {
      name,
      label: data.label || name,
      description: data.description || '',
      flow_type: data.type || 'autolaunched',
      // Flow definition
      nodes_json: data.nodes ? JSON.stringify(data.nodes) : null,
      edges_json: data.edges ? JSON.stringify(data.edges) : null,
      variables_json: data.variables ? JSON.stringify(data.variables) : null,
      // Trigger configuration
      trigger_type: data.triggerType || null,
      trigger_object: data.triggerObject || null,
      // Status
      active: data.active || false,
      // Classification
      namespace: data.namespace || 'default',
      // Package management
      package_id: data.packageId || null,
      managed_by: data.managedBy || 'user',
      // Audit
      created_by: data.createdBy || null,
      created_at: data.createdAt || now,
      updated_by: data.updatedBy || null,
      updated_at: now,
    };
  }

  // ==========================================
  // Internal CRUD helpers (driver vs engine)
  // ==========================================

  private async _findOne(table: string, query: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (this.engine) {
      return this.engine.findOne(table, query as any);
    }
    return this.driver!.findOne(table, { object: table, ...query } as any);
  }

  private async _create(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.engine) {
      return this.engine.insert(table, data);
    }
    return this.driver!.create(table, data);
  }

  private async _update(table: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.engine) {
      return this.engine.update(table, { id, ...data });
    }
    return this.driver!.update(table, id, data);
  }

  private async _delete(table: string, id: string): Promise<any> {
    if (this.engine) {
      return this.engine.delete(table, { where: { id } } as any);
    }
    return this.driver!.delete(table, id);
  }

  /**
   * Generate a simple unique ID
   */
  private generateId(): string {
    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

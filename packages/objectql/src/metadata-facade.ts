// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { SchemaRegistry } from './registry.js';

/**
 * MetadataFacade
 *
 * Provides a clean, injectable interface over SchemaRegistry.
 * Registered as the 'metadata' kernel service to eliminate
 * downstream packages needing to manually wrap SchemaRegistry.
 *
 * Implements the async IMetadataService interface.
 * Internally delegates to SchemaRegistry (in-memory) with Promise wrappers.
 *
 * Each facade is bound to a specific SchemaRegistry instance — passed in the
 * constructor — so that multi-kernel servers can give every kernel its own
 * metadata surface without leaking state across tenants.
 */
export class MetadataFacade {
  constructor(private registry: SchemaRegistry) {}

  /**
   * Register a metadata item
   */
  async register(type: string, name: string, data: any): Promise<void> {
    const definition = typeof data === 'object' && data !== null
      ? { ...data, name: data.name ?? name }
      : data;
    if (type === 'object') {
      this.registry.registerItem(type, definition, 'name' as any);
    } else {
      this.registry.registerItem(type, definition, definition.id ? 'id' as any : 'name' as any);
    }
  }

  /**
   * Get a metadata item by type and name
   */
  async get(type: string, name: string): Promise<any> {
    const item = this.registry.getItem(type, name) as any;
    return item?.content ?? item;
  }

  /**
   * Get the raw entry (with metadata wrapper)
   */
  getEntry(type: string, name: string): any {
    return this.registry.getItem(type, name);
  }

  /**
   * List all items of a type
   */
  async list(type: string): Promise<any[]> {
    const items = this.registry.listItems(type);
    return items.map((item: any) => item?.content ?? item);
  }

  /**
   * Unregister a metadata item
   */
  async unregister(type: string, name: string): Promise<void> {
    this.registry.unregisterItem(type, name);
  }

  /**
   * Check if a metadata item exists
   */
  async exists(type: string, name: string): Promise<boolean> {
    const item = this.registry.getItem(type, name);
    return item !== undefined && item !== null;
  }

  /**
   * List all names of metadata items of a given type
   */
  async listNames(type: string): Promise<string[]> {
    const items = this.registry.listItems(type);
    return items.map((item: any) => item?.name ?? item?.content?.name ?? '').filter(Boolean);
  }

  /**
   * Unregister all metadata from a package
   */
  async unregisterPackage(packageName: string): Promise<void> {
    this.registry.unregisterObjectsByPackage(packageName);
  }

  /**
   * Convenience: get object definition
   */
  async getObject(name: string): Promise<any> {
    return this.registry.getObject(name);
  }

  /**
   * Convenience: list all objects
   */
  async listObjects(): Promise<any[]> {
    return this.registry.getAllObjects();
  }
}

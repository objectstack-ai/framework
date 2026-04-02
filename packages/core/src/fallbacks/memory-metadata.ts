// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * In-memory metadata service fallback.
 *
 * Implements the IMetadataService contract with a simple Map-of-Maps store.
 * Used by ObjectKernel as an automatic fallback when no real metadata plugin
 * (e.g. MetadataPlugin with file-system persistence) is registered.
 */
export function createMemoryMetadata() {
  // type -> name -> data
  const store = new Map<string, Map<string, any>>();

  function getTypeMap(type: string): Map<string, any> {
    let map = store.get(type);
    if (!map) {
      map = new Map();
      store.set(type, map);
    }
    return map;
  }

  return {
    _fallback: true, _serviceName: 'metadata',
    async register(type: string, name: string, data: any): Promise<void> {
      getTypeMap(type).set(name, data);
    },
    async get(type: string, name: string): Promise<any> {
      return getTypeMap(type).get(name);
    },
    async list(type: string): Promise<any[]> {
      return Array.from(getTypeMap(type).values());
    },
    async unregister(type: string, name: string): Promise<void> {
      getTypeMap(type).delete(name);
    },
    async exists(type: string, name: string): Promise<boolean> {
      return getTypeMap(type).has(name);
    },
    async listNames(type: string): Promise<string[]> {
      return Array.from(getTypeMap(type).keys());
    },
    async getObject(name: string): Promise<any> {
      return getTypeMap('object').get(name);
    },
    async listObjects(): Promise<any[]> {
      return Array.from(getTypeMap('object').values());
    },
  };
}

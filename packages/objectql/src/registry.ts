// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ServiceObject, ObjectSchema, ObjectOwnership } from '@objectstack/spec/data';
import { ObjectStackManifest, ManifestSchema, InstalledPackage, InstalledPackageSchema } from '@objectstack/spec/kernel';
import { AppSchema } from '@objectstack/spec/ui';

/**
 * Reserved namespaces that do not get FQN prefix applied.
 * Objects in these namespaces keep their short names (e.g., "user" not "base__user").
 */
export const RESERVED_NAMESPACES = new Set(['base', 'system']);

/**
 * Default priorities for ownership types.
 */
export const DEFAULT_OWNER_PRIORITY = 100;
export const DEFAULT_EXTENDER_PRIORITY = 200;

/**
 * Contributor Record
 * Tracks how a package contributes to an object (own or extend).
 */
export interface ObjectContributor {
  packageId: string;
  namespace: string;
  ownership: ObjectOwnership;
  priority: number;
  definition: ServiceObject;
}

/**
 * Compute Fully Qualified Name (FQN) for an object.
 * 
 * @param namespace - The package namespace (e.g., "crm", "todo")
 * @param shortName - The object's short name (e.g., "task", "account")
 * @returns FQN string (e.g., "crm__task") or just shortName for reserved namespaces
 * 
 * @example
 * computeFQN('crm', 'account')  // => 'crm__account'
 * computeFQN('base', 'user')    // => 'user' (reserved, no prefix)
 * computeFQN(undefined, 'task') // => 'task' (legacy, no namespace)
 */
export function computeFQN(namespace: string | undefined, shortName: string): string {
  if (!namespace || RESERVED_NAMESPACES.has(namespace)) {
    return shortName;
  }
  return `${namespace}__${shortName}`;
}

/**
 * Parse FQN back to namespace and short name.
 * 
 * @param fqn - Fully qualified name (e.g., "crm__account" or "user")
 * @returns { namespace, shortName } - namespace is undefined for unprefixed names
 */
export function parseFQN(fqn: string): { namespace: string | undefined; shortName: string } {
  const idx = fqn.indexOf('__');
  if (idx === -1) {
    return { namespace: undefined, shortName: fqn };
  }
  return {
    namespace: fqn.slice(0, idx),
    shortName: fqn.slice(idx + 2),
  };
}

/**
 * Deep merge two ServiceObject definitions.
 * Fields are merged additively. Other props: later value wins.
 */
function mergeObjectDefinitions(base: ServiceObject, extension: Partial<ServiceObject>): ServiceObject {
  const merged = { ...base };

  // Merge fields additively
  if (extension.fields) {
    merged.fields = { ...base.fields, ...extension.fields };
  }

  // Merge validations additively
  if (extension.validations) {
    merged.validations = [...(base.validations || []), ...extension.validations];
  }

  // Merge indexes additively
  if (extension.indexes) {
    merged.indexes = [...(base.indexes || []), ...extension.indexes];
  }

  // Override scalar props (last writer wins)
  if (extension.label !== undefined) merged.label = extension.label;
  if (extension.pluralLabel !== undefined) merged.pluralLabel = extension.pluralLabel;
  if (extension.description !== undefined) merged.description = extension.description;

  return merged;
}

/**
 * Global Schema Registry
 * Unified storage for all metadata types (Objects, Apps, Flows, Layouts, etc.)
 * 
 * ## Namespace & Ownership Model
 * 
 * Objects use a namespace-based FQN system:
 * - `namespace`: Short identifier from package manifest (e.g., "crm", "todo")
 * - `FQN`: `{namespace}__{short_name}` (e.g., "crm__account")
 * - Reserved namespaces (`base`, `system`) don't get prefixed
 * 
 * Ownership modes:
 * - `own`: One package owns the object (creates the table, defines base schema)
 * - `extend`: Multiple packages can extend an object (add fields, merge by priority)
 * 
 * ## Package vs App Distinction
 * - **Package**: The unit of installation, stored under type 'package'.
 *   Each InstalledPackage wraps a ManifestSchema with lifecycle state.
 * - **App**: A UI navigation shell (AppSchema), registered under type 'apps'.
 *   Apps are extracted from packages during registration.
 * - A package may contain 0, 1, or many apps.
 */
export type RegistryLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export class SchemaRegistry {
  // ==========================================
  // Logging control
  // ==========================================

  /** Controls verbosity of registry console messages. Default: 'info'. */
  private _logLevel: RegistryLogLevel = 'info';

  get logLevel(): RegistryLogLevel { return this._logLevel; }
  set logLevel(level: RegistryLogLevel) { this._logLevel = level; }

  private log(msg: string): void {
    if (this._logLevel === 'silent' || this._logLevel === 'error' || this._logLevel === 'warn') return;
    console.log(msg);
  }

  // ==========================================
  // Object-specific storage (Ownership Model)
  // ==========================================

  /** FQN → Contributor[] (all packages that own/extend this object) */
  private objectContributors = new Map<string, ObjectContributor[]>();

  /** FQN → Merged ServiceObject (cached, invalidated on changes) */
  private mergedObjectCache = new Map<string, ServiceObject>();

  /** Namespace → Set<PackageId> (multiple packages can share a namespace) */
  private namespaceRegistry = new Map<string, Set<string>>();

  // ==========================================
  // Generic metadata storage (non-object types)
  // ==========================================

  /** Type → Name/ID → MetadataItem */
  private metadata = new Map<string, Map<string, any>>();

  // ==========================================
  // Namespace Management
  // ==========================================

  /**
   * Register a namespace for a package.
   * Multiple packages can share the same namespace (e.g. 'sys').
   */
  registerNamespace(namespace: string, packageId: string): void {
    if (!namespace) return;

    let owners = this.namespaceRegistry.get(namespace);
    if (!owners) {
      owners = new Set();
      this.namespaceRegistry.set(namespace, owners);
    }
    owners.add(packageId);
    this.log(`[Registry] Registered namespace: ${namespace} → ${packageId}`);
  }

  /**
   * Unregister a namespace when a package is uninstalled.
   */
  unregisterNamespace(namespace: string, packageId: string): void {
    const owners = this.namespaceRegistry.get(namespace);
    if (owners) {
      owners.delete(packageId);
      if (owners.size === 0) {
        this.namespaceRegistry.delete(namespace);
      }
      this.log(`[Registry] Unregistered namespace: ${namespace} ← ${packageId}`);
    }
  }

  /**
   * Get the packages that use a namespace.
   */
  getNamespaceOwner(namespace: string): string | undefined {
    const owners = this.namespaceRegistry.get(namespace);
    if (!owners || owners.size === 0) return undefined;
    // Return the first registered package for backwards compatibility
    return owners.values().next().value;
  }

  /**
   * Get all packages that share a namespace.
   */
  getNamespaceOwners(namespace: string): string[] {
    const owners = this.namespaceRegistry.get(namespace);
    return owners ? Array.from(owners) : [];
  }

  // ==========================================
  // Object Registration (Ownership Model)
  // ==========================================

  /**
   * Register an object with ownership semantics.
   * 
   * @param schema - The object definition
   * @param packageId - The owning package ID
   * @param namespace - The package namespace (for FQN computation)
   * @param ownership - 'own' (single owner) or 'extend' (additive merge)
   * @param priority - Merge priority (lower applied first, higher wins on conflict)
   * 
   * @throws Error if trying to 'own' an object that already has an owner
   */
  registerObject(
    schema: ServiceObject,
    packageId: string,
    namespace?: string,
    ownership: ObjectOwnership = 'own',
    priority: number = ownership === 'own' ? DEFAULT_OWNER_PRIORITY : DEFAULT_EXTENDER_PRIORITY
  ): string {
    const shortName = schema.name;
    const fqn = computeFQN(namespace, shortName);

    // Ensure namespace is registered
    if (namespace) {
      this.registerNamespace(namespace, packageId);
    }

    // Get or create contributor list
    let contributors = this.objectContributors.get(fqn);
    if (!contributors) {
      contributors = [];
      this.objectContributors.set(fqn, contributors);
    }

    // Validate ownership rules
    if (ownership === 'own') {
      const existingOwner = contributors.find(c => c.ownership === 'own');
      if (existingOwner && existingOwner.packageId !== packageId) {
        throw new Error(
          `Object "${fqn}" is already owned by package "${existingOwner.packageId}". ` +
          `Package "${packageId}" cannot claim ownership. Use 'extend' to add fields.`
        );
      }
      // Remove existing owner contribution from same package (re-registration)
      const idx = contributors.findIndex(c => c.packageId === packageId && c.ownership === 'own');
      if (idx !== -1) {
        contributors.splice(idx, 1);
        console.warn(`[Registry] Re-registering owned object: ${fqn} from ${packageId}`);
      }
    } else {
      // extend mode: remove existing extension from same package
      const idx = contributors.findIndex(c => c.packageId === packageId && c.ownership === 'extend');
      if (idx !== -1) {
        contributors.splice(idx, 1);
      }
    }

    // Add new contributor
    const contributor: ObjectContributor = {
      packageId,
      namespace: namespace || '',
      ownership,
      priority,
      definition: { ...schema, name: fqn }, // Store with FQN as name
    };
    contributors.push(contributor);

    // Sort by priority (ascending: lower priority applied first)
    contributors.sort((a, b) => a.priority - b.priority);

    // Invalidate merge cache
    this.mergedObjectCache.delete(fqn);

    this.log(`[Registry] Registered object: ${fqn} (${ownership}, priority=${priority}) from ${packageId}`);
    return fqn;
  }

  /**
   * Resolve an object by FQN, merging all contributions.
   * Returns the merged object or undefined if not found.
   */
  resolveObject(fqn: string): ServiceObject | undefined {
    // Check cache first
    const cached = this.mergedObjectCache.get(fqn);
    if (cached) return cached;

    const contributors = this.objectContributors.get(fqn);
    if (!contributors || contributors.length === 0) {
      return undefined;
    }

    // Find owner (must exist for a valid object)
    const ownerContrib = contributors.find(c => c.ownership === 'own');
    if (!ownerContrib) {
      console.warn(`[Registry] Object "${fqn}" has extenders but no owner. Skipping.`);
      return undefined;
    }

    // Start with owner's definition
    let merged = { ...ownerContrib.definition };

    // Apply extensions in priority order (already sorted)
    for (const contrib of contributors) {
      if (contrib.ownership === 'extend') {
        merged = mergeObjectDefinitions(merged, contrib.definition);
      }
    }

    // Cache the result
    this.mergedObjectCache.set(fqn, merged);
    return merged;
  }

  /**
   * Get object by name (FQN, short name, or physical table name).
   *
   * Resolution order:
   * 1. Exact FQN match (e.g., 'crm__account')
   * 2. Short name fallback (e.g., 'account' → 'crm__account')
   * 3. Physical table name match (e.g., 'sys_user' → 'sys__user')
   *    ObjectSchema.create() auto-derives tableName as {namespace}_{name},
   *    which uses a single underscore — different from the FQN double underscore.
   */
  getObject(name: string): ServiceObject | undefined {
    // Direct FQN lookup
    const direct = this.resolveObject(name);
    if (direct) return direct;

    // Fallback: scan for objects ending with the short name
    // This handles legacy code that doesn't use FQN
    for (const fqn of this.objectContributors.keys()) {
      const { shortName } = parseFQN(fqn);
      if (shortName === name) {
        return this.resolveObject(fqn);
      }
    }

    // Fallback: match by physical table name (e.g., 'sys_user' → FQN 'sys__user')
    // This bridges the gap between protocol names (SystemObjectName) and FQN.
    for (const fqn of this.objectContributors.keys()) {
      const resolved = this.resolveObject(fqn);
      if (resolved?.tableName === name) {
        return resolved;
      }
    }

    return undefined;
  }

  /**
   * Get all registered objects (merged).
   * 
   * @param packageId - Optional filter: only objects contributed by this package
   */
  getAllObjects(packageId?: string): ServiceObject[] {
    const results: ServiceObject[] = [];

    for (const fqn of this.objectContributors.keys()) {
      // If filtering by package, check if this package contributes
      if (packageId) {
        const contributors = this.objectContributors.get(fqn);
        const hasContribution = contributors?.some(c => c.packageId === packageId);
        if (!hasContribution) continue;
      }

      const merged = this.resolveObject(fqn);
      if (merged) {
        // Tag with contributor info for UI
        (merged as any)._packageId = this.getObjectOwner(fqn)?.packageId;
        results.push(merged);
      }
    }

    return results;
  }

  /**
   * Get all contributors for an object.
   */
  getObjectContributors(fqn: string): ObjectContributor[] {
    return this.objectContributors.get(fqn) || [];
  }

  /**
   * Get the owner contributor for an object.
   */
  getObjectOwner(fqn: string): ObjectContributor | undefined {
    const contributors = this.objectContributors.get(fqn);
    return contributors?.find(c => c.ownership === 'own');
  }

  /**
   * Unregister all objects contributed by a package.
   * 
   * @throws Error if trying to uninstall an owner that has extenders
   */
  unregisterObjectsByPackage(packageId: string, force: boolean = false): void {
    for (const [fqn, contributors] of this.objectContributors.entries()) {
      // Find this package's contributions
      const packageContribs = contributors.filter(c => c.packageId === packageId);
      
      for (const contrib of packageContribs) {
        if (contrib.ownership === 'own' && !force) {
          // Check if there are extenders from other packages
          const otherExtenders = contributors.filter(
            c => c.packageId !== packageId && c.ownership === 'extend'
          );
          if (otherExtenders.length > 0) {
            throw new Error(
              `Cannot uninstall package "${packageId}": object "${fqn}" is extended by ` +
              `${otherExtenders.map(c => c.packageId).join(', ')}. Uninstall extenders first.`
            );
          }
        }

        // Remove contribution
        const idx = contributors.indexOf(contrib);
        if (idx !== -1) {
          contributors.splice(idx, 1);
          this.log(`[Registry] Removed ${contrib.ownership} contribution to ${fqn} from ${packageId}`);
        }
      }

      // Clean up empty contributor lists
      if (contributors.length === 0) {
        this.objectContributors.delete(fqn);
      }

      // Invalidate cache
      this.mergedObjectCache.delete(fqn);
    }
  }

  // ==========================================
  // Generic Metadata (Non-Object Types)
  // ==========================================

  /**
   * Universal Register Method for non-object metadata.
   */
  registerItem<T>(type: string, item: T, keyField: keyof T = 'name' as keyof T, packageId?: string) {
    if (!this.metadata.has(type)) {
      this.metadata.set(type, new Map());
    }
    const collection = this.metadata.get(type)!;
    const baseName = String(item[keyField]);
    
    // Tag item with owning package for scoped queries
    if (packageId) {
      (item as any)._packageId = packageId;
    }

    // Validation Hook
    try {
      this.validate(type, item);
    } catch (e: any) {
      console.error(`[Registry] Validation failed for ${type} ${baseName}: ${e.message}`);
    }

    // Use composite key (packageId:name) when packageId is provided
    const storageKey = packageId ? `${packageId}:${baseName}` : baseName;

    if (collection.has(storageKey)) {
      console.warn(`[Registry] Overwriting ${type}: ${storageKey}`);
    }
    collection.set(storageKey, item);
    this.log(`[Registry] Registered ${type}: ${storageKey}`);
  }

  /**
   * Validate Metadata against Spec Zod Schemas
   */
  validate(type: string, item: any): unknown {
    if (type === 'object') {
      return ObjectSchema.parse(item);
    }
    if (type === 'app') {
      return AppSchema.parse(item);
    }
    if (type === 'package') {
      return InstalledPackageSchema.parse(item);
    }
    if (type === 'plugin') {
      return ManifestSchema.parse(item);
    }
    return true;
  }

  /**
   * Universal Unregister Method
   */
  unregisterItem(type: string, name: string) {
    const collection = this.metadata.get(type);
    if (!collection) {
      console.warn(`[Registry] Attempted to unregister non-existent ${type}: ${name}`);
      return;
    }
    if (collection.has(name)) {
      collection.delete(name);
      this.log(`[Registry] Unregistered ${type}: ${name}`);
      return;
    }
    // Scan composite keys
    for (const key of collection.keys()) {
      if (key.endsWith(`:${name}`)) {
        collection.delete(key);
        this.log(`[Registry] Unregistered ${type}: ${key}`);
        return;
      }
    }
    console.warn(`[Registry] Attempted to unregister non-existent ${type}: ${name}`);
  }

  /**
   * Universal Get Method
   */
  getItem<T>(type: string, name: string): T | undefined {
    // Special handling for 'object' and 'objects' types - use objectContributors
    if (type === 'object' || type === 'objects') {
      return this.getObject(name) as unknown as T | undefined;
    }
    
    const collection = this.metadata.get(type);
    if (!collection) return undefined;
    const direct = collection.get(name);
    if (direct) return direct as T;
    // Scan for composite keys
    for (const [key, item] of collection) {
      if (key.endsWith(`:${name}`)) return item as T;
    }
    return undefined;
  }

  /**
   * Universal List Method
   */
  listItems<T>(type: string, packageId?: string): T[] {
    // Special handling for 'object' and 'objects' types - use objectContributors
    if (type === 'object' || type === 'objects') {
      return this.getAllObjects(packageId) as unknown as T[];
    }

    const items = Array.from(this.metadata.get(type)?.values() || []) as T[];
    if (packageId) {
      return items.filter((item: any) => item._packageId === packageId);
    }
    return items;
  }

  /**
   * Get all registered metadata types (Kinds)
   */
  getRegisteredTypes(): string[] {
    const types = Array.from(this.metadata.keys());
    // Always include 'object' even if stored separately
    if (!types.includes('object') && this.objectContributors.size > 0) {
      types.push('object');
    }
    return types;
  }

  // ==========================================
  // Package Management
  // ==========================================

  installPackage(manifest: ObjectStackManifest, settings?: Record<string, any>): InstalledPackage {
    const now = new Date().toISOString();
    const pkg: InstalledPackage = {
      manifest,
      status: 'installed',
      enabled: true,
      installedAt: now,
      updatedAt: now,
      settings,
    };
    
    // Register namespace if present
    if (manifest.namespace) {
      this.registerNamespace(manifest.namespace, manifest.id);
    }
    
    if (!this.metadata.has('package')) {
      this.metadata.set('package', new Map());
    }
    const collection = this.metadata.get('package')!;
    if (collection.has(manifest.id)) {
      console.warn(`[Registry] Overwriting package: ${manifest.id}`);
    }
    collection.set(manifest.id, pkg);
    this.log(`[Registry] Installed package: ${manifest.id} (${manifest.name})`);
    return pkg;
  }

  uninstallPackage(id: string): boolean {
    const pkg = this.getPackage(id);
    if (!pkg) {
      console.warn(`[Registry] Package not found for uninstall: ${id}`);
      return false;
    }

    // Unregister namespace
    if (pkg.manifest.namespace) {
      this.unregisterNamespace(pkg.manifest.namespace, id);
    }

    // Unregister objects (will throw if extenders exist)
    this.unregisterObjectsByPackage(id);

    // Remove package record
    const collection = this.metadata.get('package');
    if (collection) {
      collection.delete(id);
      this.log(`[Registry] Uninstalled package: ${id}`);
      return true;
    }
    return false;
  }

  getPackage(id: string): InstalledPackage | undefined {
    return this.metadata.get('package')?.get(id) as InstalledPackage | undefined;
  }

  getAllPackages(): InstalledPackage[] {
    return this.listItems<InstalledPackage>('package');
  }

  enablePackage(id: string): InstalledPackage | undefined {
    const pkg = this.getPackage(id);
    if (pkg) {
      pkg.enabled = true;
      pkg.status = 'installed';
      pkg.statusChangedAt = new Date().toISOString();
      pkg.updatedAt = new Date().toISOString();
      this.log(`[Registry] Enabled package: ${id}`);
    }
    return pkg;
  }

  disablePackage(id: string): InstalledPackage | undefined {
    const pkg = this.getPackage(id);
    if (pkg) {
      pkg.enabled = false;
      pkg.status = 'disabled';
      pkg.statusChangedAt = new Date().toISOString();
      pkg.updatedAt = new Date().toISOString();
      this.log(`[Registry] Disabled package: ${id}`);
    }
    return pkg;
  }

  // ==========================================
  // App Helpers
  // ==========================================

  registerApp(app: any, packageId?: string) {
    this.registerItem('app', app, 'name', packageId);
  }

  getApp(name: string): any {
    return this.getItem('app', name);
  }

  getAllApps(): any[] {
    return this.listItems('app');
  }

  // ==========================================
  // Plugin Helpers
  // ==========================================

  registerPlugin(manifest: ObjectStackManifest) {
    this.registerItem('plugin', manifest, 'id');
  }

  getAllPlugins(): ObjectStackManifest[] {
    return this.listItems<ObjectStackManifest>('plugin');
  }

  // ==========================================
  // Kind Helpers
  // ==========================================

  registerKind(kind: { id: string, globs: string[] }) {
    this.registerItem('kind', kind, 'id');
  }
  
  getAllKinds(): { id: string, globs: string[] }[] {
    return this.listItems('kind');
  }

  // ==========================================
  // Reset (for testing)
  // ==========================================

  /**
   * Clear all registry state. Use only for testing.
   */
  reset(): void {
    this.objectContributors.clear();
    this.mergedObjectCache.clear();
    this.namespaceRegistry.clear();
    this.metadata.clear();
    this.log('[Registry] Reset complete');
  }
}

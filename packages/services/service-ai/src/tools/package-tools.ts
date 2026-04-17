// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Tool } from '@objectstack/spec/ai';
import type { InstalledPackage } from '@objectstack/spec/kernel';
import type { ToolHandler } from './tool-registry.js';
import type { ToolRegistry } from './tool-registry.js';

// ---------------------------------------------------------------------------
// Tool Metadata — individual .tool.ts files (single source of truth)
// ---------------------------------------------------------------------------

export { listPackagesTool } from './list-packages.tool.js';
export { getPackageTool } from './get-package.tool.js';
export { createPackageTool } from './create-package.tool.js';
export { getActivePackageTool } from './get-active-package.tool.js';
export { setActivePackageTool } from './set-active-package.tool.js';

import { listPackagesTool } from './list-packages.tool.js';
import { getPackageTool } from './get-package.tool.js';
import { createPackageTool } from './create-package.tool.js';
import { getActivePackageTool } from './get-active-package.tool.js';
import { setActivePackageTool } from './set-active-package.tool.js';

/** All built-in package management tool definitions (Tool metadata). */
export const PACKAGE_TOOL_DEFINITIONS: Tool[] = [
  listPackagesTool,
  getPackageTool,
  createPackageTool,
  getActivePackageTool,
  setActivePackageTool,
];

// ---------------------------------------------------------------------------
// Package Registry Interface (minimal contract for package operations)
// ---------------------------------------------------------------------------

/**
 * Minimal package registry interface for tool operations.
 * The actual implementation may be a full PackageRegistry service.
 */
export interface IPackageRegistry {
  /** List all installed packages */
  list(filter?: { status?: string; enabled?: boolean }): Promise<InstalledPackage[]>;

  /** Get a specific package by ID */
  get(packageId: string): Promise<InstalledPackage | undefined>;

  /** Install a new package */
  install(manifest: Record<string, unknown>): Promise<InstalledPackage>;

  /** Check if a package exists */
  exists(packageId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Conversation Service Interface (for tracking active package)
// ---------------------------------------------------------------------------

/**
 * Minimal conversation service interface for context management.
 */
export interface IConversationService {
  /** Get conversation metadata */
  getMetadata?(conversationId: string): Promise<Record<string, unknown> | undefined>;

  /** Update conversation metadata */
  updateMetadata?(conversationId: string, metadata: Record<string, unknown>): Promise<void>;
}

// ---------------------------------------------------------------------------
// Context — injected once at registration time
// ---------------------------------------------------------------------------

/**
 * Services required by the package management tools.
 *
 * Provided by the kernel at `ai:ready` time and closed over
 * by the handler functions so they stay framework-agnostic.
 */
export interface PackageToolContext {
  /** Package registry for package CRUD operations */
  packageRegistry: IPackageRegistry;

  /** Conversation service for tracking active package context (optional) */
  conversationService?: IConversationService;

  /** Current conversation ID (if in a conversation context) */
  conversationId?: string;
}

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

/** Reverse domain notation pattern (e.g. com.acme.crm). */
const REVERSE_DOMAIN_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

/** snake_case identifier pattern. */
const SNAKE_CASE_RE = /^[a-z_][a-z0-9_]*$/;

/** Semantic version pattern. */
const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-z0-9]+(\.[a-z0-9]+)*)?$/;

/**
 * Validate that a value matches reverse domain notation.
 */
function isReverseDomain(value: string): boolean {
  return REVERSE_DOMAIN_RE.test(value);
}

/**
 * Validate that a value matches snake_case.
 */
function isSnakeCase(value: string): boolean {
  return SNAKE_CASE_RE.test(value);
}

/**
 * Validate semantic version.
 */
function isSemVer(value: string): boolean {
  return SEMVER_RE.test(value);
}

/**
 * Derive namespace from package ID.
 * Example: "com.acme.crm" -> "crm"
 */
function deriveNamespace(packageId: string): string {
  const parts = packageId.split('.');
  return parts[parts.length - 1];
}

// ---------------------------------------------------------------------------
// Handler Factories
// ---------------------------------------------------------------------------

function createListPackagesHandler(ctx: PackageToolContext): ToolHandler {
  return async (args) => {
    const { status, enabled } = (args ?? {}) as {
      status?: string;
      enabled?: boolean;
    };

    const filter: { status?: string; enabled?: boolean } = {};
    if (status) filter.status = status;
    if (enabled !== undefined) filter.enabled = enabled;

    const packages = await ctx.packageRegistry.list(filter);

    const result = packages.map(pkg => ({
      id: pkg.manifest.id,
      name: pkg.manifest.name,
      version: pkg.manifest.version,
      type: pkg.manifest.type,
      status: pkg.status,
      enabled: pkg.enabled,
      installedAt: pkg.installedAt,
      description: pkg.manifest.description,
    }));

    return JSON.stringify({
      packages: result,
      total: result.length,
    });
  };
}

function createGetPackageHandler(ctx: PackageToolContext): ToolHandler {
  return async (args) => {
    const { packageId } = args as { packageId: string };

    if (!packageId) {
      return JSON.stringify({ error: 'packageId is required' });
    }

    const pkg = await ctx.packageRegistry.get(packageId);

    if (!pkg) {
      return JSON.stringify({ error: `Package "${packageId}" not found` });
    }

    return JSON.stringify({
      id: pkg.manifest.id,
      name: pkg.manifest.name,
      version: pkg.manifest.version,
      type: pkg.manifest.type,
      status: pkg.status,
      enabled: pkg.enabled,
      installedAt: pkg.installedAt,
      updatedAt: pkg.updatedAt,
      description: pkg.manifest.description,
      namespace: pkg.manifest.namespace,
      dependencies: pkg.manifest.dependencies,
      registeredNamespaces: pkg.registeredNamespaces,
    });
  };
}

function createCreatePackageHandler(ctx: PackageToolContext): ToolHandler {
  return async (args) => {
    const { id, name, version = '1.0.0', description, namespace, type = 'application' } = args as {
      id: string;
      name: string;
      version?: string;
      description?: string;
      namespace?: string;
      type?: string;
    };

    // Validate required fields
    if (!id || !name) {
      return JSON.stringify({ error: 'Both "id" and "name" are required' });
    }

    // Validate package ID format (reverse domain notation)
    if (!isReverseDomain(id)) {
      return JSON.stringify({
        error: `Invalid package ID "${id}". Must be in reverse domain notation (e.g., com.acme.crm, org.mycompany.sales)`,
      });
    }

    // Validate version format
    if (!isSemVer(version)) {
      return JSON.stringify({
        error: `Invalid version "${version}". Must be semantic version (e.g., 1.0.0, 2.1.3-beta)`,
      });
    }

    // Check if package already exists
    const exists = await ctx.packageRegistry.exists(id);
    if (exists) {
      return JSON.stringify({ error: `Package "${id}" already exists` });
    }

    // Derive or validate namespace
    const derivedNamespace = namespace || deriveNamespace(id);
    if (!isSnakeCase(derivedNamespace)) {
      return JSON.stringify({
        error: `Invalid namespace "${derivedNamespace}". Must be snake_case (e.g., crm, sales_module)`,
      });
    }

    // Build manifest
    const manifest: Record<string, unknown> = {
      id,
      name,
      version,
      type,
      namespace: derivedNamespace,
      ...(description ? { description } : {}),
    };

    // Install the package
    const installedPackage = await ctx.packageRegistry.install(manifest);

    // Set as active package in conversation if conversation service is available
    if (ctx.conversationService && ctx.conversationId) {
      try {
        await ctx.conversationService.updateMetadata?.(ctx.conversationId, {
          activePackageId: id,
        });
      } catch (err) {
        // Non-critical error - package was created successfully
        console.warn('Failed to set active package in conversation:', err);
      }
    }

    return JSON.stringify({
      packageId: installedPackage.manifest.id,
      name: installedPackage.manifest.name,
      version: installedPackage.manifest.version,
      namespace: installedPackage.manifest.namespace,
      status: installedPackage.status,
      message: `Package "${name}" created successfully and set as active package`,
    });
  };
}

function createGetActivePackageHandler(ctx: PackageToolContext): ToolHandler {
  return async () => {
    // If no conversation service, can't track active package
    if (!ctx.conversationService || !ctx.conversationId) {
      return JSON.stringify({
        activePackageId: null,
        message: 'No conversation context available to track active package',
      });
    }

    try {
      const metadata = await ctx.conversationService.getMetadata?.(ctx.conversationId);
      const activePackageId = metadata?.activePackageId as string | undefined;

      if (!activePackageId) {
        return JSON.stringify({
          activePackageId: null,
          message: 'No active package set. Use set_active_package or create a new package.',
        });
      }

      // Get package details
      const pkg = await ctx.packageRegistry.get(activePackageId);

      if (!pkg) {
        return JSON.stringify({
          activePackageId,
          error: `Active package "${activePackageId}" not found. It may have been uninstalled.`,
        });
      }

      return JSON.stringify({
        activePackageId: pkg.manifest.id,
        name: pkg.manifest.name,
        version: pkg.manifest.version,
        namespace: pkg.manifest.namespace,
        type: pkg.manifest.type,
      });
    } catch (err) {
      return JSON.stringify({
        error: `Failed to get active package: ${(err as Error).message}`,
      });
    }
  };
}

function createSetActivePackageHandler(ctx: PackageToolContext): ToolHandler {
  return async (args) => {
    const { packageId } = args as { packageId: string };

    if (!packageId) {
      return JSON.stringify({ error: 'packageId is required' });
    }

    // Verify package exists
    const pkg = await ctx.packageRegistry.get(packageId);
    if (!pkg) {
      return JSON.stringify({ error: `Package "${packageId}" not found` });
    }

    // If no conversation service, return error
    if (!ctx.conversationService || !ctx.conversationId) {
      return JSON.stringify({
        error: 'No conversation context available. Cannot set active package.',
      });
    }

    try {
      await ctx.conversationService.updateMetadata?.(ctx.conversationId, {
        activePackageId: packageId,
      });

      return JSON.stringify({
        activePackageId: packageId,
        name: pkg.manifest.name,
        namespace: pkg.manifest.namespace,
        message: `Active package set to "${pkg.manifest.name}"`,
      });
    } catch (err) {
      return JSON.stringify({
        error: `Failed to set active package: ${(err as Error).message}`,
      });
    }
  };
}

// ---------------------------------------------------------------------------
// Public Registration Helper
// ---------------------------------------------------------------------------

/**
 * Register all built-in package management tools on the given {@link ToolRegistry}.
 *
 * Typically called from the `ai:ready` hook after the package registry is available.
 *
 * @example
 * ```ts
 * ctx.hook('ai:ready', async (aiService) => {
 *   const packageRegistry = ctx.getService<IPackageRegistry>('packageRegistry');
 *   const conversationService = ctx.getService<IConversationService>('conversation');
 *   registerPackageTools(aiService.toolRegistry, {
 *     packageRegistry,
 *     conversationService,
 *   });
 * });
 * ```
 */
export function registerPackageTools(
  registry: ToolRegistry,
  context: PackageToolContext,
): void {
  registry.register(listPackagesTool, createListPackagesHandler(context));
  registry.register(getPackageTool, createGetPackageHandler(context));
  registry.register(createPackageTool, createCreatePackageHandler(context));
  registry.register(getActivePackageTool, createGetActivePackageHandler(context));
  registry.register(setActivePackageTool, createSetActivePackageHandler(context));
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from './types.js';
import type { Logger } from '@objectstack/spec/contracts';
import { z } from 'zod';
import { PluginConfigValidator } from './security/plugin-config-validator.js';

/**
 * Service Lifecycle Types
 * Defines how services are instantiated and managed
 */
export enum ServiceLifecycle {
    /** Single instance shared across all requests */
    SINGLETON = 'singleton',
    /** New instance created for each request */
    TRANSIENT = 'transient',
    /** New instance per scope (e.g., per HTTP request) */
    SCOPED = 'scoped',
}

/**
 * Service Factory
 * Function that creates a service instance
 */
export type ServiceFactory<T = any> = (ctx: PluginContext) => T | Promise<T>;

/**
 * Service Registration Options
 */
export interface ServiceRegistration {
    name: string;
    factory: ServiceFactory;
    lifecycle: ServiceLifecycle;
    dependencies?: string[];
}

/**
 * Plugin Metadata with Enhanced Features
 */
export interface PluginMetadata extends Plugin {
    /** Semantic version (e.g., "1.0.0") */
    version: string;
    
    /** Configuration schema for validation */
    configSchema?: z.ZodSchema;
    
    /** Plugin signature for security verification */
    signature?: string;
    
    /** Plugin health check function */
    healthCheck?(): Promise<PluginHealthStatus>;
    
    /** Startup timeout in milliseconds (default: 30000) */
    startupTimeout?: number;
    
    /** Whether plugin supports hot reload */
    hotReloadable?: boolean;
}

/**
 * Plugin Health Status
 */
export interface PluginHealthStatus {
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
    lastCheck?: Date;
}

/**
 * Plugin Load Result
 */
export interface PluginLoadResult {
    success: boolean;
    plugin?: PluginMetadata;
    error?: Error;
    loadTime?: number;
}

/**
 * Plugin Startup Result
 */
export interface PluginStartupResult {
    success: boolean;
    pluginName: string;
    startTime?: number;
    error?: Error;
    timedOut?: boolean;
}

/**
 * Version Compatibility Result
 */
export interface VersionCompatibility {
    compatible: boolean;
    pluginVersion: string;
    requiredVersion?: string;
    message?: string;
}

/**
 * Enhanced Plugin Loader
 * Provides advanced plugin loading capabilities with validation, security, and lifecycle management
 */
export class PluginLoader {
    private logger: Logger;
    private context?: PluginContext;
    private configValidator: PluginConfigValidator;
    private loadedPlugins: Map<string, PluginMetadata> = new Map();
    private serviceFactories: Map<string, ServiceRegistration> = new Map();
    private serviceInstances: Map<string, any> = new Map();
    private scopedServices: Map<string, Map<string, any>> = new Map();
    private creating: Set<string> = new Set();

    constructor(logger: Logger) {
        this.logger = logger;
        this.configValidator = new PluginConfigValidator(logger);
    }

    /**
     * Set the plugin context for service factories
     */
    setContext(context: PluginContext): void {
        this.context = context;
    }

    /**
     * Get a synchronous service instance if it exists (Sync Helper)
     */
    getServiceInstance<T>(name: string): T | undefined {
        return this.serviceInstances.get(name) as T;
    }

    /**
     * Load a plugin asynchronously with validation
     */
    async loadPlugin(plugin: Plugin): Promise<PluginLoadResult> {
        const startTime = Date.now();
        
        try {
            this.logger.info(`Loading plugin: ${plugin.name}`);
            
            // Convert to PluginMetadata
            const metadata = this.toPluginMetadata(plugin);
            
            // Validate plugin structure
            this.validatePluginStructure(metadata);
            
            // Check version compatibility
            const versionCheck = this.checkVersionCompatibility(metadata);
            if (!versionCheck.compatible) {
                throw new Error(`Version incompatible: ${versionCheck.message}`);
            }
            
            // Validate configuration if schema is provided
            if (metadata.configSchema) {
                this.validatePluginConfig(metadata);
            }
            
            // Verify signature if provided
            if (metadata.signature) {
                await this.verifyPluginSignature(metadata);
            }
            
            // Store loaded plugin
            this.loadedPlugins.set(metadata.name, metadata);
            
            const loadTime = Date.now() - startTime;
            this.logger.info(`Plugin loaded: ${plugin.name} (${loadTime}ms)`);
            
            return {
                success: true,
                plugin: metadata,
                loadTime,
            };
        } catch (error) {
            this.logger.error(`Failed to load plugin: ${plugin.name}`, error as Error);
            return {
                success: false,
                error: error as Error,
                loadTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Register a service with factory function
     */
    registerServiceFactory(registration: ServiceRegistration): void {
        if (this.serviceFactories.has(registration.name)) {
            throw new Error(`Service factory '${registration.name}' already registered`);
        }
        
        this.serviceFactories.set(registration.name, registration);
        this.logger.debug(`Service factory registered: ${registration.name} (${registration.lifecycle})`);
    }

    /**
     * Get or create a service instance based on lifecycle type
     */
    async getService<T>(name: string, scopeId?: string): Promise<T> {
        const registration = this.serviceFactories.get(name);
        
        if (!registration) {
            // Fall back to static service instances
            const instance = this.serviceInstances.get(name);
            if (!instance) {
                throw new Error(`Service '${name}' not found`);
            }
            return instance as T;
        }
        
        switch (registration.lifecycle) {
            case ServiceLifecycle.SINGLETON:
                return await this.getSingletonService<T>(registration);
                
            case ServiceLifecycle.TRANSIENT:
                return await this.createTransientService<T>(registration);
                
            case ServiceLifecycle.SCOPED:
                if (!scopeId) {
                    throw new Error(`Scope ID required for scoped service '${name}'`);
                }
                return await this.getScopedService<T>(registration, scopeId);
                
            default:
                throw new Error(`Unknown service lifecycle: ${registration.lifecycle}`);
        }
    }

    /**
     * Register a static service instance (legacy support)
     */
    registerService(name: string, service: any): void {
        if (this.serviceInstances.has(name)) {
            throw new Error(`Service '${name}' already registered`);
        }
        this.serviceInstances.set(name, service);
    }

    /**
     * Replace an existing service instance.
     * Used by optimization plugins to swap kernel internals.
     * @throws Error if service does not exist
     */
    replaceService(name: string, service: any): void {
        if (!this.hasService(name)) {
            throw new Error(`Service '${name}' not found`);
        }
        this.serviceInstances.set(name, service);
    }

    /**
     * Check if a service is registered (either as instance or factory)
     */
    hasService(name: string): boolean {
        return this.serviceInstances.has(name) || this.serviceFactories.has(name);
    }

    /**
     * Detect circular dependencies in service factories
     * Note: This only detects cycles in service dependencies, not plugin dependencies.
     * Plugin dependency cycles are detected in the kernel's resolveDependencies method.
     */
    detectCircularDependencies(): string[] {
        const cycles: string[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();
        
        const visit = (serviceName: string, path: string[] = []) => {
            if (visiting.has(serviceName)) {
                const cycle = [...path, serviceName].join(' -> ');
                cycles.push(cycle);
                return;
            }
            
            if (visited.has(serviceName)) {
                return;
            }
            
            visiting.add(serviceName);
            
            const registration = this.serviceFactories.get(serviceName);
            if (registration?.dependencies) {
                for (const dep of registration.dependencies) {
                    visit(dep, [...path, serviceName]);
                }
            }
            
            visiting.delete(serviceName);
            visited.add(serviceName);
        };
        
        for (const serviceName of this.serviceFactories.keys()) {
            visit(serviceName);
        }
        
        return cycles;
    }

    /**
     * Check plugin health
     */
    async checkPluginHealth(pluginName: string): Promise<PluginHealthStatus> {
        const plugin = this.loadedPlugins.get(pluginName);
        
        if (!plugin) {
            return {
                healthy: false,
                message: 'Plugin not found',
                lastCheck: new Date(),
            };
        }
        
        if (!plugin.healthCheck) {
            return {
                healthy: true,
                message: 'No health check defined',
                lastCheck: new Date(),
            };
        }
        
        try {
            const status = await plugin.healthCheck();
            return {
                ...status,
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                healthy: false,
                message: `Health check failed: ${(error as Error).message}`,
                lastCheck: new Date(),
            };
        }
    }

    /**
     * Clear scoped services for a scope
     */
    clearScope(scopeId: string): void {
        this.scopedServices.delete(scopeId);
        this.logger.debug(`Cleared scope: ${scopeId}`);
    }

    /**
     * Get all loaded plugins
     */
    getLoadedPlugins(): Map<string, PluginMetadata> {
        return new Map(this.loadedPlugins);
    }

    // Private helper methods

    private toPluginMetadata(plugin: Plugin): PluginMetadata {
        // Fix: Do not use object spread {...plugin} as it destroys the prototype chain for Class-based plugins.
        // Instead, cast the original object and inject default values if missing.
        const metadata = plugin as PluginMetadata;
        
        if (!metadata.version) {
            metadata.version = '0.0.0';
        }
        
        return metadata;
    }

    private validatePluginStructure(plugin: PluginMetadata): void {
        if (!plugin.name) {
            throw new Error('Plugin name is required');
        }
        
        if (!plugin.init) {
            throw new Error('Plugin init function is required');
        }
        
        if (!this.isValidSemanticVersion(plugin.version)) {
            throw new Error(`Invalid semantic version: ${plugin.version}`);
        }
    }

    private checkVersionCompatibility(plugin: PluginMetadata): VersionCompatibility {
        // Basic semantic version compatibility check
        // In a real implementation, this would check against kernel version
        const version = plugin.version;
        
        if (!this.isValidSemanticVersion(version)) {
            return {
                compatible: false,
                pluginVersion: version,
                message: 'Invalid semantic version format',
            };
        }
        
        return {
            compatible: true,
            pluginVersion: version,
        };
    }

    private isValidSemanticVersion(version: string): boolean {
        const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
        return semverRegex.test(version);
    }

    private validatePluginConfig(plugin: PluginMetadata, config?: any): void {
        if (!plugin.configSchema) {
            return;
        }

        if (config === undefined) {
             // In loadPlugin, we often don't have the config yet.
             // We skip validation here or valid against empty object if schema allows?
             // For now, let's keep the logging behavior but note it's delegating
             this.logger.debug(`Plugin ${plugin.name} has configuration schema (config validation postponed)`);
             return;
        }

        this.configValidator.validatePluginConfig(plugin, config);
    }

    private async verifyPluginSignature(plugin: PluginMetadata): Promise<void> {
        if (!plugin.signature) {
            return;
        }
        
        // Plugin signature verification is now implemented in PluginSignatureVerifier
        // This is a placeholder that logs the verification would happen
        // The actual verification should be done by the caller with proper security config
        this.logger.debug(`Plugin ${plugin.name} has signature (use PluginSignatureVerifier for verification)`);
    }

    private async getSingletonService<T>(registration: ServiceRegistration): Promise<T> {
        let instance = this.serviceInstances.get(registration.name);
        
        if (!instance) {
            // Create instance (would need context)
            instance = await this.createServiceInstance(registration);
            this.serviceInstances.set(registration.name, instance);
            this.logger.debug(`Singleton service created: ${registration.name}`);
        }
        
        return instance as T;
    }

    private async createTransientService<T>(registration: ServiceRegistration): Promise<T> {
        const instance = await this.createServiceInstance(registration);
        this.logger.debug(`Transient service created: ${registration.name}`);
        return instance as T;
    }

    private async getScopedService<T>(registration: ServiceRegistration, scopeId: string): Promise<T> {
        if (!this.scopedServices.has(scopeId)) {
            this.scopedServices.set(scopeId, new Map());
        }
        
        const scope = this.scopedServices.get(scopeId)!;
        let instance = scope.get(registration.name);
        
        if (!instance) {
            instance = await this.createServiceInstance(registration);
            scope.set(registration.name, instance);
            this.logger.debug(`Scoped service created: ${registration.name} (scope: ${scopeId})`);
        }
        
        return instance as T;
    }

    private async createServiceInstance(registration: ServiceRegistration): Promise<any> {
        if (!this.context) {
            throw new Error(`[PluginLoader] Context not set - cannot create service '${registration.name}'`);
        }

        if (this.creating.has(registration.name)) {
            throw new Error(`Circular dependency detected: ${Array.from(this.creating).join(' -> ')} -> ${registration.name}`);
        }

        this.creating.add(registration.name);
        try {
            return await registration.factory(this.context);
        } finally {
            this.creating.delete(registration.name);
        }
    }

    /**
     * Unregister a service (used during plugin unload)
     */
    unregisterService(name: string): void {
        this.serviceFactories.delete(name);
        this.serviceInstances.delete(name);

        // Remove from all scoped services
        for (const scope of this.scopedServices.values()) {
            scope.delete(name);
        }

        this.logger.debug(`Service unregistered: ${name}`);
    }
}

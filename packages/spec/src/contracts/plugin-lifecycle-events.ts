// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IPluginLifecycleEvents - Typed Plugin Lifecycle Events
 * 
 * Type-safe event definitions for plugin and kernel lifecycle.
 * Provides strong typing for event emitters and listeners.
 * 
 * This replaces the generic Map<string, any[]> approach with typed events.
 */

/**
 * Plugin lifecycle event types and their payloads
 */
export interface IPluginLifecycleEvents {
    /**
     * Emitted when kernel is ready (all plugins initialized)
     * Payload: []
     */
    'kernel:ready': [];

    /**
     * Emitted AFTER every `kernel:ready` handler has completed, but BEFORE
     * `kernel:listening` (so before any HTTP socket opens).
     *
     * This is the "all synchronous bootstrap has settled" anchor. Because
     * `kernel:ready` handlers run sequentially in plugin-registration order,
     * a handler cannot rely on data produced by a plugin that starts later
     * (e.g. the security bootstrap seeds `sys_position`, the app plugin's
     * seed loader inserts records) — reconcile/backfill work that consumes
     * that data would race the very rows it needs. Do such work here instead:
     * every producer's `kernel:ready` handler has finished by the time this
     * fires. HTTP `listen()` is deliberately deferred one more phase to
     * `kernel:listening` so late route registration still lands.
     *
     * CAVEAT: this does NOT guarantee app *seed* data has settled. The app
     * plugin's inline seed only blocks the kernel for `OS_INLINE_SEED_BUDGET_MS`
     * (default 8s); a bundle that exceeds that budget continues seeding in the
     * background and can outlast `kernel:bootstrapped` and even `kernel:listening`
     * (#2996). Subscribe `app:seeded` for the true per-app seed-settle point.
     *
     * Payload: []
     */
    'kernel:bootstrapped': [];

    /**
     * Emitted AFTER all `kernel:ready` and `kernel:bootstrapped` handlers
     * have completed.
     *
     * Use this hook for actions that must happen *strictly after* every
     * other plugin has had a chance to register routes / services /
     * middleware during `kernel:ready` — most notably HTTP server
     * `listen()`.
     *
     * Why a separate phase: route registration in Hono (and similar
     * routers) seals the matcher the first time a request is matched.
     * If a server starts listening during `kernel:ready` while sibling
     * plugins are still adding routes in their own `kernel:ready`
     * hooks, an inbound request can build the matcher mid-init and
     * subsequent `app.get(...)` calls throw "matcher is already built".
     * On a fast-fronting platform (e.g. Cloudflare Containers) this
     * race fires on every cold boot.
     *
     * Payload: []
     */
    'kernel:listening': [];

    /**
     * Emitted by the app plugin when an app's inline seed attempt has settled
     * — success, partial (dropped records), or fallback insert. Single-tenant
     * mode only, and only when the app actually has seed datasets.
     *
     * When the inline seed completes within `OS_INLINE_SEED_BUDGET_MS` this
     * fires during plugin start (before `kernel:ready`); when it overruns the
     * budget and finishes in the background it fires AFTER `kernel:ready` /
     * `kernel:bootstrapped` / `kernel:listening` — `overBudget` distinguishes
     * the two. May fire once per registered app bundle.
     *
     * Consumers MUST be idempotent: this is the settle signal for reconcilers
     * that read seeded rows. plugin-auth re-runs the ADR-0093 D6 membership
     * backfill here so users inserted by an over-budget seed (which bypass
     * better-auth's `user.create.after` reconciler) still get bound to the
     * default org without waiting for the next restart (#2996).
     *
     * Payload: [{ appId, overBudget }]
     */
    'app:seeded': [payload: { appId: string; overBudget: boolean }];

    /**
     * Emitted when kernel is shutting down
     * Payload: []
     */
    'kernel:shutdown': [];
    
    /**
     * Emitted before kernel initialization starts
     * Payload: []
     */
    'kernel:before-init': [];
    
    /**
     * Emitted after kernel initialization completes
     * Payload: [duration: number (milliseconds)]
     */
    'kernel:after-init': [duration: number];
    
    /**
     * Emitted when a plugin is registered
     * Payload: [pluginName: string]
     */
    'plugin:registered': [pluginName: string];
    
    /**
     * Emitted before a plugin's init method is called
     * Payload: [pluginName: string]
     */
    'plugin:before-init': [pluginName: string];
    
    /**
     * Emitted when a plugin has been initialized
     * Payload: [pluginName: string]
     */
    'plugin:init': [pluginName: string];
    
    /**
     * Emitted after a plugin's init method completes
     * Payload: [pluginName: string, duration: number (milliseconds)]
     */
    'plugin:after-init': [pluginName: string, duration: number];
    
    /**
     * Emitted before a plugin's start method is called
     * Payload: [pluginName: string]
     */
    'plugin:before-start': [pluginName: string];
    
    /**
     * Emitted when a plugin has started successfully
     * Payload: [pluginName: string, duration: number (milliseconds)]
     */
    'plugin:started': [pluginName: string, duration: number];
    
    /**
     * Emitted after a plugin's start method completes
     * Payload: [pluginName: string, duration: number (milliseconds)]
     */
    'plugin:after-start': [pluginName: string, duration: number];
    
    /**
     * Emitted before a plugin's destroy method is called
     * Payload: [pluginName: string]
     */
    'plugin:before-destroy': [pluginName: string];
    
    /**
     * Emitted when a plugin has been destroyed
     * Payload: [pluginName: string]
     */
    'plugin:destroyed': [pluginName: string];
    
    /**
     * Emitted after a plugin's destroy method completes
     * Payload: [pluginName: string, duration: number (milliseconds)]
     */
    'plugin:after-destroy': [pluginName: string, duration: number];
    
    /**
     * Emitted when a plugin encounters an error
     * Payload: [pluginName: string, error: Error, phase: 'init' | 'start' | 'destroy']
     */
    'plugin:error': [pluginName: string, error: Error, phase: 'init' | 'start' | 'destroy'];
    
    /**
     * Emitted when a service is registered
     * Payload: [serviceName: string]
     */
    'service:registered': [serviceName: string];
    
    /**
     * Emitted when a service is unregistered
     * Payload: [serviceName: string]
     */
    'service:unregistered': [serviceName: string];
    
    /**
     * Emitted when a hook is registered
     * Payload: [hookName: string, handlerCount: number]
     */
    'hook:registered': [hookName: string, handlerCount: number];
    
    /**
     * Emitted when a hook is triggered
     * Payload: [hookName: string, args: any[]]
     */
    'hook:triggered': [hookName: string, args: any[]];
}

/**
 * Type-safe event emitter interface
 * Provides compile-time type checking for event names and payloads
 */
export interface ITypedEventEmitter<Events extends Record<string, any[]>> {
    /**
     * Register an event listener
     * @param event - Event name (type-checked)
     * @param handler - Event handler (type-checked against event payload)
     */
    on<K extends keyof Events>(
        event: K,
        handler: (...args: Events[K]) => void | Promise<void>
    ): void;
    
    /**
     * Unregister an event listener
     * @param event - Event name (type-checked)
     * @param handler - Event handler to remove
     */
    off<K extends keyof Events>(
        event: K,
        handler: (...args: Events[K]) => void | Promise<void>
    ): void;
    
    /**
     * Emit an event with type-checked payload
     * @param event - Event name (type-checked)
     * @param args - Event payload (type-checked)
     */
    emit<K extends keyof Events>(
        event: K,
        ...args: Events[K]
    ): Promise<void>;
    
    /**
     * Register a one-time event listener
     * @param event - Event name (type-checked)
     * @param handler - Event handler (type-checked against event payload)
     */
    once?<K extends keyof Events>(
        event: K,
        handler: (...args: Events[K]) => void | Promise<void>
    ): void;
    
    /**
     * Get the number of listeners for an event
     * @param event - Event name
     * @returns Number of registered listeners
     */
    listenerCount?<K extends keyof Events>(event: K): number;
    
    /**
     * Remove all listeners for an event (or all events if not specified)
     * @param event - Optional event name
     */
    removeAllListeners?<K extends keyof Events>(event?: K): void;
}

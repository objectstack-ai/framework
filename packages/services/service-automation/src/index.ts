// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Core engine
export { AutomationEngine, DEFAULT_MAX_EXECUTION_LOG_SIZE } from './engine.js';
export type {
    AutomationEngineOptions,
    NodeExecutor,
    NodeExecutionResult,
    FlowTrigger,
    FlowTriggerBinding,
    ConnectorActionHandler,
    ConnectorActionContext,
    RegisteredConnector,
    ConnectorDescriptor,
    ConnectorActionDescriptor,
    SuspendedRun,
    SuspendedRunStore,
    StepLogEntry,
} from './engine.js';

// Durable suspended-run persistence (ADR-0019). The in-memory store is the
// default; the ObjectQL-backed store persists pauses across process restarts.
export {
    InMemorySuspendedRunStore,
    ObjectStoreSuspendedRunStore,
} from './suspended-run-store.js';
export type { SuspendedRunStoreEngine } from './suspended-run-store.js';

// The sys_automation_run object backing the durable store — registered by
// AutomationServicePlugin and exported for hosts wiring a custom store.
export { SysAutomationRun } from './sys-automation-run.object.js';

// Kernel plugin — seeds all built-in nodes; this is the only plugin needed for
// a fully-functional automation capability.
export { AutomationServicePlugin } from './plugin.js';
export type { AutomationServicePluginOptions } from './plugin.js';

// Built-in node executors (ADR-0018). These are seeded by AutomationServicePlugin
// and exported for advanced hosts that build a custom engine. They are functions,
// not plugins — the platform's foundational nodes are built in, not installed.
export {
    installBuiltinNodes,
    registerLogicNodes,
    registerCrudNodes,
    registerScreenNodes,
    registerHttpNodes,
    registerConnectorNodes,
} from './builtin/index.js';

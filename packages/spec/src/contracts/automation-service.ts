// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IAutomationService - Automation Service Contract
 *
 * Defines the interface for flow/script execution in ObjectStack.
 * Concrete implementations (Flow Engine, Script Runner, etc.)
 * should implement this interface.
 *
 * Follows Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete automation engine implementations.
 *
 * Aligned with CoreServiceName 'automation' in core-services.zod.ts.
 */

import type { FlowParsed } from '../automation/flow.zod';
import type { ExecutionLog } from '../automation/execution.zod';
import type { ActionDescriptor } from '../automation/node-executor.zod';

/**
 * Context passed to a flow/script execution
 */
export interface AutomationContext {
    /** Record that triggered the automation (if applicable) */
    record?: Record<string, unknown>;
    /**
     * Prior state of the record for update triggers (the "old" row). Lets
     * record-change-triggered flows gate on transitions (e.g.
     * `status == "done" && previous.status != "done"`). Absent for
     * create/delete events.
     */
    previous?: Record<string, unknown>;
    /** Object name the record belongs to */
    object?: string;
    /** Trigger event type (e.g. 'on_create', 'on_update') */
    event?: string;
    /** User who triggered the automation */
    userId?: string;
    /** Additional contextual data */
    params?: Record<string, unknown>;
}

/**
 * Result of an automation execution
 */
export interface AutomationResult {
    /** Whether the automation completed successfully */
    success: boolean;
    /** Output data from the automation */
    output?: unknown;
    /** Error message if execution failed */
    error?: string;
    /** Execution duration in milliseconds */
    durationMs?: number;
    /**
     * Lifecycle status. `'paused'` means the run suspended at a node (e.g.
     * an Approval node awaiting a human decision, ADR-0019) and can be
     * continued later with {@link IAutomationService.resume}. Absent or
     * `'completed'`/`'failed'` ⇒ the run reached a terminal state.
     */
    status?: 'completed' | 'paused' | 'failed';
    /** Run id — set when `status` is `'paused'`, so callers can resume it. */
    runId?: string;
}

/** Signal payload used to resume a paused run (ADR-0019). */
export interface ResumeSignal {
    /**
     * Output to merge into flow variables under the suspended node's id
     * (e.g. `{ decision: 'approved' }` → `<nodeId>.decision`). Downstream
     * edges branch on it exactly as for a normally-executed node.
     */
    output?: Record<string, unknown>;
    /**
     * Optional edge label to select which out-edge of the suspended node to
     * follow (e.g. `'approve'` / `'reject'`). When omitted, traversal falls
     * back to the node's conditional/unconditional edges.
     */
    branchLabel?: string;
}

export interface IAutomationService {
    /**
     * Execute a named flow or script
     * @param flowName - Flow/script identifier (snake_case)
     * @param context - Execution context with trigger data
     * @returns Automation result
     */
    execute(flowName: string, context?: AutomationContext): Promise<AutomationResult>;

    /**
     * List all registered automation flows
     * @returns Array of flow names
     */
    listFlows(): Promise<string[]>;

    /**
     * Register a flow definition
     * @param name - Flow name (snake_case)
     * @param definition - Flow definition object
     */
    registerFlow?(name: string, definition: unknown): void;

    /**
     * Unregister a flow by name
     * @param name - Flow name (snake_case)
     */
    unregisterFlow?(name: string): void;

    /**
     * Get a flow definition by name
     * @param name - Flow name (snake_case)
     * @returns Flow definition or null if not found
     */
    getFlow?(name: string): Promise<FlowParsed | null>;

    /**
     * Enable or disable a flow
     * @param name - Flow name (snake_case)
     * @param enabled - Whether to enable (true) or disable (false)
     */
    toggleFlow?(name: string, enabled: boolean): Promise<void>;

    /**
     * List execution runs for a flow
     * @param flowName - Flow name (snake_case)
     * @param options - Pagination options
     * @returns Array of execution logs
     */
    listRuns?(flowName: string, options?: { limit?: number; cursor?: string }): Promise<ExecutionLog[]>;

    /**
     * Get a single execution run by ID
     * @param runId - Execution run ID
     * @returns Execution log or null if not found
     */
    getRun?(runId: string): Promise<ExecutionLog | null>;

    /**
     * Get the action descriptors published by registered node executors
     * (ADR-0018). Backs flow validation and the designer palette. Plugins
     * that register an executor with a descriptor extend this set, so the
     * automation engine's node/action vocabulary is open and marketplace-
     * extensible rather than a closed enum.
     * @returns Array of registered action descriptors
     */
    getActionDescriptors?(): ActionDescriptor[];

    /**
     * Resume a run that suspended at a pausing node (ADR-0019). The run must
     * have previously returned `{ status: 'paused', runId }` from
     * {@link execute} (or a prior `resume`). Continues traversal from the
     * suspended node's out-edges, applying `signal.output` / `signal.branchLabel`.
     * @param runId - The paused run's id
     * @param signal - Optional output to merge and/or branch label to follow
     * @returns The result of continuing the run (may itself be `'paused'` again)
     */
    resume?(runId: string, signal?: ResumeSignal): Promise<AutomationResult>;

    /**
     * List the currently suspended (paused) runs awaiting a resume — id, the
     * flow, the node they paused at, and any correlation key the pausing node
     * attached. Backs operability (e.g. a "pending approvals" view).
     */
    listSuspendedRuns?(): Array<{ runId: string; flowName: string; nodeId: string; correlation?: string }>;
}

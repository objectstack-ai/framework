// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FlowParsed, FlowNodeParsed, FlowEdgeParsed } from '@objectstack/spec/automation';
import type { ExecutionLog, ActionDescriptor } from '@objectstack/spec/automation';
import type { AutomationContext, AutomationResult, ResumeSignal, IAutomationService } from '@objectstack/spec/contracts';
import type { Logger } from '@objectstack/spec/contracts';
import { FlowSchema, FLOW_STRUCTURAL_NODE_TYPES } from '@objectstack/spec/automation';
import type { Connector } from '@objectstack/spec/integration';
import { ConnectorSchema } from '@objectstack/spec/integration';

// ─── Node Executor Interface (Plugin Extension Point) ───────────────

/**
 * Each node type corresponds to a NodeExecutor.
 * Third-party plugins only need to implement this interface and register
 * it with the engine to extend automation capabilities.
 */
export interface NodeExecutor {
    /** Registry node type (built-in id or plugin-defined) */
    readonly type: string;

    /**
     * Optional ADR-0018 action descriptor. When present, it is published into
     * the engine's action registry and surfaced via {@link AutomationEngine.getActionDescriptors}
     * — feeding flow validation and the designer palette. Plugins SHOULD publish
     * one so their node appears in the palette and validates as a legal flow node.
     */
    readonly descriptor?: ActionDescriptor;

    /**
     * Execute a node
     * @param node - Current node definition
     * @param variables - Flow variable context (read/write)
     * @param context - Trigger context
     * @returns Execution result (may include output data, branch conditions, etc.)
     */
    execute(
        node: FlowNodeParsed,
        variables: Map<string, unknown>,
        context: AutomationContext,
    ): Promise<NodeExecutionResult>;
}

export interface NodeExecutionResult {
    success: boolean;
    output?: Record<string, unknown>;
    error?: string;
    /** Used by decision nodes — returns the selected branch label */
    branchLabel?: string;
    /**
     * ADR-0019 durable pause. When `true`, the node has done its on-entry work
     * (e.g. opened an approval request) and the run should **suspend** here: the
     * engine persists a continuation, stops traversal, and `execute()` returns
     * `{ status: 'paused', runId }`. The run is continued later via
     * {@link AutomationEngine.resume}. Any `output` is written to variables
     * before suspending. The node reads its own run id from the `$runId`
     * flow variable so it can map the run to external state.
     */
    suspend?: boolean;
    /**
     * Optional correlation key surfaced on the suspended-run record (e.g. an
     * approval request id). For observability / lookup; not required to resume.
     */
    correlation?: string;
}

// ─── Trigger Interface (Plugin Extension Point) ─────────────────────

/**
 * Trigger interface. Schedule/Event/API triggers are registered via plugins.
 */
export interface FlowTrigger {
    readonly type: string;
    start(flowName: string, callback: (ctx: AutomationContext) => Promise<void>): void;
    stop(flowName: string): void;
}

// ─── Connector Registry (Plugin Extension Point) ────────────────────

/**
 * Context handed to a connector action handler. Carries the live flow variable
 * map and the trigger context so a handler can read prior-node output, plus a
 * logger. The platform ships the registry + the `connector_action` dispatch
 * node (baseline, ADR-0018 §Addendum); *concrete* connectors — `connector-rest`,
 * `connector-slack`, … — are plugins that register handlers here.
 */
export interface ConnectorActionContext {
    readonly variables: Map<string, unknown>;
    readonly automation: AutomationContext;
    readonly logger: Logger;
}

/**
 * A handler for one connector action. Receives the (already-resolved) input
 * mapped from the flow node and returns the action's output, which the
 * `connector_action` node writes back into flow variables.
 */
export type ConnectorActionHandler = (
    input: Record<string, unknown>,
    ctx: ConnectorActionContext,
) => Promise<Record<string, unknown>>;

/**
 * A connector registered on the engine: its validated {@link Connector}
 * definition plus the handler for each action it declares.
 */
export interface RegisteredConnector {
    readonly def: Connector;
    readonly handlers: Record<string, ConnectorActionHandler>;
}

/**
 * A designer-facing view of one connector action — identity + its JSON-Schema
 * input/output. The runtime handler is intentionally omitted; this is metadata.
 */
export interface ConnectorActionDescriptor {
    readonly key: string;
    readonly label: string;
    readonly description?: string;
    readonly inputSchema?: Record<string, unknown>;
    readonly outputSchema?: Record<string, unknown>;
}

/**
 * A designer-facing descriptor for a registered connector: its identity plus
 * the actions it exposes. Served by `GET /api/v1/automation/connectors` so the
 * flow designer can populate the `connector_action` node's connector → action
 * → input pickers (ADR-0018 §Addendum, ADR-0022). Mirrors `ActionDescriptor`'s
 * role for node types, but for the connector registry.
 */
export interface ConnectorDescriptor {
    readonly name: string;
    readonly label: string;
    readonly type: string;
    readonly description?: string;
    readonly icon?: string;
    readonly actions: ConnectorActionDescriptor[];
}

// ─── Core Automation Engine ─────────────────────────────────────────

/**
 * Internal execution step log entry.
 */
interface StepLogEntry {
    nodeId: string;
    nodeType: string;
    nodeLabel?: string;
    status: 'success' | 'failure' | 'skipped';
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    error?: { code: string; message: string; stack?: string };
}

/**
 * Internal execution log entry — compatible with ExecutionLog from spec.
 */
interface ExecutionLogEntry {
    id: string;
    flowName: string;
    flowVersion?: number;
    status: ExecutionLog['status'];
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    trigger: { type: string; userId?: string; object?: string; recordId?: string };
    steps: StepLogEntry[];
    variables?: Record<string, unknown>;
    output?: unknown;
    error?: string;
}

/**
 * Internal sentinel thrown by {@link AutomationEngine.executeNode} when a node
 * signals `suspend`. It unwinds the synchronous DAG recursion up to
 * `execute()` / `resume()`, which converts it into a persisted continuation
 * rather than a failed run. (Not exported — callers see `status: 'paused'`.)
 *
 * NOTE: suspend is supported on the serial / main execution path. A node that
 * suspends inside a `Promise.all` parallel branch will unwind that branch, but
 * sibling parallel branches already in flight are not cancelled — durable
 * pause across parallel gateways is out of scope for ADR-0019 M1.
 */
class FlowSuspendSignal {
    readonly __flowSuspend = true as const;
    constructor(readonly nodeId: string, readonly correlation?: string) {}
}

function isSuspendSignal(err: unknown): err is FlowSuspendSignal {
    return typeof err === 'object' && err !== null && (err as FlowSuspendSignal).__flowSuspend === true;
}

/**
 * A run paused at a node, awaiting {@link AutomationEngine.resume}. Held
 * in-memory, matching the engine's existing in-memory run model — durable
 * persistence of suspended runs across process restart is a follow-up tracked
 * with run-state persistence generally (ADR-0019 §Consequences).
 */
interface SuspendedRun {
    runId: string;
    flowName: string;
    flowVersion?: number;
    /** The node the run paused at; resume continues from its out-edges. */
    nodeId: string;
    /** Snapshot of the flow variable map at suspend time. */
    variables: Record<string, unknown>;
    steps: StepLogEntry[];
    context: AutomationContext;
    startedAt: string;
    startTime: number;
    correlation?: string;
}

export class AutomationEngine implements IAutomationService {
    private flows = new Map<string, FlowParsed>();
    private flowEnabled = new Map<string, boolean>();
    private flowVersionHistory = new Map<string, Array<{ version: number; definition: FlowParsed; createdAt: string }>>();
    private nodeExecutors = new Map<string, NodeExecutor>();
    private actionDescriptors = new Map<string, ActionDescriptor>();
    private triggers = new Map<string, FlowTrigger>();
    /** Connectors registered by integration plugins, keyed by connector name (ADR-0018 §Addendum). */
    private connectors = new Map<string, RegisteredConnector>();
    private executionLogs: ExecutionLogEntry[] = [];
    private maxLogSize = 1000;
    private logger: Logger;
    private runCounter = 0;
    /** Runs paused at a node, keyed by runId (ADR-0019). In-memory, see {@link SuspendedRun}. */
    private suspendedRuns = new Map<string, SuspendedRun>();

    constructor(logger: Logger) {
        this.logger = logger;
    }

    // ── Plugin Extension API ──────────────────────────────

    /** Register a node executor (called by plugins) */
    registerNodeExecutor(executor: NodeExecutor): void {
        if (this.nodeExecutors.has(executor.type)) {
            this.logger.warn(`Node executor '${executor.type}' replaced`);
        }
        this.nodeExecutors.set(executor.type, executor);

        // Publish the ADR-0018 action descriptor into the registry, so the
        // type validates as a legal flow node and appears in the designer
        // palette. A descriptor's `type` should match the executor's; we key
        // on the descriptor's `type` and warn on mismatch rather than silently
        // diverging.
        if (executor.descriptor) {
            const descriptorType = executor.descriptor.type;
            if (descriptorType !== executor.type) {
                this.logger.warn(
                    `Node executor '${executor.type}' publishes a descriptor for type '${descriptorType}' — registering under both.`,
                );
            }
            this.actionDescriptors.set(descriptorType, executor.descriptor);
        }

        this.logger.info(`Node executor registered: ${executor.type}`);
    }

    /** Unregister a node executor (hot-unplug) */
    unregisterNodeExecutor(type: string): void {
        const executor = this.nodeExecutors.get(type);
        this.nodeExecutors.delete(type);
        // Drop the published descriptor (keyed by descriptor.type, which may
        // differ from the executor type).
        this.actionDescriptors.delete(type);
        if (executor?.descriptor) {
            this.actionDescriptors.delete(executor.descriptor.type);
        }
        this.logger.info(`Node executor unregistered: ${type}`);
    }

    /** Register a trigger (called by plugins) */
    registerTrigger(trigger: FlowTrigger): void {
        this.triggers.set(trigger.type, trigger);
        this.logger.info(`Trigger registered: ${trigger.type}`);
    }

    /** Unregister a trigger (hot-unplug) */
    unregisterTrigger(type: string): void {
        this.triggers.delete(type);
        this.logger.info(`Trigger unregistered: ${type}`);
    }

    /**
     * Register a connector (called by integration plugins, ADR-0018 §Addendum).
     * Validates the definition against {@link ConnectorSchema} and asserts every
     * declared action has a handler, so a half-wired connector fails loudly at
     * registration rather than silently at dispatch. Re-registering the same
     * name replaces (mirrors {@link registerNodeExecutor}).
     */
    registerConnector(def: Connector, handlers: Record<string, ConnectorActionHandler>): void {
        const parsed = ConnectorSchema.parse(def);
        for (const action of parsed.actions ?? []) {
            if (typeof handlers[action.key] !== 'function') {
                throw new Error(
                    `Connector '${parsed.name}': action '${action.key}' is declared but no handler was provided`,
                );
            }
        }
        if (this.connectors.has(parsed.name)) {
            this.logger.warn(`Connector '${parsed.name}' replaced`);
        }
        this.connectors.set(parsed.name, { def: parsed, handlers });
        this.logger.info(
            `Connector registered: ${parsed.name} (${Object.keys(handlers).length} action handlers)`,
        );
    }

    /** Unregister a connector (hot-unplug). */
    unregisterConnector(name: string): void {
        this.connectors.delete(name);
        this.logger.info(`Connector unregistered: ${name}`);
    }

    /**
     * Resolve the handler for a connector action, used by the baseline
     * `connector_action` node. Returns `undefined` when the connector or action
     * is not registered, so the node can fail the step with a clear error.
     */
    resolveConnectorAction(connectorId: string, actionId: string): ConnectorActionHandler | undefined {
        return this.connectors.get(connectorId)?.handlers[actionId];
    }

    /** Get all registered connector names. */
    getRegisteredConnectors(): string[] {
        return [...this.connectors.keys()];
    }

    /**
     * Get a designer-facing descriptor for every registered connector — its
     * identity plus the actions it exposes (input/output JSON Schema). Backs
     * `GET /api/v1/automation/connectors` so the designer can fill the
     * `connector_action` node's connector / action / input pickers (ADR-0022).
     * Handlers are omitted — they are runtime code, not metadata.
     */
    getConnectorDescriptors(): ConnectorDescriptor[] {
        return [...this.connectors.values()].map(({ def }) => ({
            name: def.name,
            label: def.label,
            type: def.type,
            description: def.description,
            icon: def.icon,
            actions: (def.actions ?? []).map((a) => ({
                key: a.key,
                label: a.label,
                description: a.description,
                inputSchema: a.inputSchema,
                outputSchema: a.outputSchema,
            })),
        }));
    }

    /** Get all registered node types */
    getRegisteredNodeTypes(): string[] {
        return [...this.nodeExecutors.keys()];
    }

    /**
     * Get all published action descriptors (ADR-0018). Backs both flow
     * validation and the designer palette (`GET /api/v1/automation/actions`).
     * Only executors that published a descriptor appear here.
     */
    getActionDescriptors(): ActionDescriptor[] {
        return [...this.actionDescriptors.values()];
    }

    /** Get the action descriptor for a single node type, if published. */
    getActionDescriptor(type: string): ActionDescriptor | undefined {
        return this.actionDescriptors.get(type);
    }

    /** Get all registered trigger types */
    getRegisteredTriggerTypes(): string[] {
        return [...this.triggers.keys()];
    }

    // ── IAutomationService Contract Implementation ────────

    registerFlow(name: string, definition: unknown): void {
        const parsed = FlowSchema.parse(definition);

        // DAG cycle detection
        this.detectCycles(parsed);

        // ADR-0018 §M1 — validate node types against the live action registry.
        // The protocol no longer gates `type` with a closed enum; membership is
        // checked here instead. Soft-fail (warn, don't throw): a flow authored
        // against a plugin that is currently disabled should still register, and
        // executeNode() already throws NO_EXECUTOR at run time for unknown types.
        this.validateNodeTypes(name, parsed);

        // Version history management
        const history = this.flowVersionHistory.get(name) ?? [];
        history.push({
            version: parsed.version,
            definition: parsed,
            createdAt: new Date().toISOString(),
        });
        this.flowVersionHistory.set(name, history);

        this.flows.set(name, parsed);
        if (!this.flowEnabled.has(name)) {
            this.flowEnabled.set(name, true);
        }
        this.logger.info(`Flow registered: ${name} (version ${parsed.version})`);
    }

    unregisterFlow(name: string): void {
        this.flows.delete(name);
        this.flowEnabled.delete(name);
        this.flowVersionHistory.delete(name);
        this.logger.info(`Flow unregistered: ${name}`);
    }

    async listFlows(): Promise<string[]> {
        return [...this.flows.keys()];
    }

    async getFlow(name: string): Promise<FlowParsed | null> {
        return this.flows.get(name) ?? null;
    }

    async toggleFlow(name: string, enabled: boolean): Promise<void> {
        if (!this.flows.has(name)) {
            throw new Error(`Flow '${name}' not found`);
        }
        this.flowEnabled.set(name, enabled);
        this.logger.info(`Flow '${name}' ${enabled ? 'enabled' : 'disabled'}`);
    }

    /** Get flow version history */
    getFlowVersionHistory(name: string): Array<{ version: number; definition: FlowParsed; createdAt: string }> {
        return this.flowVersionHistory.get(name) ?? [];
    }

    /** Rollback flow to a specific version */
    rollbackFlow(name: string, version: number): void {
        const history = this.flowVersionHistory.get(name);
        if (!history) {
            throw new Error(`Flow '${name}' has no version history`);
        }
        const entry = history.find(h => h.version === version);
        if (!entry) {
            throw new Error(`Version ${version} not found for flow '${name}'`);
        }
        this.flows.set(name, entry.definition);
        this.logger.info(`Flow '${name}' rolled back to version ${version}`);
    }

    async listRuns(flowName: string, options?: { limit?: number; cursor?: string }): Promise<ExecutionLogEntry[]> {
        const limit = options?.limit ?? 20;
        const logs = this.executionLogs.filter(l => l.flowName === flowName);
        return logs.slice(-limit).reverse();
    }

    async getRun(runId: string): Promise<ExecutionLogEntry | null> {
        return this.executionLogs.find(l => l.id === runId) ?? null;
    }

    async execute(flowName: string, context?: AutomationContext): Promise<AutomationResult> {
        const startTime = Date.now();
        const flow = this.flows.get(flowName);

        if (!flow) {
            return { success: false, error: `Flow '${flowName}' not found` };
        }

        // Check if flow is disabled
        if (this.flowEnabled.get(flowName) === false) {
            return { success: false, error: `Flow '${flowName}' is disabled` };
        }

        // Initialize variable context
        const variables = new Map<string, unknown>();
        if (flow.variables) {
            for (const v of flow.variables) {
                if (v.isInput && context?.params?.[v.name] !== undefined) {
                    variables.set(v.name, context.params[v.name]);
                }
            }
        }
        // Inject trigger record
        if (context?.record) {
            variables.set('$record', context.record);
        }

        const runId = `run_${++this.runCounter}`;
        // Expose the run id to executors (ADR-0019): a pausing node (e.g. Approval)
        // reads `$runId` to map its external state back to this run for resume.
        variables.set('$runId', runId);
        const startedAt = new Date().toISOString();
        const steps: StepLogEntry[] = [];

        try {
            // Find the start node
            const startNode = flow.nodes.find(n => n.type === 'start');
            if (!startNode) {
                return { success: false, error: 'Flow has no start node' };
            }

            // Validate node input schemas before execution
            this.validateNodeInputSchemas(flow, variables);

            // DAG traversal execution
            await this.executeNode(startNode, flow, variables, context ?? {}, steps);

            // Collect output variables
            const output: Record<string, unknown> = {};
            if (flow.variables) {
                for (const v of flow.variables) {
                    if (v.isOutput) {
                        output[v.name] = variables.get(v.name);
                    }
                }
            }

            const durationMs = Date.now() - startTime;

            // Record execution log
            this.recordLog({
                id: runId,
                flowName,
                flowVersion: flow.version,
                status: 'completed',
                startedAt,
                completedAt: new Date().toISOString(),
                durationMs,
                trigger: {
                    type: context?.event ?? 'manual',
                    userId: context?.userId,
                    object: context?.object,
                },
                steps,
                output,
            });

            return {
                success: true,
                output,
                durationMs,
            };
        } catch (err: unknown) {
            // A node asked to suspend the run (ADR-0019 durable pause). Snapshot
            // the live state, record a `paused` log, and return the run id so the
            // caller can later `resume()` it. This is NOT a failure.
            if (isSuspendSignal(err)) {
                const durationMs = Date.now() - startTime;
                this.suspendedRuns.set(runId, {
                    runId,
                    flowName,
                    flowVersion: flow.version,
                    nodeId: err.nodeId,
                    variables: Object.fromEntries(variables),
                    steps,
                    context: context ?? {},
                    startedAt,
                    startTime,
                    correlation: err.correlation,
                });
                this.recordLog({
                    id: runId,
                    flowName,
                    flowVersion: flow.version,
                    status: 'paused',
                    startedAt,
                    durationMs,
                    trigger: {
                        type: context?.event ?? 'manual',
                        userId: context?.userId,
                        object: context?.object,
                    },
                    steps,
                });
                return {
                    success: true,
                    status: 'paused',
                    runId,
                    durationMs,
                };
            }

            const errorMessage = err instanceof Error ? err.message : String(err);

            // Record failed execution log
            const durationMs = Date.now() - startTime;
            this.recordLog({
                id: runId,
                flowName,
                flowVersion: flow.version,
                status: 'failed',
                startedAt,
                completedAt: new Date().toISOString(),
                durationMs,
                trigger: {
                    type: context?.event ?? 'manual',
                    userId: context?.userId,
                    object: context?.object,
                },
                steps,
                error: errorMessage,
            });

            // Error handling strategy
            if (flow.errorHandling?.strategy === 'retry') {
                return this.retryExecution(flowName, context, startTime, flow.errorHandling);
            }
            return {
                success: false,
                error: errorMessage,
                durationMs,
            };
        }
    }

    /**
     * Resume a run suspended at a node (ADR-0019 durable pause). Restores the
     * snapshotted variables, merges `signal.output` under the suspended node's
     * id, and continues traversal from that node's out-edges — optionally
     * restricted to the edge labelled `signal.branchLabel` (e.g. the approval
     * decision). The continuation may itself suspend again, in which case this
     * returns `{ status: 'paused', runId }` afresh.
     */
    async resume(runId: string, signal?: ResumeSignal): Promise<AutomationResult> {
        const run = this.suspendedRuns.get(runId);
        if (!run) {
            return { success: false, error: `No suspended run '${runId}'` };
        }
        const flow = this.flows.get(run.flowName);
        if (!flow) {
            return { success: false, error: `Flow '${run.flowName}' not found for run '${runId}'` };
        }
        const node = flow.nodes.find(n => n.id === run.nodeId);
        if (!node) {
            return { success: false, error: `Suspended node '${run.nodeId}' no longer exists in flow '${run.flowName}'` };
        }
        // Consume the suspension — a run resumes exactly once per pause.
        this.suspendedRuns.delete(runId);

        // Restore variable context and apply the resume signal's output as if it
        // were the node's output, so downstream edges branch on it.
        const variables = new Map<string, unknown>(Object.entries(run.variables));
        if (signal?.output) {
            for (const [key, value] of Object.entries(signal.output)) {
                variables.set(`${run.nodeId}.${key}`, value);
            }
        }

        const steps = run.steps;
        const context = run.context;

        try {
            await this.traverseNext(node, flow, variables, context, steps, signal?.branchLabel);

            // Collect output variables
            const output: Record<string, unknown> = {};
            if (flow.variables) {
                for (const v of flow.variables) {
                    if (v.isOutput) output[v.name] = variables.get(v.name);
                }
            }
            const durationMs = Date.now() - run.startTime;
            this.recordLog({
                id: runId,
                flowName: run.flowName,
                flowVersion: run.flowVersion,
                status: 'completed',
                startedAt: run.startedAt,
                completedAt: new Date().toISOString(),
                durationMs,
                trigger: {
                    type: context.event ?? 'manual',
                    userId: context.userId,
                    object: context.object,
                },
                steps,
                output,
            });
            return { success: true, output, durationMs };
        } catch (err: unknown) {
            // Re-suspended at a downstream node: persist a fresh continuation.
            if (isSuspendSignal(err)) {
                const durationMs = Date.now() - run.startTime;
                this.suspendedRuns.set(runId, {
                    ...run,
                    nodeId: err.nodeId,
                    variables: Object.fromEntries(variables),
                    steps,
                    correlation: err.correlation,
                });
                this.recordLog({
                    id: runId,
                    flowName: run.flowName,
                    flowVersion: run.flowVersion,
                    status: 'paused',
                    startedAt: run.startedAt,
                    durationMs,
                    trigger: {
                        type: context.event ?? 'manual',
                        userId: context.userId,
                        object: context.object,
                    },
                    steps,
                });
                return { success: true, status: 'paused', runId, durationMs };
            }

            const errorMessage = err instanceof Error ? err.message : String(err);
            const durationMs = Date.now() - run.startTime;
            this.recordLog({
                id: runId,
                flowName: run.flowName,
                flowVersion: run.flowVersion,
                status: 'failed',
                startedAt: run.startedAt,
                completedAt: new Date().toISOString(),
                durationMs,
                trigger: {
                    type: context.event ?? 'manual',
                    userId: context.userId,
                    object: context.object,
                },
                steps,
                error: errorMessage,
            });
            return { success: false, error: errorMessage, durationMs };
        }
    }

    /**
     * List the runs currently suspended awaiting {@link resume} (ADR-0019).
     * Backs operability surfaces such as a "pending approvals" view.
     */
    listSuspendedRuns(): Array<{ runId: string; flowName: string; nodeId: string; correlation?: string }> {
        return [...this.suspendedRuns.values()].map(r => ({
            runId: r.runId,
            flowName: r.flowName,
            nodeId: r.nodeId,
            correlation: r.correlation,
        }));
    }

    // ── DAG Traversal Core ──────────────────────────────────

    private recordLog(entry: ExecutionLogEntry): void {
        this.executionLogs.push(entry);
        // Evict oldest logs when exceeding max size
        if (this.executionLogs.length > this.maxLogSize) {
            this.executionLogs.splice(0, this.executionLogs.length - this.maxLogSize);
        }
    }

    /**
     * Validate each node's `type` against the live action registry (ADR-0018).
     * A type is known if it is structural (start/end), has a registered
     * executor, or has a published action descriptor. Unknown types are
     * warned about (not rejected) so flows authored against a temporarily
     * absent plugin still register; the runtime surfaces a hard NO_EXECUTOR
     * error if such a node is actually executed.
     */
    private validateNodeTypes(flowName: string, flow: FlowParsed): void {
        const known = new Set<string>([
            ...FLOW_STRUCTURAL_NODE_TYPES,
            ...this.nodeExecutors.keys(),
            ...this.actionDescriptors.keys(),
        ]);
        const unknown = [...new Set(
            flow.nodes.map(n => n.type).filter(t => !known.has(t)),
        )];
        if (unknown.length > 0) {
            this.logger.warn(
                `Flow '${flowName}' references node type(s) with no registered executor or descriptor: ` +
                `${unknown.join(', ')}. They will fail at execution time unless a plugin registers them. ` +
                `Registered types: ${[...known].join(', ') || '(none)'}`,
            );
        }
    }

    /**
     * Detect cycles in the flow graph (DAG validation).
     * Uses DFS with coloring (white/gray/black) to detect back edges.
     * Throws an error with cycle details if a cycle is found.
     */
    private detectCycles(flow: FlowParsed): void {
        const WHITE = 0, GRAY = 1, BLACK = 2;
        const color = new Map<string, number>();
        const parent = new Map<string, string>();

        // Build adjacency list from edges
        const adj = new Map<string, string[]>();
        for (const node of flow.nodes) {
            color.set(node.id, WHITE);
            adj.set(node.id, []);
        }
        for (const edge of flow.edges) {
            const targets = adj.get(edge.source);
            if (targets) targets.push(edge.target);
        }

        const dfs = (nodeId: string): string[] | null => {
            color.set(nodeId, GRAY);
            for (const neighbor of adj.get(nodeId) ?? []) {
                if (color.get(neighbor) === GRAY) {
                    // Back edge found — reconstruct cycle
                    const cycle = [neighbor, nodeId];
                    let cur = nodeId;
                    while (cur !== neighbor) {
                        cur = parent.get(cur)!;
                        if (cur) cycle.push(cur);
                        else break;
                    }
                    return cycle.reverse();
                }
                if (color.get(neighbor) === WHITE) {
                    parent.set(neighbor, nodeId);
                    const result = dfs(neighbor);
                    if (result) return result;
                }
            }
            color.set(nodeId, BLACK);
            return null;
        };

        for (const node of flow.nodes) {
            if (color.get(node.id) === WHITE) {
                const cycle = dfs(node.id);
                if (cycle) {
                    throw new Error(`Flow contains a cycle: ${cycle.join(' → ')}. Only DAG flows are allowed.`);
                }
            }
        }
    }

    /**
     * Get the runtime type name of a value for schema validation.
     */
    private getValueType(value: unknown): string {
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object' && value !== null) return 'object';
        return typeof value;
    }

    /**
     * Validate node input schemas before execution.
     * Checks that node config matches declared inputSchema if present.
     */
    private validateNodeInputSchemas(flow: FlowParsed, _variables: Map<string, unknown>): void {
        for (const node of flow.nodes) {
            if (node.inputSchema && node.config) {
                for (const [paramName, paramDef] of Object.entries(node.inputSchema)) {
                    if (paramDef.required && !(paramName in (node.config as Record<string, unknown>))) {
                        throw new Error(
                            `Node '${node.id}' missing required input parameter '${paramName}'`,
                        );
                    }
                    const value = (node.config as Record<string, unknown>)[paramName];
                    if (value !== undefined) {
                        const actualType = this.getValueType(value);
                        if (actualType !== paramDef.type) {
                            throw new Error(
                                `Node '${node.id}' parameter '${paramName}' expected type '${paramDef.type}' but got '${actualType}'`,
                            );
                        }
                    }
                }
            }
        }
    }

    /**
     * Execute a node with timeout support, fault edge handling, and step logging.
     */
    private async executeNode(
        node: FlowNodeParsed,
        flow: FlowParsed,
        variables: Map<string, unknown>,
        context: AutomationContext,
        steps: StepLogEntry[],
    ): Promise<void> {
        if (node.type === 'end') return;

        const stepStart = Date.now();
        const stepStartedAt = new Date().toISOString();

        // Find executor
        const executor = this.nodeExecutors.get(node.type);
        if (!executor) {
            // start node without executor is fine — just skip
            if (node.type !== 'start') {
                steps.push({
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'failure',
                    startedAt: stepStartedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - stepStart,
                    error: { code: 'NO_EXECUTOR', message: `No executor registered for node type '${node.type}'` },
                });
                throw new Error(`No executor registered for node type '${node.type}'`);
            }
            // Log start node step
            steps.push({
                nodeId: node.id,
                nodeType: node.type,
                status: 'success',
                startedAt: stepStartedAt,
                completedAt: new Date().toISOString(),
                durationMs: Date.now() - stepStart,
            });
        } else {
            // Execute node with optional timeout
            let result: NodeExecutionResult;
            try {
                if (node.timeoutMs && node.timeoutMs > 0) {
                    result = await this.executeWithTimeout(
                        executor.execute(node, variables, context),
                        node.timeoutMs,
                        node.id,
                    );
                } else {
                    result = await executor.execute(node, variables, context);
                }
            } catch (execErr: unknown) {
                const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
                steps.push({
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'failure',
                    startedAt: stepStartedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - stepStart,
                    error: { code: 'EXECUTION_ERROR', message: errMsg },
                });

                // Check for fault edges
                const faultEdge = flow.edges.find(e => e.source === node.id && e.type === 'fault');
                if (faultEdge) {
                    variables.set('$error', { nodeId: node.id, message: errMsg });
                    const faultTarget = flow.nodes.find(n => n.id === faultEdge.target);
                    if (faultTarget) {
                        await this.executeNode(faultTarget, flow, variables, context, steps);
                        return;
                    }
                }
                throw execErr;
            }

            if (!result.success) {
                const errMsg = result.error ?? 'Unknown error';
                steps.push({
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'failure',
                    startedAt: stepStartedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - stepStart,
                    error: { code: 'NODE_FAILURE', message: errMsg },
                });

                // Write error output to variable context for downstream nodes
                variables.set('$error', { nodeId: node.id, message: errMsg, output: result.output });

                // Check for fault edges
                const faultEdge = flow.edges.find(e => e.source === node.id && e.type === 'fault');
                if (faultEdge) {
                    const faultTarget = flow.nodes.find(n => n.id === faultEdge.target);
                    if (faultTarget) {
                        await this.executeNode(faultTarget, flow, variables, context, steps);
                        return;
                    }
                }
                throw new Error(`Node '${node.id}' failed: ${errMsg}`);
            }

            // Log successful step
            steps.push({
                nodeId: node.id,
                nodeType: node.type,
                status: 'success',
                startedAt: stepStartedAt,
                completedAt: new Date().toISOString(),
                durationMs: Date.now() - stepStart,
            });

            // Write back output variables
            if (result.output) {
                for (const [key, value] of Object.entries(result.output)) {
                    variables.set(`${node.id}.${key}`, value);
                }
            }

            // ADR-0019 durable pause: the node did its on-entry work and asked to
            // suspend here. Output is already written above; unwind the recursion
            // up to execute()/resume(), which persists a continuation. Traversal
            // of this node's out-edges happens on resume, not now.
            if (result.suspend) {
                throw new FlowSuspendSignal(node.id, result.correlation);
            }
        }

        // Continue to the node's successors.
        await this.traverseNext(node, flow, variables, context, steps);
    }

    /**
     * Traverse a node's out-edges and execute its successors. Split out of
     * {@link executeNode} so {@link resume} can re-enter traversal from a
     * suspended node without re-running the node body.
     *
     * @param branchLabel - When set (e.g. from a resume signal), restrict
     *   traversal to out-edges whose `label` matches — this is how an Approval
     *   node's `approve`/`reject` decision selects its downstream branch. When
     *   no edge carries the label, traversal falls back to the normal edge set.
     */
    private async traverseNext(
        node: FlowNodeParsed,
        flow: FlowParsed,
        variables: Map<string, unknown>,
        context: AutomationContext,
        steps: StepLogEntry[],
        branchLabel?: string,
    ): Promise<void> {
        // Find next nodes — separate conditional and unconditional edges
        let outEdges = flow.edges.filter(
            e => e.source === node.id && e.type !== 'fault',
        );

        // Branch selection (resume): prefer edges tagged with the decision label.
        if (branchLabel) {
            const labeled = outEdges.filter(e => e.label === branchLabel);
            if (labeled.length > 0) outEdges = labeled;
        }

        const conditionalEdges: FlowEdgeParsed[] = [];
        const unconditionalEdges: FlowEdgeParsed[] = [];
        for (const edge of outEdges) {
            if (edge.condition) {
                conditionalEdges.push(edge);
            } else {
                unconditionalEdges.push(edge);
            }
        }

        // Conditional edges: evaluate sequentially (mutually exclusive)
        for (const edge of conditionalEdges) {
            if (this.evaluateCondition(edge.condition!, variables)) {
                const nextNode = flow.nodes.find(n => n.id === edge.target);
                if (nextNode) {
                    await this.executeNode(nextNode, flow, variables, context, steps);
                }
            }
        }

        // Unconditional edges: execute in parallel (Promise.all)
        if (unconditionalEdges.length > 0) {
            const parallelTasks = unconditionalEdges
                .map(edge => flow.nodes.find(n => n.id === edge.target))
                .filter((n): n is FlowNodeParsed => n != null)
                .map(nextNode => this.executeNode(nextNode, flow, variables, context, steps));

            await Promise.all(parallelTasks);
        }
    }

    /**
     * Execute a promise with timeout using Promise.race.
     */
    private executeWithTimeout(
        promise: Promise<NodeExecutionResult>,
        timeoutMs: number,
        nodeId: string,
    ): Promise<NodeExecutionResult> {
        return Promise.race([
            promise,
            new Promise<NodeExecutionResult>((_, reject) =>
                setTimeout(() => reject(new Error(`Node '${nodeId}' timed out after ${timeoutMs}ms`)), timeoutMs),
            ),
        ]);
    }

    /**
     * Safe expression evaluator.
     * Uses simple operator-based parsing without `new Function`.
     * Supports: comparisons (>, <, >=, <=, ==, !=, ===, !==),
     * boolean literals (true, false), and basic arithmetic.
     */
    evaluateCondition(expression: string | { dialect?: string; source?: string; ast?: unknown }, variables: Map<string, unknown>): boolean {
        // M9.5+ wiring: route Expression envelopes through @objectstack/formula
        // ExpressionEngine. CEL is the default; legacy `{var}` template syntax
        // is preserved as a fallback for back-compat.
        const isEnvelope = typeof expression === 'object' && expression != null && 'dialect' in expression;
        const dialect = isEnvelope ? (expression as { dialect?: string }).dialect : undefined;
        const exprStr = typeof expression === 'string' ? expression : ((expression as { source?: string })?.source ?? '');

        if (isEnvelope && dialect && dialect !== 'cel' && dialect !== 'flow' && dialect !== 'template') {
            // Other dialects (cron, js) are not boolean predicates here.
            return false;
        }

        // CEL path — bind `vars` scope for `{step.result}` style references via
        // the equivalent `vars.step.result` CEL identifier path.
        if (dialect === 'cel' || (isEnvelope && !dialect)) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { ExpressionEngine } = require('@objectstack/formula') as typeof import('@objectstack/formula');
                const vars: Record<string, unknown> = {};
                for (const [key, value] of variables) {
                    // Convert "step.result" keys into nested object paths.
                    const segs = key.split('.');
                    let cursor = vars;
                    for (let i = 0; i < segs.length - 1; i++) {
                        if (typeof cursor[segs[i]] !== 'object' || cursor[segs[i]] === null) {
                            cursor[segs[i]] = {};
                        }
                        cursor = cursor[segs[i]] as Record<string, unknown>;
                    }
                    cursor[segs[segs.length - 1]] = value;
                }
                const result = ExpressionEngine.evaluate(
                    { dialect: 'cel', source: exprStr },
                    { extra: { vars }, record: vars },
                );
                if (!result.ok) return false;
                return Boolean(result.value);
            } catch {
                return false;
            }
        }

        // Legacy template path: {varName} → value, then primitive compare.
        let resolved = exprStr;
        for (const [key, value] of variables) {
            resolved = resolved.split(`{${key}}`).join(String(value));
        }
        resolved = resolved.trim();

        try {
            // Boolean literals
            if (resolved === 'true') return true;
            if (resolved === 'false') return false;

            // Comparison operators (ordered by length to match longer operators first)
            const operators = ['===', '!==', '>=', '<=', '!=', '==', '>', '<'] as const;
            for (const op of operators) {
                const idx = resolved.indexOf(op);
                if (idx !== -1) {
                    const left = resolved.slice(0, idx).trim();
                    const right = resolved.slice(idx + op.length).trim();
                    return this.compareValues(left, op, right);
                }
            }

            // Numeric truthy check
            const numVal = Number(resolved);
            if (!isNaN(numVal)) return numVal !== 0;

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Compare two string-represented values with an operator.
     */
    private compareValues(left: string, op: string, right: string): boolean {
        const lNum = Number(left);
        const rNum = Number(right);
        const bothNumeric = !isNaN(lNum) && !isNaN(rNum) && left !== '' && right !== '';

        if (bothNumeric) {
            switch (op) {
                case '>': return lNum > rNum;
                case '<': return lNum < rNum;
                case '>=': return lNum >= rNum;
                case '<=': return lNum <= rNum;
                case '==': case '===': return lNum === rNum;
                case '!=': case '!==': return lNum !== rNum;
                default: return false;
            }
        }
        // String comparison
        switch (op) {
            case '==': case '===': return left === right;
            case '!=': case '!==': return left !== right;
            case '>': return left > right;
            case '<': return left < right;
            case '>=': return left >= right;
            case '<=': return left <= right;
            default: return false;
        }
    }

    /**
     * Retry execution with exponential backoff, jitter, and recursive protection.
     * Uses an iterative loop with an internal retry flag to prevent recursive call stacking.
     */
    private async retryExecution(
        flowName: string,
        context: AutomationContext | undefined,
        startTime: number,
        errorHandling: {
            maxRetries?: number;
            retryDelayMs?: number;
            backoffMultiplier?: number;
            maxRetryDelayMs?: number;
            jitter?: boolean;
        },
    ): Promise<AutomationResult> {
        const maxRetries = errorHandling.maxRetries ?? 3;
        const baseDelay = errorHandling.retryDelayMs ?? 1000;
        const multiplier = errorHandling.backoffMultiplier ?? 1;
        const maxDelay = errorHandling.maxRetryDelayMs ?? 30000;
        const useJitter = errorHandling.jitter ?? false;

        let lastError = 'Max retries exceeded';
        for (let i = 0; i < maxRetries; i++) {
            // Calculate delay with exponential backoff
            let delay = Math.min(baseDelay * Math.pow(multiplier, i), maxDelay);
            if (useJitter) {
                delay = delay * (0.5 + Math.random() * 0.5);
            }
            await new Promise(r => setTimeout(r, delay));

            // Execute directly without recursion into retryExecution again
            const result = await this.executeWithoutRetry(flowName, context);
            if (result.success) return result;
            lastError = result.error ?? 'Unknown error';
        }
        return { success: false, error: lastError, durationMs: Date.now() - startTime };
    }

    /**
     * Execute a flow without triggering retry logic (used by retryExecution to prevent recursion).
     */
    private async executeWithoutRetry(
        flowName: string,
        context?: AutomationContext,
    ): Promise<AutomationResult> {
        const startTime = Date.now();
        const flow = this.flows.get(flowName);

        if (!flow) {
            return { success: false, error: `Flow '${flowName}' not found` };
        }
        if (this.flowEnabled.get(flowName) === false) {
            return { success: false, error: `Flow '${flowName}' is disabled` };
        }

        const variables = new Map<string, unknown>();
        if (flow.variables) {
            for (const v of flow.variables) {
                if (v.isInput && context?.params?.[v.name] !== undefined) {
                    variables.set(v.name, context.params[v.name]);
                }
            }
        }
        if (context?.record) {
            variables.set('$record', context.record);
        }

        const runId = `run_${++this.runCounter}`;
        const startedAt = new Date().toISOString();
        const steps: StepLogEntry[] = [];

        try {
            const startNode = flow.nodes.find(n => n.type === 'start');
            if (!startNode) {
                return { success: false, error: 'Flow has no start node' };
            }

            await this.executeNode(startNode, flow, variables, context ?? {}, steps);

            const output: Record<string, unknown> = {};
            if (flow.variables) {
                for (const v of flow.variables) {
                    if (v.isOutput) {
                        output[v.name] = variables.get(v.name);
                    }
                }
            }

            const durationMs = Date.now() - startTime;
            this.recordLog({
                id: runId,
                flowName,
                flowVersion: flow.version,
                status: 'completed',
                startedAt,
                completedAt: new Date().toISOString(),
                durationMs,
                trigger: {
                    type: context?.event ?? 'manual',
                    userId: context?.userId,
                    object: context?.object,
                },
                steps,
                output,
            });

            return { success: true, output, durationMs };
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const durationMs = Date.now() - startTime;
            this.recordLog({
                id: runId,
                flowName,
                flowVersion: flow.version,
                status: 'failed',
                startedAt,
                completedAt: new Date().toISOString(),
                durationMs,
                trigger: {
                    type: context?.event ?? 'manual',
                    userId: context?.userId,
                    object: context?.object,
                },
                steps,
                error: errorMessage,
            });
            return { success: false, error: errorMessage, durationMs };
        }
    }
}

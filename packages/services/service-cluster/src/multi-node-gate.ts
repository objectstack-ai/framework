// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Multi-node authorization gate (open mechanism).
 *
 * The open framework ships **no gate** — multi-node is always allowed. A
 * distribution (e.g. the Enterprise Edition) registers a gate to authorize
 * whether the runtime may enable a multi-node (remote-driver) topology — for
 * example, an EE license check. The framework deliberately knows nothing about
 * *why* a gate allows or denies; it only consults the registered decision.
 *
 * When a gate denies, the caller (e.g. `os serve`) **downgrades to single-node**
 * rather than failing — multi-node is an add-on, not a precondition for the
 * runtime to serve. This is distinct from the split-brain guard, which throws
 * on an outright misconfiguration (memory driver declared multi-node).
 */
export interface MultiNodeGate {
    /**
     * Called before the runtime enables a remote-driver (multi-node) topology.
     * Return `allowed: false` to force single-node; `reason` is surfaced in logs.
     */
    allowMultiNode(): { allowed: boolean; reason?: string };
}

let registered: MultiNodeGate | undefined;

/**
 * Register the multi-node authorization gate. Last registration wins. A
 * distribution calls this at boot (before the cluster topology is resolved).
 */
export function registerMultiNodeGate(gate: MultiNodeGate): void {
    registered = gate;
}

/**
 * Resolve the multi-node decision. With no gate registered (open framework),
 * multi-node is allowed.
 */
export function checkMultiNodeAllowed(): { allowed: boolean; reason?: string } {
    return registered ? registered.allowMultiNode() : { allowed: true };
}

/** Clear the registered gate. For tests. */
export function __resetMultiNodeGate(): void {
    registered = undefined;
}

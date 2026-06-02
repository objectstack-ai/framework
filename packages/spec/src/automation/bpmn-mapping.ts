// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @module automation/bpmn-mapping
 *
 * **Structured constructs ⇄ BPMN interchange mapping** (ADR-0031 §Decision 5).
 *
 * ADR-0031 keeps the BPMN gateway/boundary/multi-instance vocabulary in the
 * protocol as the **interop representation only** — the native, AI-authored
 * model is the structured constructs (`loop` container, `parallel` block,
 * `try_catch`). This module is the semantic bridge between the two *at the flow
 * model level* (nodes + edges + config), independent of any wire format:
 *
 *  - {@link exportConstructsToBpmn} expands each structured construct into its
 *    BPMN interchange shape — a `parallel` block → `parallel_gateway` (AND-split)
 *    + branch regions + `join_gateway` (AND-join); a `try_catch` → the protected
 *    activity + an error `boundary_event` + the handler region; a `loop`
 *    container → its body marked with multi-instance loop characteristics. So an
 *    external BPM tool (Camunda, Activiti, …) sees a well-formed BPMN graph.
 *  - {@link importBpmnToConstructs} folds that BPMN shape back into the
 *    structured constructs.
 *
 * **Round-trip fidelity.** Export stamps each expansion's anchor node with an
 * `osConstruct` *extension marker* (config key {@link OS_CONSTRUCT_EXT}) holding
 * the original construct — mirroring how BPMN preserves non-native semantics in
 * `extensionElements`. Import prefers that marker for an *exact* reconstruction
 * (so `construct → BPMN → construct` is identity). For **foreign** BPMN with no
 * marker, import does a best-effort structural fold (matched
 * `parallel_gateway`/`join_gateway` pairs → a `parallel` block) and emits
 * diagnostics for shapes it can't safely fold.
 *
 * The actual BPMN 2.0 **XML** (de)serialization layers on top of this mapping
 * and is intentionally out of scope here — per the spec it is a plugin concern
 * (`bpmn-interop.zod.ts`, "Priority: Low").
 */

import type { FlowNode, FlowEdge } from './flow.zod';
import {
  LOOP_NODE_TYPE,
  PARALLEL_NODE_TYPE,
  TRY_CATCH_NODE_TYPE,
  analyzeRegion,
} from './control-flow.zod';
import type { FlowNodeParsed, FlowEdgeParsed } from './flow.zod';

// ─── BPMN interchange node type ids ──────────────────────────────────

/** BPMN AND-split gateway (interop only). */
export const BPMN_PARALLEL_GATEWAY = 'parallel_gateway' as const;
/** BPMN AND-join gateway (interop only). */
export const BPMN_JOIN_GATEWAY = 'join_gateway' as const;
/** BPMN boundary event attached to a host activity (interop only). */
export const BPMN_BOUNDARY_EVENT = 'boundary_event' as const;

/**
 * Config key carrying the ObjectStack extension marker on an expansion's anchor
 * node — the structured construct that the surrounding BPMN nodes represent.
 * The analogue of BPMN `extensionElements`: it lets a round-trip reconstruct the
 * construct exactly, and a foreign tool ignore it.
 */
export const OS_CONSTRUCT_EXT = 'osConstruct' as const;

// ─── Types ───────────────────────────────────────────────────────────

/** A minimal flow view this module operates on (nodes + edges). */
export interface MappableFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** A diagnostic from a mapping operation (mirrors BpmnDiagnosticSchema shape). */
export interface BpmnMappingDiagnostic {
  severity: 'info' | 'warning' | 'error';
  message: string;
  nodeId?: string;
}

/** Result of a mapping operation — the transformed flow plus diagnostics. */
export interface BpmnMappingResult {
  flow: MappableFlow;
  diagnostics: BpmnMappingDiagnostic[];
  /** Number of constructs/elements successfully mapped. */
  mappedCount: number;
  /** Number of elements left unmapped (surfaced as warnings). */
  unmappedCount: number;
}

/** The shape stored under {@link OS_CONSTRUCT_EXT}. */
interface OsConstructMarker {
  /** The structured construct node type (`parallel` / `try_catch` / `loop`). */
  type: string;
  /** Original construct node id. */
  id: string;
  /** Original construct node label. */
  label: string;
  /** Original construct node config. */
  config: Record<string, unknown>;
  /** The entry node id of the expansion (where external in-edges arrive). */
  entryId: string;
  /** The exit node id of the expansion (where external out-edges leave). */
  exitId: string;
  /** All node ids belonging to the expansion (removed on reconstruction). */
  memberIds: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

type Region = { nodes: FlowNode[]; edges?: FlowEdge[] };

function regionEntryExit(region: Region): { entryId: string; exitId: string } {
  const analysis = analyzeRegion({
    nodes: region.nodes as unknown as FlowNodeParsed[],
    edges: (region.edges ?? []) as unknown as FlowEdgeParsed[],
  });
  if (!analysis.entryId || !analysis.exitId) {
    throw new Error(`bpmn-mapping: region is not single-entry/single-exit — ${analysis.errors.join('; ')}`);
  }
  return { entryId: analysis.entryId, exitId: analysis.exitId };
}

function cfg(node: FlowNode): Record<string, unknown> {
  return (node.config ?? {}) as Record<string, unknown>;
}

function getMarker(node: FlowNode): OsConstructMarker | undefined {
  const m = cfg(node)[OS_CONSTRUCT_EXT];
  return m && typeof m === 'object' ? (m as OsConstructMarker) : undefined;
}

// ─── Export: structured constructs → BPMN interchange ────────────────

/**
 * Expand every structured construct (`parallel`, `try_catch`, and `loop` with a
 * `body`) in `flow` into its BPMN interchange shape. Ordinary nodes are left
 * untouched. Each expansion's anchor node carries an {@link OS_CONSTRUCT_EXT}
 * marker so {@link importBpmnToConstructs} can reconstruct it exactly.
 */
export function exportConstructsToBpmn(flow: MappableFlow): BpmnMappingResult {
  let nodes: FlowNode[] = [...flow.nodes];
  let edges: FlowEdge[] = [...flow.edges];
  const diagnostics: BpmnMappingDiagnostic[] = [];
  let mapped = 0;

  // Snapshot the construct nodes up front (we mutate `nodes` as we go).
  const constructs = flow.nodes.filter(
    n =>
      n.type === PARALLEL_NODE_TYPE ||
      n.type === TRY_CATCH_NODE_TYPE ||
      (n.type === LOOP_NODE_TYPE && cfg(n).body != null),
  );

  for (const c of constructs) {
    try {
      const expanded =
        c.type === PARALLEL_NODE_TYPE
          ? expandParallel(c, nodes, edges)
          : c.type === TRY_CATCH_NODE_TYPE
            ? expandTryCatch(c, nodes, edges)
            : expandLoop(c, nodes, edges);
      nodes = expanded.nodes;
      edges = expanded.edges;
      diagnostics.push(expanded.diagnostic);
      mapped++;
    } catch (err) {
      diagnostics.push({
        severity: 'error',
        nodeId: c.id,
        message: `failed to expand ${c.type} '${c.id}': ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { flow: { nodes, edges }, diagnostics, mappedCount: mapped, unmappedCount: 0 };
}

/** Edges entering / leaving a node id. */
const inEdgesOf = (edges: FlowEdge[], id: string) => edges.filter(e => e.target === id);
const outEdgesOf = (edges: FlowEdge[], id: string) => edges.filter(e => e.source === id);

function expandParallel(c: FlowNode, nodes: FlowNode[], edges: FlowEdge[]): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  diagnostic: BpmnMappingDiagnostic;
} {
  const branches = (cfg(c).branches ?? []) as Array<{ name?: string; nodes: FlowNode[]; edges?: FlowEdge[] }>;
  const splitId = `${c.id}__split`;
  const joinId = `${c.id}__join`;

  const branchNodes = branches.flatMap(b => b.nodes);
  const branchEdges = branches.flatMap(b => b.edges ?? []);
  const memberIds = [splitId, joinId, ...branchNodes.map(n => n.id)];

  const marker: OsConstructMarker = {
    type: PARALLEL_NODE_TYPE,
    id: c.id,
    label: c.label,
    config: cfg(c),
    entryId: splitId,
    exitId: joinId,
    memberIds,
  };

  const splitNode: FlowNode = {
    id: splitId,
    type: BPMN_PARALLEL_GATEWAY,
    label: `${c.label} (split)`,
    config: { [OS_CONSTRUCT_EXT]: marker },
  };
  const joinNode: FlowNode = { id: joinId, type: BPMN_JOIN_GATEWAY, label: `${c.label} (join)` };

  const connectorEdges: FlowEdge[] = [];
  branches.forEach((b, i) => {
    const { entryId, exitId } = regionEntryExit(b);
    connectorEdges.push({ id: `${c.id}__split_b${i}`, source: splitId, target: entryId, type: 'default' });
    connectorEdges.push({ id: `${c.id}__b${i}_join`, source: exitId, target: joinId, type: 'default' });
  });

  // Rewire the construct's external in-edges to the split, out-edges from the join.
  const rewired = edges
    .filter(e => e.source !== c.id && e.target !== c.id)
    .concat(inEdgesOf(edges, c.id).map(e => ({ ...e, target: splitId })))
    .concat(outEdgesOf(edges, c.id).map(e => ({ ...e, source: joinId })));

  const newNodes = nodes.filter(n => n.id !== c.id).concat(splitNode, joinNode, branchNodes);
  const newEdges = rewired.concat(branchEdges, connectorEdges);

  return {
    nodes: newNodes,
    edges: newEdges,
    diagnostic: { severity: 'info', nodeId: c.id, message: `parallel '${c.id}' → parallel/join gateway (${branches.length} branches)` },
  };
}

function expandTryCatch(c: FlowNode, nodes: FlowNode[], edges: FlowEdge[]): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  diagnostic: BpmnMappingDiagnostic;
} {
  const tryRegion = cfg(c).try as Region;
  const catchRegion = cfg(c).catch as Region | undefined;
  const { entryId: tryEntry, exitId: tryExit } = regionEntryExit(tryRegion);

  const tryNodes = tryRegion.nodes;
  const tryEdges = tryRegion.edges ?? [];
  const catchNodes = catchRegion?.nodes ?? [];
  const catchEdges = catchRegion?.edges ?? [];

  const memberIds = [...tryNodes.map(n => n.id), ...catchNodes.map(n => n.id)];
  const addNodes: FlowNode[] = [...tryNodes];
  const addEdges: FlowEdge[] = [...tryEdges];

  // The try-region entry is the protected activity; it carries the marker.
  const markerEntryId = tryEntry;

  let boundaryNode: FlowNode | undefined;
  if (catchRegion) {
    const { entryId: catchEntry, exitId: catchExit } = regionEntryExit(catchRegion);
    const boundaryId = `${c.id}__boundary`;
    memberIds.push(boundaryId);
    boundaryNode = {
      id: boundaryId,
      type: BPMN_BOUNDARY_EVENT,
      label: `${c.label} (catch)`,
      boundaryConfig: { attachedToNodeId: markerEntryId, eventType: 'error', interrupting: true },
    };
    addNodes.push(boundaryNode, ...catchNodes);
    addEdges.push(...catchEdges);
    // Boundary fires into the catch region; the handler rejoins the after-block.
    addEdges.push({ id: `${c.id}__boundary_catch`, source: boundaryId, target: catchEntry, type: 'fault' });
    // catchExit connects to the construct's out-edge targets (added below via rewire of out-edges duplicated).
    addEdges.push(...outEdgesOf(edges, c.id).map((e, i) => ({ ...e, id: `${c.id}__catch_out${i}`, source: catchExit })));
  }

  const marker: OsConstructMarker = {
    type: TRY_CATCH_NODE_TYPE,
    id: c.id,
    label: c.label,
    config: cfg(c),
    entryId: markerEntryId,
    exitId: tryExit,
    memberIds,
  };
  // Stamp the marker on the try-entry node (clone so we don't mutate the original).
  const stampedTryNodes = addNodes.map(n =>
    n.id === markerEntryId ? { ...n, config: { ...cfg(n), [OS_CONSTRUCT_EXT]: marker } } : n,
  );

  const rewired = edges
    .filter(e => e.source !== c.id && e.target !== c.id)
    .concat(inEdgesOf(edges, c.id).map(e => ({ ...e, target: tryEntry })))
    .concat(outEdgesOf(edges, c.id).map(e => ({ ...e, source: tryExit })));

  const newNodes = nodes.filter(n => n.id !== c.id).concat(stampedTryNodes);
  const newEdges = rewired.concat(addEdges);

  return {
    nodes: newNodes,
    edges: newEdges,
    diagnostic: {
      severity: 'info',
      nodeId: c.id,
      message: `try_catch '${c.id}' → protected activity${catchRegion ? ' + error boundary_event + handler' : ' (no catch handler)'}`,
    },
  };
}

function expandLoop(c: FlowNode, nodes: FlowNode[], edges: FlowEdge[]): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  diagnostic: BpmnMappingDiagnostic;
} {
  const body = cfg(c).body as Region;
  const { entryId: bodyEntry, exitId: bodyExit } = regionEntryExit(body);
  const bodyNodes = body.nodes;
  const bodyEdges = body.edges ?? [];

  const marker: OsConstructMarker = {
    type: LOOP_NODE_TYPE,
    id: c.id,
    label: c.label,
    config: cfg(c),
    entryId: bodyEntry,
    exitId: bodyExit,
    memberIds: bodyNodes.map(n => n.id),
  };

  // BPMN multi-instance loop characteristics on the body entry (the looped activity).
  const loopCharacteristics = {
    isSequential: true,
    collection: cfg(c).collection,
    elementVariable: cfg(c).iteratorVariable ?? 'item',
  };
  const stampedBody = bodyNodes.map(n =>
    n.id === bodyEntry
      ? { ...n, config: { ...cfg(n), bpmnLoopCharacteristics: loopCharacteristics, [OS_CONSTRUCT_EXT]: marker } }
      : n,
  );

  const rewired = edges
    .filter(e => e.source !== c.id && e.target !== c.id)
    .concat(inEdgesOf(edges, c.id).map(e => ({ ...e, target: bodyEntry })))
    .concat(outEdgesOf(edges, c.id).map(e => ({ ...e, source: bodyExit })));

  const newNodes = nodes.filter(n => n.id !== c.id).concat(stampedBody);
  const newEdges = rewired.concat(bodyEdges);

  return {
    nodes: newNodes,
    edges: newEdges,
    diagnostic: { severity: 'info', nodeId: c.id, message: `loop '${c.id}' → multi-instance activity (loopCharacteristics)` },
  };
}

// ─── Import: BPMN interchange → structured constructs ────────────────

/**
 * Fold a BPMN-shaped flow back into structured constructs. Nodes carrying an
 * {@link OS_CONSTRUCT_EXT} marker (i.e. produced by {@link exportConstructsToBpmn})
 * are reconstructed **exactly**. For foreign BPMN without markers, matched
 * `parallel_gateway`/`join_gateway` pairs are folded into a `parallel` block on
 * a best-effort basis; shapes that can't be safely folded (e.g. boundary events,
 * multi-instance markers with no `osConstruct`) are left in place with a warning.
 */
export function importBpmnToConstructs(flow: MappableFlow): BpmnMappingResult {
  let nodes: FlowNode[] = [...flow.nodes];
  let edges: FlowEdge[] = [...flow.edges];
  const diagnostics: BpmnMappingDiagnostic[] = [];
  let mapped = 0;

  // 1) Exact reconstruction from osConstruct markers.
  const markers = nodes
    .map(n => getMarker(n))
    .filter((m): m is OsConstructMarker => m != null);

  for (const marker of markers) {
    const memberSet = new Set(marker.memberIds);
    // External in-edges: into the entry from outside the expansion.
    const externalIn = edges.filter(e => e.target === marker.entryId && !memberSet.has(e.source));
    // External out-edges: out of the exit to outside the expansion.
    const externalOut = edges.filter(e => e.source === marker.exitId && !memberSet.has(e.target));

    // Reconstruct the construct node (strip the extension marker from its config).
    const restored: FlowNode = { id: marker.id, type: marker.type, label: marker.label, config: marker.config };

    nodes = nodes.filter(n => !memberSet.has(n.id)).concat(restored);
    edges = edges
      // drop every edge touching an expansion member (internal + the external ones we rewire)
      .filter(e => !memberSet.has(e.source) && !memberSet.has(e.target))
      .concat(externalIn.map(e => ({ ...e, target: marker.id })))
      .concat(externalOut.map(e => ({ ...e, source: marker.id })));
    mapped++;
    diagnostics.push({ severity: 'info', nodeId: marker.id, message: `reconstructed ${marker.type} '${marker.id}' from osConstruct marker` });
  }

  // 2) Best-effort structural fold of foreign parallel gateways (no marker).
  const foldable = nodes.filter(n => n.type === BPMN_PARALLEL_GATEWAY && getMarker(n) == null);
  for (const split of foldable) {
    const folded = foldForeignParallel(split, nodes, edges);
    if (folded) {
      nodes = folded.nodes;
      edges = folded.edges;
      mapped++;
      diagnostics.push({ severity: 'info', nodeId: split.id, message: `folded foreign parallel_gateway '${split.id}' → parallel block` });
    } else {
      diagnostics.push({ severity: 'warning', nodeId: split.id, message: `parallel_gateway '${split.id}' could not be matched to a single join_gateway — left as-is` });
    }
  }

  // 3) Warn about foreign shapes we don't fold.
  let unmapped = 0;
  for (const n of nodes) {
    if (getMarker(n) != null) continue;
    if (n.type === BPMN_BOUNDARY_EVENT) {
      unmapped++;
      diagnostics.push({ severity: 'warning', nodeId: n.id, message: `foreign boundary_event '${n.id}' — map to a try_catch manually (no osConstruct marker)` });
    } else if (cfg(n).bpmnLoopCharacteristics != null) {
      unmapped++;
      diagnostics.push({ severity: 'warning', nodeId: n.id, message: `foreign multi-instance activity '${n.id}' — map to a loop container manually (no osConstruct marker)` });
    }
  }

  return { flow: { nodes, edges }, diagnostics, mappedCount: mapped, unmappedCount: unmapped };
}

/**
 * Best-effort fold of a foreign `parallel_gateway` and its matching
 * `join_gateway` into a `parallel` block. Returns `undefined` when the split's
 * branches don't all reconverge at exactly one join (the only shape we fold
 * safely). Each branch is the linear chain of nodes from the split to the join.
 */
function foldForeignParallel(split: FlowNode, nodes: FlowNode[], edges: FlowEdge[]): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} | undefined {
  const splitOut = outEdgesOf(edges, split.id);
  if (splitOut.length < 2) return undefined;

  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const branchRegions: Array<{ nodes: FlowNode[]; edges: FlowEdge[] }> = [];
  const branchMembers = new Set<string>();
  let joinId: string | undefined;

  for (const first of splitOut) {
    const bNodes: FlowNode[] = [];
    const bEdges: FlowEdge[] = [];
    let cursor: string | undefined = first.target;
    const guard = new Set<string>();
    while (cursor) {
      if (guard.has(cursor)) return undefined; // cycle — bail
      guard.add(cursor);
      const node = nodeById.get(cursor);
      if (!node) return undefined;
      if (node.type === BPMN_JOIN_GATEWAY) {
        if (joinId && joinId !== cursor) return undefined; // branches reconverge at different joins
        joinId = cursor;
        break;
      }
      bNodes.push(node);
      branchMembers.add(cursor);
      const outs = outEdgesOf(edges, cursor);
      if (outs.length !== 1) return undefined; // non-linear branch — out of scope
      bEdges.push(outs[0]);
      cursor = outs[0].target;
    }
    if (!joinId) return undefined;
    // Drop the final edge into the join from the captured branch edges.
    branchRegions.push({ nodes: bNodes, edges: bEdges.filter(e => e.target !== joinId) });
  }
  if (!joinId || branchRegions.some(b => b.nodes.length === 0)) return undefined;

  const parallelId = split.id.replace(/__split$/, '') || `${split.id}_parallel`;
  const parallelNode: FlowNode = {
    id: parallelId,
    type: PARALLEL_NODE_TYPE,
    label: (split.label ?? parallelId).replace(/ \(split\)$/, ''),
    config: { branches: branchRegions.map((b, i) => ({ name: `branch_${i + 1}`, nodes: b.nodes, edges: b.edges })) },
  };

  const removed = new Set<string>([split.id, joinId, ...branchMembers]);
  const externalIn = inEdgesOf(edges, split.id).filter(e => !removed.has(e.source));
  const externalOut = outEdgesOf(edges, joinId).filter(e => !removed.has(e.target));

  const newNodes = nodes.filter(n => !removed.has(n.id)).concat(parallelNode);
  const newEdges = edges
    .filter(e => !removed.has(e.source) && !removed.has(e.target))
    .concat(externalIn.map(e => ({ ...e, target: parallelId })))
    .concat(externalOut.map(e => ({ ...e, source: parallelId })));

  return { nodes: newNodes, edges: newEdges };
}

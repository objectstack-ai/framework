// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';

/**
 * XState-inspired State Machine Protocol
 * Used to define strict business logic constraints and lifecycle management.
 * Prevent AI "hallucinations" by enforcing valid valid transitions.
 */

// --- Primitives ---

/**
 * References a named action (side effect)
 * Can be a script, a webhook, or a field update.
 */
export const ActionRefSchema = z.union([
  z.string().describe('Action Name'),
  z.object({
    type: z.string(), // e.g., 'xstate.assign', 'log', 'email'
    params: z.record(z.string(), z.unknown()).optional()
  })
]);

/**
 * References a named condition (guard)
 * Must evaluate to true for the transition to occur.
 */
export const GuardRefSchema = z.union([
  z.string().describe('Guard Name (e.g., "isManager", "amountGT1000")'),
  z.object({
    type: z.string(),
    params: z.record(z.string(), z.unknown()).optional()
  })
]);

// --- Core Structure ---

/**
 * State Transition Definition
 * "When EVENT happens, if GUARD is true, go to TARGET and run ACTIONS"
 */
export const TransitionSchema = z.object({
  target: z.string().optional().describe('Target State ID'),
  cond: GuardRefSchema.optional().describe('Condition (Guard) required to take this path'),
  actions: z.array(ActionRefSchema).optional().describe('Actions to execute during transition'),
  description: z.string().optional().describe('Human readable description of this rule'),
});

/**
 * Event Definition (Signals)
 */
export const EventSchema = z.object({
  type: z.string().describe('Event Type (e.g. "APPROVE", "REJECT", "Submit")'),
  // Payload validation schema could go here if we want deep validation
  schema: z.record(z.string(), z.unknown()).optional().describe('Expected event payload structure'),
});

export type ActionRef = z.infer<typeof ActionRefSchema>;
export type Transition = z.infer<typeof TransitionSchema>;

export type StateNodeConfig = {
  type?: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  entry?: ActionRef[];
  exit?: ActionRef[];
  on?: Record<string, string | Transition | Transition[]>;
  always?: Transition[];
  initial?: string;
  states?: Record<string, StateNodeConfig>;
  meta?: {
    label?: string;
    description?: string;
    color?: string;
    aiInstructions?: string;
  };
};

/**
 * State Node Definition
 */
export const StateNodeSchema: z.ZodType<StateNodeConfig> = z.lazy(() => z.object({
  /** Type of state */
  type: z.enum(['atomic', 'compound', 'parallel', 'final', 'history']).default('atomic'),
  
  /** Entry/Exit Actions */
  entry: z.array(ActionRefSchema).optional().describe('Actions to run when entering this state'),
  exit: z.array(ActionRefSchema).optional().describe('Actions to run when leaving this state'),
  
  /** Transitions (Events) */
  on: z.record(z.string(), z.union([
    z.string(), // Shorthand target
    TransitionSchema, 
    z.array(TransitionSchema)
  ])).optional().describe('Map of Event Type -> Transition Definition'),
  
  /** Always Transitions (Eventless) */
  always: z.array(TransitionSchema).optional(),

  /** Nesting (Hierarchical States) */
  initial: z.string().optional().describe('Initial child state (if compound)'),
  states: z.record(z.string(), StateNodeSchema).optional(),
  
  /** Metadata for UI/AI */
  meta: z.object({
    label: z.string().optional(),
    description: z.string().optional(),
    color: z.string().optional(), // For UI diagrams
    // Instructions for AI Agent when in this state
    aiInstructions: z.string().optional().describe('Specific instructions for AI when in this state'),
  }).optional(),
}));

/**
 * Top-Level State Machine Definition
 */
export const StateMachineSchema = z.object({
  id: SnakeCaseIdentifierSchema.describe('Unique Machine ID'),
  description: z.string().optional(),
  
  /** Context (Memory) Schema */
  contextSchema: z.record(z.string(), z.unknown()).optional().describe('Zod Schema for the machine context/memory'),
  
  /** Initial State */
  initial: z.string().describe('Initial State ID'),
  
  /** State Definitions */
  states: z.record(z.string(), StateNodeSchema).describe('State Nodes'),
  
  /** Global Listeners */
  on: z.record(z.string(), z.union([z.string(), TransitionSchema, z.array(TransitionSchema)])).optional(),
});

export type StateMachineConfig = z.infer<typeof StateMachineSchema>;

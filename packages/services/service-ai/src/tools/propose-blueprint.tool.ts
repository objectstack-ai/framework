// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * propose_blueprint — AI Tool Metadata (ADR-0033 §4, plan-first)
 *
 * For a HIGH-LEVEL goal ("build me a project-management system") the agent
 * designs a structured solution blueprint — objects + fields + relationships +
 * views + dashboards + seed data, with stated assumptions — instead of
 * transcribing a field list. **Nothing is persisted.** The agent presents the
 * blueprint for the human to confirm/edit conversationally; only after approval
 * does it call `apply_blueprint`. This is the safety valve against
 * mass-generating unreviewed artifacts from a vague prompt.
 */
export const proposeBlueprintTool = defineTool({
  name: 'propose_blueprint',
  label: 'Propose Blueprint',
  description:
    'Design a structured solution blueprint (objects, fields, relationships, views, dashboards, seed data) for a high-level goal, WITHOUT building anything. ' +
    'Use this when the user asks to build a whole system/app/module rather than a single object or field. The blueprint is a proposal for the human to confirm — nothing is created until you call apply_blueprint after they approve.',
  category: 'data',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      goal: {
        type: 'string',
        description: 'The user\'s high-level goal in their own words, e.g. "build me a recruiting system to track candidates and interviews".',
      },
      context: {
        type: 'string',
        description: 'Optional extra constraints or details the user gave (industry, must-have fields, naming preferences).',
      },
    },
    required: ['goal'],
    additionalProperties: false,
  },
});

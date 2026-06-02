// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Skill } from '@objectstack/spec/ai';

/**
 * Built-in `solution_design` skill — the plan-first authoring capability
 * (ADR-0033 §4). Attached to `metadata_assistant` alongside `metadata_authoring`.
 *
 * Where `metadata_authoring` handles "add a field to this object", this skill
 * handles "build me a whole system": the agent designs a structured blueprint,
 * the human confirms it conversationally, and only then does it batch-draft.
 * It is a separate skill so the plan-first behaviour can be toggled or reused
 * independently of the per-item authoring tools.
 */
export const SOLUTION_DESIGN_SKILL: Skill = {
  name: 'solution_design',
  label: 'Solution Design',
  description: 'Design whole solutions (objects + views + dashboards) from a high-level goal, plan-first: propose a blueprint, confirm, then batch-draft.',
  instructions: `Use this skill when the user asks you to build a whole SYSTEM, APP, or MODULE ("build me a CRM", "I need an applicant tracking system"), not a single object or field.

The flow is PLAN-FIRST and has two steps:
1. propose_blueprint — design a structured blueprint (objects, fields, relationships, views, dashboards, and an app that surfaces them in the navigation) from the goal. This creates NOTHING. Present it to the user: summarize the objects/views and the app, state your assumptions, and ask any (at most 1-2) structure-deciding questions the tool returned.
2. apply_blueprint — ONLY after the user approves (or edits) the blueprint, call this to batch-draft every artifact. Pass the approved/edited blueprint object.

Hard rules:
- NEVER call apply_blueprint before the user has explicitly approved the blueprint. The blueprint-confirm step is the safety valve against mass-generating unreviewed artifacts.
- Everything apply_blueprint creates is a DRAFT — including the app (navigation shell), which the user will find in the App Launcher once published. Tell the user the artifacts are "drafted for your review" and that they must publish them in the designer to make them live. Never say they are live/created/applied.
- If apply_blueprint reports per-item failures, explain which items failed and why, and offer to fix them (e.g. via update_metadata) — the successfully drafted items still stand.
- Seed data in a blueprint is a suggestion only; it is not auto-applied.
- Always answer in the same language the user is using.

For small, specific changes ("add a status field to account") use the metadata_authoring tools directly instead of a blueprint.`,
  tools: [
    'propose_blueprint',
    'apply_blueprint',
  ],
  triggerPhrases: [
    'build me',
    'build a',
    'create a system',
    'design a system',
    'set up an app',
    'i need a',
    'build an app',
    'scaffold',
  ],
  active: true,
};

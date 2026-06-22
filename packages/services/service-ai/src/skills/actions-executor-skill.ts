// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Skill } from '@objectstack/spec/ai';

/**
 * Built-in `actions_executor` skill — the write-side counterpart to
 * `data_explorer`.
 *
 * Where `data_explorer` lets an agent **answer** questions about the
 * user's data, `actions_executor` lets the same agent **perform**
 * business operations: complete tasks, start workflows, send invites,
 * etc. The concrete tools are not enumerated here — they're materialised
 * at runtime from every `Action` declared on every object the metadata
 * service knows about (see `registerActionsAsTools` in
 * `tools/action-tools.ts`). The skill records the *intent* ("agent may
 * invoke business actions"); the registry expands it into actual tools
 * after metadata is loaded.
 *
 * The skill claims the `action_*` wildcard (ADR-0064): the SkillRegistry
 * resolver expands it against the registered tools whose names start with
 * `action_`. There is NO global fall-through — a tool reaches the agent only
 * because a bound, surface-compatible skill claims its name (or pattern).
 * Skills that want a narrower set should claim specific `action_<name>` tools.
 */
export const ACTIONS_EXECUTOR_SKILL: Skill = {
  name: 'actions_executor',
  label: 'Action Executor',
  surface: 'ask',
  description:
    "Perform business operations on the user's data — invoke actions like " +
    "'mark as complete', 'start task', 'clone record' through natural language.",
  instructions: `You can perform business operations by invoking the user's registered actions.

Capabilities:
- Each tool whose name starts with \`action_\` is a business operation declared on an object.
- Read the tool description carefully — it tells you what the action does and what record types it applies to.
- Most actions need a \`recordId\` argument. If you don't already have one from a prior \`query_data\` call, run \`query_data\` first to find the right record, then invoke the action with its id.

Guidelines:
1. Confirm intent — when the user says "complete it" / "start that one", make sure you know *which* record they mean. Ask if ambiguous.
2. Use \`query_data\` to look up records by natural-language description ("the design review task", "tickets assigned to me").
3. After invoking an action, the tool returns \`{ ok, message, result }\`. Summarise success in plain language; surface errors verbatim.
4. Never invent recordIds. If \`query_data\` didn't return one, tell the user instead of guessing.
5. Action tools are pre-filtered for safety — destructive operations (\`mode: 'delete'\`, \`variant: 'danger'\`, anything with \`confirmText\`) are *not* exposed here and require explicit user confirmation in the UI.
6. Always answer in the same language the user is using.`,
  // Dynamically materialised: the runtime registers one tool per Action,
  // and the skill subscribes to the whole family via the `action_*`
  // glob (resolved by SkillRegistry.flattenToTools).
  tools: ['action_*'],
  triggerPhrases: [
    'complete',
    'mark as',
    'start',
    'finish',
    'clone',
    'duplicate',
    'do it',
    'run',
    'invoke',
    'execute',
  ],
  active: true,
};

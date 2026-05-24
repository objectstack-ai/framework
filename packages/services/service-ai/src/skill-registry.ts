// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AIToolDefinition, IMetadataService } from '@objectstack/spec/contracts';
import type { Skill, SkillTriggerCondition } from '@objectstack/spec/ai';
import { SkillSchema } from '@objectstack/spec/ai';

/**
 * Runtime context passed when chatting with the ambient assistant.
 *
 * Mirrors the metadata fields used by `Skill.triggerConditions` so that
 * skills can be activated declaratively based on what the user is doing.
 *
 * UI clients populate this from the current route / selected record.
 */
export interface SkillContext {
  /** Application the user is currently inside (e.g. "crm"). */
  appName?: string;
  /** Object the user is viewing (e.g. "lead"). */
  objectName?: string;
  /** Currently selected record ID. */
  recordId?: string;
  /** Current view name. */
  viewName?: string;
  /** Channel/medium of the conversation (e.g. "web", "slack", "email"). */
  channel?: string;
  /** User's role (used by `triggerConditions` with `field=userRole`). */
  userRole?: string;
  /** Free-form additional context fields evaluated against `triggerConditions`. */
  [extraField: string]: unknown;
}

/**
 * Summary of an active skill suitable for slash-command palettes
 * and `GET /api/v1/ai/skills` responses.
 */
export interface SkillSummary {
  name: string;
  label: string;
  description?: string;
  triggerPhrases?: string[];
  toolCount: number;
}

/**
 * SkillRegistry — Loads and resolves AI Skill metadata.
 *
 * Responsibilities:
 * 1. Load & validate skill definitions from {@link IMetadataService}.
 * 2. Filter by runtime context using `triggerConditions`.
 * 3. Flatten skill `tools[]` references to concrete {@link AIToolDefinition}s.
 * 4. Compose skill `instructions` for system-prompt injection.
 *
 * The registry is stateless; every call re-reads from the metadata
 * service so changes published at runtime become immediately visible.
 *
 * @example
 * ```ts
 * const registry = new SkillRegistry(metadataService);
 * const active = await registry.listActiveSkills({ appName: 'crm', objectName: 'lead' });
 * const tools = registry.flattenToTools(active, allTools);
 * ```
 */
export class SkillRegistry {
  constructor(private readonly metadataService: IMetadataService) {}

  // ── Loading ────────────────────────────────────────────────────

  /**
   * Load and validate a single skill definition by name.
   *
   * Returns `undefined` when the skill is missing or fails Zod
   * validation (so callers don't accidentally feed malformed metadata
   * to the LLM).
   */
  async loadSkill(skillName: string): Promise<Skill | undefined> {
    const raw = await this.metadataService.get('skill', skillName);
    if (!raw) return undefined;

    const result = SkillSchema.safeParse(raw);
    if (!result.success) return undefined;
    return result.data;
  }

  /**
   * Load all skill definitions, dropping any that fail validation
   * or are explicitly inactive.
   */
  async listSkills(): Promise<Skill[]> {
    const raw = await this.metadataService.list('skill');
    const skills: Skill[] = [];
    for (const item of raw) {
      const result = SkillSchema.safeParse(item);
      if (result.success && result.data.active !== false) {
        skills.push(result.data);
      }
    }
    return skills;
  }

  /**
   * Load only the skills referenced by `skillNames`, preserving
   * declaration order. Missing or invalid skill names are silently
   * dropped (logged at the route layer if needed) so an Agent can be
   * defined before all its skills are persisted.
   */
  async loadSkills(skillNames: readonly string[]): Promise<Skill[]> {
    const skills: Skill[] = [];
    for (const name of skillNames) {
      const skill = await this.loadSkill(name);
      if (skill && skill.active !== false) {
        skills.push(skill);
      }
    }
    return skills;
  }

  // ── Context filtering ──────────────────────────────────────────

  /**
   * Return skills whose `triggerConditions` are satisfied by the
   * given context. Skills without any conditions are always considered
   * active and returned in their declaration order.
   *
   * If `restrictTo` is provided, the result is intersected with that
   * allow-list (typically the agent's `skills[]` field) so an agent
   * never sees skills outside its declared scope.
   */
  async listActiveSkills(
    context: SkillContext = {},
    restrictTo?: readonly string[],
  ): Promise<Skill[]> {
    const allowList = restrictTo ? new Set(restrictTo) : undefined;
    const all = await this.listSkills();
    return all.filter((skill) => {
      if (allowList && !allowList.has(skill.name)) return false;
      return this.matchesContext(skill, context);
    });
  }

  /**
   * Evaluate a skill's `triggerConditions` against the given context.
   *
   * Semantics:
   * - No conditions defined → always matches.
   * - All conditions must pass (logical AND).
   * - Operators: `eq`, `neq`, `in`, `not_in`, `contains`.
   * - `contains` does substring matching for strings and `Array.includes`
   *   for arrays.
   * - Missing context fields fail unless the operator is `neq` /
   *   `not_in` (treating "absent" as "not equal to anything").
   */
  matchesContext(skill: Skill, context: SkillContext): boolean {
    const conditions = skill.triggerConditions;
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((cond) => this.evaluateCondition(cond, context));
  }

  private evaluateCondition(cond: SkillTriggerCondition, context: SkillContext): boolean {
    const fieldValue = context[cond.field];
    const expected = cond.value;

    switch (cond.operator) {
      case 'eq':
        return fieldValue === expected;
      case 'neq':
        return fieldValue !== expected;
      case 'in': {
        const list = Array.isArray(expected) ? expected : [expected];
        return list.includes(fieldValue as string);
      }
      case 'not_in': {
        const list = Array.isArray(expected) ? expected : [expected];
        return !list.includes(fieldValue as string);
      }
      case 'contains': {
        if (typeof fieldValue === 'string' && typeof expected === 'string') {
          return fieldValue.includes(expected);
        }
        if (Array.isArray(fieldValue)) {
          return Array.isArray(expected)
            ? expected.every((v) => fieldValue.includes(v))
            : fieldValue.includes(expected as string);
        }
        return false;
      }
      default:
        return false;
    }
  }

  // ── Tool resolution ───────────────────────────────────────────

  /**
   * Flatten a list of skills to a deduplicated array of concrete tool
   * definitions, preserving the order skills declared their tools.
   *
   * Tools that are declared by a skill but missing from the available
   * tool registry are silently dropped — this is intentional so a skill
   * can be authored before all its underlying tools are registered.
   */
  flattenToTools(skills: readonly Skill[], availableTools: readonly AIToolDefinition[]): AIToolDefinition[] {
    const toolMap = new Map(availableTools.map((t) => [t.name, t]));
    const seen = new Set<string>();
    const resolved: AIToolDefinition[] = [];
    for (const skill of skills) {
      for (const toolName of skill.tools) {
        // Support trailing-wildcard patterns like `action_*` so a skill
        // can subscribe to a *family* of dynamically registered tools
        // (built-in `actions_executor` uses this for the `action_<name>`
        // tools materialised from each object's declarative Action list).
        if (toolName.endsWith('*')) {
          const prefix = toolName.slice(0, -1);
          for (const def of availableTools) {
            if (!def.name.startsWith(prefix)) continue;
            if (seen.has(def.name)) continue;
            resolved.push(def);
            seen.add(def.name);
          }
          continue;
        }
        if (seen.has(toolName)) continue;
        const def = toolMap.get(toolName);
        if (def) {
          resolved.push(def);
          seen.add(toolName);
        }
      }
    }
    return resolved;
  }

  // ── System-prompt composition ─────────────────────────────────

  /**
   * Build the "Active Skills" block to append to an agent's system
   * prompt. The block lists each skill's label + instructions so the
   * LLM knows which capabilities are available and how to invoke them.
   *
   * Returns an empty string when there are no skills, so the caller
   * can safely concatenate without producing dangling whitespace.
   */
  composeInstructionsBlock(skills: readonly Skill[]): string {
    if (skills.length === 0) return '';

    const lines: string[] = ['', '--- Active Skills ---'];
    for (const skill of skills) {
      lines.push(`\n### ${skill.label} (${skill.name})`);
      if (skill.description) lines.push(skill.description);
      if (skill.instructions) lines.push(skill.instructions);
      if (skill.tools.length > 0) {
        lines.push(`Tools: ${skill.tools.join(', ')}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Project a skill to a wire-friendly summary suitable for the
   * `/api/v1/ai/skills` endpoint and slash-command palettes.
   */
  toSummary(skill: Skill): SkillSummary {
    return {
      name: skill.name,
      label: skill.label,
      description: skill.description,
      triggerPhrases: skill.triggerPhrases,
      toolCount: skill.tools.length,
    };
  }
}

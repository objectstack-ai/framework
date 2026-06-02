// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IAIService, IMetadataService, ModelMessage } from '@objectstack/spec/contracts';
import { SolutionBlueprintSchema, SolutionBlueprintStrictSchema, type SolutionBlueprint } from '@objectstack/spec/ai';
import { stageDraft, type DraftCapableProtocol } from './metadata-tools.js';
import type { ToolHandler, ToolRegistry } from './tool-registry.js';
import { proposeBlueprintTool } from './propose-blueprint.tool.js';
import { applyBlueprintTool } from './apply-blueprint.tool.js';

export { proposeBlueprintTool } from './propose-blueprint.tool.js';
export { applyBlueprintTool } from './apply-blueprint.tool.js';

/**
 * Recursively drop object keys whose value is `null`. The OpenAI-strict output
 * contract ({@link SolutionBlueprintStrictSchema}) requires every key present
 * and emits `null` for "empty" optional fields; stripping those nulls makes the
 * result conform to the lenient {@link SolutionBlueprintSchema} (which uses
 * `.optional()` — absent, not null) so every downstream consumer is unchanged.
 */
function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripNulls(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue;
      out[k] = stripNulls(v);
    }
    return out as T;
  }
  return value;
}

/** All blueprint (plan-first) tool definitions. */
export const BLUEPRINT_TOOL_DEFINITIONS = [proposeBlueprintTool, applyBlueprintTool];

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Services the plan-first blueprint tools need (ADR-0033 §4).
 *
 * - {@link IAIService} drives `generateObject` for the structured blueprint.
 * - `protocol` is the draft-capable write path reused from the metadata tools
 *   ({@link stageDraft}) — every artifact is staged, never published.
 * - {@link IMetadataService} is a fallback enumerator for existing objects.
 */
export interface BlueprintToolContext {
  ai: IAIService;
  protocol?: DraftCapableProtocol;
  metadataService: IMetadataService;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Best-effort list of existing object names, so the agent doesn't redesign
 *  what already exists. Mirrors `list_metadata`'s protocol-first enumeration. */
async function listExistingObjectNames(ctx: BlueprintToolContext): Promise<string[]> {
  try {
    if (ctx.protocol?.getMetaItems) {
      const res = await ctx.protocol.getMetaItems({ type: 'object' });
      const arr = Array.isArray(res)
        ? res
        : res && typeof res === 'object' && Array.isArray((res as { items?: unknown[] }).items)
          ? (res as { items: unknown[] }).items
          : [];
      return (arr as Array<{ name?: string }>).map((o) => o?.name).filter((n): n is string => !!n);
    }
  } catch {
    /* fall through to metadata service */
  }
  try {
    const objs = (await ctx.metadataService.listObjects()) as Array<{ name?: string }>;
    return objs.map((o) => o?.name).filter((n): n is string => !!n);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// propose_blueprint — structured design, NOTHING persisted
// ---------------------------------------------------------------------------

function createProposeBlueprintHandler(ctx: BlueprintToolContext): ToolHandler {
  return async (args) => {
    const { goal, context } = args as { goal?: string; context?: string };
    if (!goal || typeof goal !== 'string') {
      return JSON.stringify({ error: 'propose_blueprint: "goal" is required' });
    }
    if (!ctx.ai.generateObject) {
      return JSON.stringify({
        error:
          'propose_blueprint requires structured-output support. Configure a ' +
          'Vercel-AI-SDK-backed adapter (OpenAI, Anthropic, Google).',
      });
    }

    const existing = await listExistingObjectNames(ctx);
    const existingNote = existing.length
      ? `Objects that ALREADY exist (do not recreate these; reference them in lookups): ${existing.join(', ')}.`
      : 'There are no existing objects yet.';

    const messages: ModelMessage[] = [
      {
        role: 'system',
        content:
          'You are a metadata architect. Turn the user\'s high-level goal into a concrete, ' +
          'minimal-but-complete solution blueprint: the objects (tables) and their fields, the ' +
          'relationships (expressed as lookup/master_detail fields with a `reference` to the target ' +
          'object), a few useful list views, and optionally a dashboard.\n\n' +
          'Rules:\n' +
          '- Use snake_case for every object, field, and view name.\n' +
          '- Prefer a small, sensible field set per object over an exhaustive one.\n' +
          '- State the design choices you made as `assumptions`.\n' +
          '- If (and only if) a genuinely structure-deciding choice is unclear, put at most 1-2 ' +
          'short `questions`; otherwise pick the most likely interpretation and proceed.\n' +
          '- Do NOT invent field types — use the allowed enum values.\n' +
          '- Include an `app` (navigation shell) that surfaces the created objects (and any ' +
          'dashboards) so the user can actually open the solution: give it a snake_case `name`, a ' +
          'friendly `label`, and a Lucide `icon`. Keep it to a single app with a flat list of nav ' +
          'entries (you may omit `nav` to auto-surface every object and dashboard).\n' +
          `- ${existingNote}\n` +
          'This is a PROPOSAL. Nothing is built from it until the human approves.',
      },
      {
        role: 'user',
        content: context ? `${goal}\n\nAdditional context: ${context}` : goal,
      },
    ];

    let blueprint: SolutionBlueprint;
    try {
      // Use the OpenAI-strict-compatible mirror as the output contract (the
      // lenient SolutionBlueprintSchema's optional fields make OpenAI strict
      // structured outputs reject the schema). Strip the nulls it emits so the
      // result conforms to the lenient schema everything else consumes.
      const generated = await ctx.ai.generateObject(messages, SolutionBlueprintStrictSchema, {
        schemaName: 'SolutionBlueprint',
        schemaDescription:
          'A proposed solution: objects + fields + relationships + views + dashboards + an app (navigation shell), with stated assumptions. Use null for fields that do not apply.',
      });
      blueprint = stripNulls(generated.object) as SolutionBlueprint;
    } catch (err) {
      return JSON.stringify({
        error: `Failed to design blueprint: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    return JSON.stringify({
      status: 'blueprint_proposed',
      blueprint,
      summary: blueprint.summary,
      counts: {
        objects: blueprint.objects?.length ?? 0,
        views: blueprint.views?.length ?? 0,
        dashboards: blueprint.dashboards?.length ?? 0,
        app: blueprint.app ? 1 : 0,
        seedData: blueprint.seedData?.length ?? 0,
      },
      questions: blueprint.questions ?? [],
      note: 'Nothing has been created. Present this to the user; only call apply_blueprint after they approve.',
    });
  };
}

// ---------------------------------------------------------------------------
// apply_blueprint — batch-draft every artifact (per-item, partial-tolerant)
// ---------------------------------------------------------------------------

/** Convert a blueprint object into an `object` metadata body. */
function objectBody(o: SolutionBlueprint['objects'][number]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const f of o.fields ?? []) {
    fields[f.name] = {
      type: f.type,
      ...(f.label ? { label: f.label } : {}),
      ...(f.required !== undefined ? { required: f.required } : {}),
      ...(f.reference ? { reference: f.reference } : {}),
      ...(f.options ? { options: f.options } : {}),
    };
  }
  return {
    name: o.name,
    ...(o.label ? { label: o.label } : {}),
    ...(o.description ? { description: o.description } : {}),
    fields,
  };
}

/** Map a blueprint view's kind to a ListView `type`. */
const LIST_TYPE: Record<string, string> = { list: 'grid', kanban: 'kanban', calendar: 'calendar' };

/** Convert a blueprint view into a `view` metadata body (list- or form-family). */
function viewBody(
  v: NonNullable<SolutionBlueprint['views']>[number],
  columnsByObject: Map<string, string[]>,
): Record<string, unknown> {
  const cols = v.columns?.length ? v.columns : columnsByObject.get(v.object) ?? ['name'];
  const data = { provider: 'object', object: v.object };
  if (v.type === 'form') {
    return {
      form: {
        type: 'simple',
        data,
        sections: [{ fields: cols.map((field) => ({ field })) }],
      },
      ...(v.label ? { label: v.label } : {}),
    };
  }
  return {
    list: {
      type: LIST_TYPE[v.type] ?? 'grid',
      data,
      columns: cols,
      ...(v.label ? { label: v.label } : {}),
    },
  };
}

/** Convert a blueprint dashboard into a `dashboard` metadata body. */
function dashboardBody(d: NonNullable<SolutionBlueprint['dashboards']>[number]): Record<string, unknown> {
  return {
    name: d.name,
    label: d.label ?? d.name,
    widgets: (d.widgets ?? []).map((w) => ({
      id: w.id,
      ...(w.title ? { title: w.title } : {}),
      ...(w.object ? { object: w.object } : {}),
      ...(w.chart ? { chart: w.chart } : {}),
    })),
  };
}

/**
 * Convert the blueprint's app into an `app` metadata body — the navigation
 * shell end users open in the App Launcher. When the blueprint gives no
 * explicit `nav`, auto-surface every created object (then every dashboard) as a
 * top-level nav entry. Never sets `isDefault` (don't hijack the default app).
 */
function appBody(
  app: NonNullable<SolutionBlueprint['app']>,
  blueprint: SolutionBlueprint,
): Record<string, unknown> {
  const navSource: Array<{ type: 'object' | 'dashboard'; target: string; label?: string; icon?: string }> =
    app.nav && app.nav.length > 0
      ? app.nav
      : [
          ...(blueprint.objects ?? []).map((o) => ({ type: 'object' as const, target: o.name, label: o.label })),
          ...(blueprint.dashboards ?? []).map((d) => ({ type: 'dashboard' as const, target: d.name, label: d.label })),
        ];
  const navigation = navSource.map((n, i) => {
    const base = {
      id: `nav_${n.target}`,
      label: n.label ?? n.target,
      ...(n.icon ? { icon: n.icon } : {}),
      order: i,
    };
    return n.type === 'dashboard'
      ? { ...base, type: 'dashboard', dashboardName: n.target }
      : { ...base, type: 'object', objectName: n.target };
  });
  return {
    name: app.name,
    label: app.label ?? app.name,
    ...(app.icon ? { icon: app.icon } : {}),
    navigation,
  };
}

function createApplyBlueprintHandler(ctx: BlueprintToolContext): ToolHandler {
  return async (args, exec) => {
    const raw = (args as { blueprint?: unknown }).blueprint;
    if (raw === undefined || raw === null) {
      return JSON.stringify({ error: 'apply_blueprint: "blueprint" is required' });
    }

    // Defensive: the model re-emits the (possibly edited) blueprint — validate
    // it before fanning out so a malformed plan fails fast with fixable issues.
    // Strip any nulls first: the strict output contract emits `null` for empty
    // optional fields, and the model may carry those through to this call; the
    // lenient schema expects them absent.
    const parsed = SolutionBlueprintSchema.safeParse(stripNulls(raw));
    if (!parsed.success) {
      return JSON.stringify({
        error: 'Blueprint failed validation — fix and resend.',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code })),
      });
    }
    const blueprint = parsed.data;
    const actor = exec?.actor?.id;

    const drafted: Array<{ type: string; name: string }> = [];
    const failed: Array<{ type: string; name: string; error: string; code?: string }> = [];

    const record = async (type: string, name: string, item: unknown) => {
      const res = await stageDraft(ctx.protocol, { type, name, item, actor });
      if (res.ok) drafted.push({ type, name });
      else failed.push({ type, name, error: res.error ?? 'unknown error', ...(res.code ? { code: res.code } : {}) });
    };

    // Objects first (views/dashboards reference them).
    const columnsByObject = new Map<string, string[]>();
    for (const o of blueprint.objects ?? []) {
      columnsByObject.set(o.name, (o.fields ?? []).map((f) => f.name));
      await record('object', o.name, objectBody(o));
    }
    for (const v of blueprint.views ?? []) {
      await record('view', v.name, viewBody(v, columnsByObject));
    }
    for (const d of blueprint.dashboards ?? []) {
      await record('dashboard', d.name, dashboardBody(d));
    }
    // The app (navigation shell) is drafted last — it references everything above.
    if (blueprint.app) {
      await record('app', blueprint.app.name, appBody(blueprint.app, blueprint));
    }

    const seedDataProposed = (blueprint.seedData ?? []).map((s) => ({
      object: s.object,
      rows: s.records.length,
    }));

    const summaryParts = [`drafted ${drafted.length} artifact(s)`];
    if (failed.length) summaryParts.push(`${failed.length} failed`);
    if (seedDataProposed.length) summaryParts.push(`${seedDataProposed.length} seed set(s) proposed (not applied)`);

    return JSON.stringify({
      status: failed.length && !drafted.length ? 'failed' : 'drafted',
      drafted,
      failed,
      // Phase C does not auto-apply seed data — no runtime-draftable `dataset`
      // type exists; surface it so a human can wire it deliberately.
      seedDataProposed,
      summary:
        `${summaryParts.join(', ')}. Review the drafted items in the designer and publish to make them live.` +
        (seedDataProposed.length ? ' Seed data is suggested only — load it separately.' : ''),
    });
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/** Register the plan-first blueprint tools (`propose_blueprint`, `apply_blueprint`). */
export function registerBlueprintTools(registry: ToolRegistry, context: BlueprintToolContext): void {
  registry.register(proposeBlueprintTool, createProposeBlueprintHandler(context));
  registry.register(applyBlueprintTool, createApplyBlueprintHandler(context));
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SolutionBlueprintStrictSchema, type SolutionBlueprint } from '@objectstack/spec/ai';
import { ToolRegistry } from '../tools/tool-registry.js';
import {
  registerBlueprintTools,
  BLUEPRINT_TOOL_DEFINITIONS,
  type BlueprintToolContext,
} from '../tools/blueprint-tools.js';

// ── Helpers ────────────────────────────────────────────────────────

const SAMPLE_BLUEPRINT: SolutionBlueprint = {
  summary: 'A project tracker',
  assumptions: ['Projects own many tasks'],
  objects: [
    { name: 'project', label: 'Project', fields: [{ name: 'name', type: 'text', required: true }] },
    {
      name: 'task', label: 'Task',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'project_id', type: 'lookup', reference: 'project' },
      ],
    },
  ],
  views: [{ object: 'task', name: 'open_tasks', label: 'Open Tasks', type: 'list', columns: ['title'] }],
  seedData: [{ object: 'project', records: [{ name: 'Apollo' }, { name: 'Gemini' }] }],
};

/** Mock protocol with a draft store + saveMetaItem honoring mode:'draft'. */
function createMockProtocol(existingObjects: string[] = []) {
  const drafts = new Map<string, unknown>();
  const saveMetaItem = vi.fn(async (req: any) => {
    if (req.mode === 'draft') drafts.set(`${req.type}:${req.name}`, req.item);
    return { success: true };
  });
  const getMetaItems = vi.fn(async (_req: any) =>
    existingObjects.map((name) => ({ name, label: name })),
  );
  const getMetaItem = vi.fn(async () => ({ item: undefined }));
  const protocol = { getMetaItems, getMetaItem, saveMetaItem } as NonNullable<BlueprintToolContext['protocol']>;
  return { protocol, drafts, saveMetaItem, getMetaItems };
}

function createMockMetadataService() {
  return {
    register: vi.fn(async () => {}),
    get: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
    unregister: vi.fn(async () => {}),
    exists: vi.fn(async () => false),
    listNames: vi.fn(async () => []),
    getObject: vi.fn(async () => undefined),
    listObjects: vi.fn(async () => []),
  } as any;
}

/** Mock AI service whose generateObject returns a fixed blueprint. */
function createMockAi(blueprint: SolutionBlueprint = SAMPLE_BLUEPRINT) {
  const generateObject = vi.fn(async () => ({ object: blueprint, model: 'mock', usage: undefined }));
  return { ai: { generateObject } as any, generateObject };
}

function parse(result: any): any {
  return JSON.parse((result.output as any).value);
}

const call = (toolName: string, input: Record<string, unknown>, id = 't') => ({
  type: 'tool-call' as const,
  toolCallId: id,
  toolName,
  input,
});

// ═══════════════════════════════════════════════════════════════════
// Definitions & registration
// ═══════════════════════════════════════════════════════════════════

describe('Blueprint tool definitions', () => {
  it('defines exactly propose_blueprint + apply_blueprint', () => {
    expect(BLUEPRINT_TOOL_DEFINITIONS.map((t) => t.name)).toEqual(['propose_blueprint', 'apply_blueprint']);
  });

  it('registers both tools separately (so the model must take two turns)', () => {
    const registry = new ToolRegistry();
    registerBlueprintTools(registry, {
      ai: createMockAi().ai,
      protocol: createMockProtocol().protocol,
      metadataService: createMockMetadataService(),
    });
    expect(registry.has('propose_blueprint')).toBe(true);
    expect(registry.has('apply_blueprint')).toBe(true);
    expect(registry.size).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// propose_blueprint
// ═══════════════════════════════════════════════════════════════════

describe('propose_blueprint handler', () => {
  let registry: ToolRegistry;
  let saveMetaItem: ReturnType<typeof vi.fn>;
  let generateObject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registry = new ToolRegistry();
    const proto = createMockProtocol(['existing_obj']);
    const ai = createMockAi();
    saveMetaItem = proto.saveMetaItem;
    generateObject = ai.generateObject;
    registerBlueprintTools(registry, { ai: ai.ai, protocol: proto.protocol, metadataService: createMockMetadataService() });
  });

  it('returns a proposed blueprint and persists NOTHING', async () => {
    const parsed = parse(await registry.execute(call('propose_blueprint', { goal: 'build a project tracker' })));
    expect(parsed.status).toBe('blueprint_proposed');
    expect(parsed.blueprint.objects).toHaveLength(2);
    expect(parsed.counts).toEqual({ objects: 2, views: 1, dashboards: 0, app: 0, seedData: 1 });
    // Crucially: proposing creates no drafts.
    expect(saveMetaItem).not.toHaveBeenCalled();
    expect(generateObject).toHaveBeenCalledOnce();
  });

  it('includes existing object names in the model context', async () => {
    await registry.execute(call('propose_blueprint', { goal: 'extend the system' }));
    const messages = generateObject.mock.calls[0][0] as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain('existing_obj');
  });

  it('errors when goal is missing', async () => {
    const parsed = parse(await registry.execute(call('propose_blueprint', {})));
    expect(parsed.error).toContain('goal');
  });

  it('errors cleanly when the adapter lacks structured output', async () => {
    const registry2 = new ToolRegistry();
    registerBlueprintTools(registry2, {
      ai: { /* no generateObject */ } as any,
      protocol: createMockProtocol().protocol,
      metadataService: createMockMetadataService(),
    });
    const parsed = parse(await registry2.execute(call('propose_blueprint', { goal: 'x' })));
    expect(parsed.error).toContain('structured-output');
  });
});

// ═══════════════════════════════════════════════════════════════════
// apply_blueprint
// ═══════════════════════════════════════════════════════════════════

describe('apply_blueprint handler', () => {
  let registry: ToolRegistry;
  let drafts: Map<string, unknown>;
  let saveMetaItem: ReturnType<typeof vi.fn>;
  let metadataService: any;

  beforeEach(() => {
    registry = new ToolRegistry();
    const proto = createMockProtocol();
    drafts = proto.drafts;
    saveMetaItem = proto.saveMetaItem;
    metadataService = createMockMetadataService();
    registerBlueprintTools(registry, { ai: createMockAi().ai, protocol: proto.protocol, metadataService });
  });

  it('batch-drafts every object and view via mode:draft, never publishing', async () => {
    const parsed = parse(await registry.execute(call('apply_blueprint', { blueprint: SAMPLE_BLUEPRINT })));

    expect(parsed.status).toBe('drafted');
    expect(parsed.drafted).toEqual([
      { type: 'object', name: 'project' },
      { type: 'object', name: 'task' },
      { type: 'view', name: 'open_tasks' },
    ]);
    expect(parsed.failed).toEqual([]);

    // Every write was a draft; the live-publish path is never touched.
    for (const c of saveMetaItem.mock.calls) expect(c[0].mode).toBe('draft');
    expect(metadataService.register).not.toHaveBeenCalled();

    // Object body expanded fields into a record keyed by name.
    const task = drafts.get('object:task') as any;
    expect(task.fields.project_id).toMatchObject({ type: 'lookup', reference: 'project' });
    // View body became a list sub-view bound to the object.
    const view = drafts.get('view:open_tasks') as any;
    expect(view.list.data).toEqual({ provider: 'object', object: 'task' });
    expect(view.list.columns).toEqual(['title']);
  });

  it('reports seed data as proposed-but-not-applied', async () => {
    const parsed = parse(await registry.execute(call('apply_blueprint', { blueprint: SAMPLE_BLUEPRINT })));
    expect(parsed.seedDataProposed).toEqual([{ object: 'project', rows: 2 }]);
    // No draft was written for the seed (no 'dataset' type).
    expect(drafts.has('dataset:project')).toBe(false);
  });

  it('isolates a per-item failure — others still draft', async () => {
    // Make the view write fail, objects succeed.
    saveMetaItem.mockImplementation(async (req: any) => {
      if (req.type === 'view') {
        const e: any = new Error('[invalid_metadata] view/open_tasks failed spec validation');
        e.code = 'invalid_metadata';
        throw e;
      }
      return { success: true };
    });
    const parsed = parse(await registry.execute(call('apply_blueprint', { blueprint: SAMPLE_BLUEPRINT })));
    expect(parsed.drafted.map((d: any) => d.name)).toEqual(['project', 'task']);
    expect(parsed.failed).toHaveLength(1);
    expect(parsed.failed[0]).toMatchObject({ type: 'view', name: 'open_tasks', code: 'invalid_metadata' });
    // Partial success is still 'drafted' (some items landed).
    expect(parsed.status).toBe('drafted');
  });

  it('rejects a malformed blueprint with fixable issues (nothing drafted)', async () => {
    const parsed = parse(await registry.execute(call('apply_blueprint', {
      blueprint: { summary: 'bad', objects: [{ name: 'X', fields: [{ name: 'f', type: 'text' }] }] },
    })));
    expect(parsed.error).toContain('validation');
    expect(Array.isArray(parsed.issues)).toBe(true);
    expect(saveMetaItem).not.toHaveBeenCalled();
  });

  it('errors when blueprint is missing', async () => {
    const parsed = parse(await registry.execute(call('apply_blueprint', {})));
    expect(parsed.error).toContain('blueprint');
  });

  it('defaults view columns to the object fields when none are given', async () => {
    const bp: SolutionBlueprint = {
      summary: 'x',
      assumptions: [],
      objects: [{ name: 'lead', fields: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }] }],
      views: [{ object: 'lead', name: 'all_leads', type: 'list' }],
    };
    await registry.execute(call('apply_blueprint', { blueprint: bp }));
    const view = drafts.get('view:all_leads') as any;
    expect(view.list.columns).toEqual(['name', 'email']);
  });

  it('drafts the app (navigation shell) with explicit nav referencing the objects', async () => {
    const bp: SolutionBlueprint = {
      ...SAMPLE_BLUEPRINT,
      app: {
        name: 'project_mgmt',
        label: 'Project Management',
        icon: 'kanban',
        nav: [
          { type: 'object', target: 'project', label: 'Projects' },
          { type: 'object', target: 'task' },
        ],
      },
    };
    const parsed = parse(await registry.execute(call('apply_blueprint', { blueprint: bp })));
    expect(parsed.drafted).toContainEqual({ type: 'app', name: 'project_mgmt' });
    expect(saveMetaItem).toHaveBeenCalledWith(expect.objectContaining({ type: 'app', mode: 'draft' }));

    const app = drafts.get('app:project_mgmt') as any;
    expect(app.label).toBe('Project Management');
    expect(app.icon).toBe('kanban');
    expect(app.isDefault).toBeUndefined(); // never hijack the default app
    expect(app.navigation).toEqual([
      { id: 'nav_project', label: 'Projects', order: 0, type: 'object', objectName: 'project' },
      { id: 'nav_task', label: 'task', order: 1, type: 'object', objectName: 'task' },
    ]);
  });

  it('auto-surfaces every object then dashboard when app.nav is omitted', async () => {
    const bp: SolutionBlueprint = {
      summary: 'crm',
      assumptions: [],
      objects: [
        { name: 'account', label: 'Account', fields: [{ name: 'name', type: 'text' }] },
        { name: 'contact', label: 'Contact', fields: [{ name: 'name', type: 'text' }] },
      ],
      dashboards: [{ name: 'sales', label: 'Sales', widgets: [] }],
      app: { name: 'crm', label: 'CRM' },
    };
    await registry.execute(call('apply_blueprint', { blueprint: bp }));
    const app = drafts.get('app:crm') as any;
    expect(app.navigation).toEqual([
      { id: 'nav_account', label: 'Account', order: 0, type: 'object', objectName: 'account' },
      { id: 'nav_contact', label: 'Contact', order: 1, type: 'object', objectName: 'contact' },
      { id: 'nav_sales', label: 'Sales', order: 2, type: 'dashboard', dashboardName: 'sales' },
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// OpenAI strict structured outputs (live-verified bug: optional fields made
// OpenAI reject the schema; the model emits null for "empty" fields)
// ═══════════════════════════════════════════════════════════════════

describe('blueprint ⨯ OpenAI strict structured outputs', () => {
  // A blueprint shaped like the strict mirror's output: every optional field
  // present as `null` rather than absent.
  const bpWithNulls: any = {
    summary: 's',
    assumptions: [],
    questions: null,
    objects: [
      {
        name: 'project',
        label: 'Project',
        description: null,
        fields: [
          { name: 'name', label: null, type: 'text', required: null, reference: null, options: null },
        ],
      },
    ],
    views: null,
    dashboards: null,
    app: null,
  };

  it('propose_blueprint uses the strict mirror schema and strips the model\'s nulls', async () => {
    const registry = new ToolRegistry();
    const generateObject = vi.fn(async () => ({ object: bpWithNulls, model: 'mock', usage: undefined }));
    registerBlueprintTools(registry, {
      ai: { generateObject } as any,
      protocol: createMockProtocol().protocol,
      metadataService: createMockMetadataService(),
    });

    const parsed = parse(await registry.execute(call('propose_blueprint', { goal: 'x' })));

    // The OpenAI-strict mirror is the output contract sent to generateObject.
    expect((generateObject.mock.calls[0] as unknown[])[1]).toBe(SolutionBlueprintStrictSchema);
    // Nulls are stripped so the result conforms to the lenient schema.
    expect(parsed.status).toBe('blueprint_proposed');
    expect(parsed.blueprint.objects[0].description).toBeUndefined();
    expect(parsed.blueprint.objects[0].fields[0].label).toBeUndefined();
    expect(parsed.blueprint.views).toBeUndefined();
    expect(parsed.blueprint.app).toBeUndefined();
  });

  it('apply_blueprint tolerates a blueprint carrying nulls (strips before validating)', async () => {
    const registry = new ToolRegistry();
    const proto = createMockProtocol();
    registerBlueprintTools(registry, {
      ai: createMockAi().ai,
      protocol: proto.protocol,
      metadataService: createMockMetadataService(),
    });

    const parsed = parse(await registry.execute(call('apply_blueprint', { blueprint: bpWithNulls })));
    expect(parsed.status).toBe('drafted');
    expect(parsed.drafted).toEqual([{ type: 'object', name: 'project' }]);
    // null field props were stripped, not persisted as null
    const project = proto.drafts.get('object:project') as any;
    expect(project.fields.name).toEqual({ type: 'text' });
  });
});

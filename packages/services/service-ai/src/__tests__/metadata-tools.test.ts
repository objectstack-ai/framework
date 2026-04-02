// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMetadataService } from '@objectstack/spec/contracts';
import { ToolRegistry } from '../tools/tool-registry.js';
import {
  registerMetadataTools,
  METADATA_TOOL_DEFINITIONS,
} from '../tools/metadata-tools.js';
import {
  registerDataTools,
} from '../tools/data-tools.js';
import type { MetadataToolContext } from '../tools/metadata-tools.js';

// Individual tool metadata imports
import { createObjectTool } from '../tools/create-object.tool.js';
import { addFieldTool } from '../tools/add-field.tool.js';
import { modifyFieldTool } from '../tools/modify-field.tool.js';
import { deleteFieldTool } from '../tools/delete-field.tool.js';
import { listMetadataObjectsTool } from '../tools/list-metadata-objects.tool.js';
import { describeMetadataObjectTool } from '../tools/describe-metadata-object.tool.js';

// ── Helpers ────────────────────────────────────────────────────────

/** Build a mock IMetadataService with optionally pre-loaded objects. */
function createMockMetadataService(
  objects: Record<string, any> = {},
  overrides: Partial<IMetadataService> = {},
): IMetadataService {
  // Keep a mutable store so handlers can modify it
  const store: Record<string, any> = { ...objects };

  return {
    register: vi.fn(async (_type: string, name: string, data: unknown) => {
      store[name] = data;
    }),
    get: vi.fn(async (_type: string, name: string) => store[name] ?? undefined),
    list: vi.fn(async () => Object.values(store)),
    unregister: vi.fn(async (_type: string, name: string) => {
      delete store[name];
    }),
    exists: vi.fn(async (_type: string, name: string) => name in store),
    listNames: vi.fn(async () => Object.keys(store)),
    getObject: vi.fn(async (name: string) => store[name] ?? undefined),
    listObjects: vi.fn(async () => Object.values(store)),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Metadata Tool Definitions
// ═══════════════════════════════════════════════════════════════════

describe('Metadata Tool Definitions', () => {
  it('should define exactly 6 tools', () => {
    expect(METADATA_TOOL_DEFINITIONS).toHaveLength(6);
  });

  it('should include all expected tool names', () => {
    const names = METADATA_TOOL_DEFINITIONS.map(t => t.name);
    expect(names).toEqual([
      'create_object',
      'add_field',
      'modify_field',
      'delete_field',
      'list_metadata_objects',
      'describe_metadata_object',
    ]);
  });

  it('should have descriptions and parameters for each tool', () => {
    for (const def of METADATA_TOOL_DEFINITIONS) {
      expect(def.description).toBeTruthy();
      expect(def.parameters).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Individual Tool Metadata Files (.tool.ts)
// ═══════════════════════════════════════════════════════════════════

describe('Individual Tool Metadata (.tool.ts)', () => {
  const tools = [
    { tool: createObjectTool, expectedName: 'create_object', expectedLabel: 'Create Object' },
    { tool: addFieldTool, expectedName: 'add_field', expectedLabel: 'Add Field' },
    { tool: modifyFieldTool, expectedName: 'modify_field', expectedLabel: 'Modify Field' },
    { tool: deleteFieldTool, expectedName: 'delete_field', expectedLabel: 'Delete Field' },
    { tool: listMetadataObjectsTool, expectedName: 'list_metadata_objects', expectedLabel: 'List Metadata Objects' },
    { tool: describeMetadataObjectTool, expectedName: 'describe_metadata_object', expectedLabel: 'Describe Metadata Object' },
  ];

  for (const { tool, expectedName, expectedLabel } of tools) {
    describe(expectedName, () => {
      it('should have correct name', () => {
        expect(tool.name).toBe(expectedName);
      });

      it('should have a label', () => {
        expect(tool.label).toBe(expectedLabel);
      });

      it('should be categorized as data', () => {
        expect(tool.category).toBe('data');
      });

      it('should be marked as built-in', () => {
        expect(tool.builtIn).toBe(true);
      });

      it('should have a description', () => {
        expect(tool.description).toBeTruthy();
      });

      it('should have parameters schema', () => {
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters.type).toBe('object');
      });

      it('should be included in METADATA_TOOL_DEFINITIONS', () => {
        expect(METADATA_TOOL_DEFINITIONS).toContain(tool);
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// registerMetadataTools + Handlers
// ═══════════════════════════════════════════════════════════════════

describe('registerMetadataTools', () => {
  let registry: ToolRegistry;
  let metadataService: IMetadataService;

  beforeEach(() => {
    registry = new ToolRegistry();
    metadataService = createMockMetadataService();
    registerMetadataTools(registry, { metadataService });
  });

  it('should register all 6 tools', () => {
    expect(registry.size).toBe(6);
    expect(registry.has('create_object')).toBe(true);
    expect(registry.has('add_field')).toBe(true);
    expect(registry.has('modify_field')).toBe(true);
    expect(registry.has('delete_field')).toBe(true);
    expect(registry.has('list_metadata_objects')).toBe(true);
    expect(registry.has('describe_metadata_object')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Dual registration (data tools + metadata tools)
// ═══════════════════════════════════════════════════════════════════

describe('registerDataTools + registerMetadataTools — no collision', () => {
  it('should register both tool sets on the same registry without overwriting', () => {
    const registry = new ToolRegistry();
    const metadataService = createMockMetadataService();
    const dataEngine = {
      find: vi.fn(),
      findOne: vi.fn(),
      aggregate: vi.fn(),
    } as any;

    registerDataTools(registry, { dataEngine, metadataService });
    const sizeAfterData = registry.size;

    registerMetadataTools(registry, { metadataService });
    const sizeAfterBoth = registry.size;

    // Data tools define: list_objects, describe_object, query_records, get_record, aggregate_data
    // Metadata tools define: create_object, add_field, modify_field, delete_field, list_metadata_objects, describe_metadata_object
    // No overlap — total should be sum of both
    expect(sizeAfterBoth).toBe(sizeAfterData + 6);

    // Data tools should still be present
    expect(registry.has('list_objects')).toBe(true);
    expect(registry.has('describe_object')).toBe(true);
    expect(registry.has('query_records')).toBe(true);

    // Metadata tools should also be present with distinct names
    expect(registry.has('list_metadata_objects')).toBe(true);
    expect(registry.has('describe_metadata_object')).toBe(true);
    expect(registry.has('create_object')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// create_object handler
// ═══════════════════════════════════════════════════════════════════

describe('create_object handler', () => {
  let registry: ToolRegistry;
  let metadataService: IMetadataService;

  beforeEach(() => {
    registry = new ToolRegistry();
    metadataService = createMockMetadataService();
    registerMetadataTools(registry, { metadataService });
  });

  it('should create object with name and label', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c1',
      toolName: 'create_object',
      input: { name: 'project', label: 'Project' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.name).toBe('project');
    expect(parsed.label).toBe('Project');
    expect(parsed.fieldCount).toBe(0);
    expect(metadataService.register).toHaveBeenCalledWith(
      'object',
      'project',
      expect.objectContaining({ name: 'project', label: 'Project' }),
    );
  });

  it('should create object with initial fields', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c2',
      toolName: 'create_object',
      input: {
        name: 'task',
        label: 'Task',
        fields: [
          { name: 'title', type: 'text', label: 'Title', required: true },
          { name: 'status', type: 'select' },
        ],
      },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.name).toBe('task');
    expect(parsed.fieldCount).toBe(2);
    expect(metadataService.register).toHaveBeenCalledWith(
      'object',
      'task',
      expect.objectContaining({
        fields: {
          title: { type: 'text', label: 'Title', required: true },
          status: { type: 'select' },
        },
      }),
    );
  });

  it('should create object with enableFeatures', async () => {
    await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c3',
      toolName: 'create_object',
      input: {
        name: 'account',
        label: 'Account',
        enableFeatures: { trackHistory: true, apiEnabled: true },
      },
    });

    expect(metadataService.register).toHaveBeenCalledWith(
      'object',
      'account',
      expect.objectContaining({
        enable: { trackHistory: true, apiEnabled: true },
      }),
    );
  });

  it('should reject invalid snake_case name', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c4',
      toolName: 'create_object',
      input: { name: 'MyProject', label: 'My Project' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('snake_case');
    expect(metadataService.register).not.toHaveBeenCalled();
  });

  it('should reject duplicate object names', async () => {
    // Pre-populate the store
    metadataService = createMockMetadataService({
      project: { name: 'project', label: 'Project' },
    });
    registry = new ToolRegistry();
    registerMetadataTools(registry, { metadataService });

    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c5',
      toolName: 'create_object',
      input: { name: 'project', label: 'Project v2' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('already exists');
  });

  it('should return error when name or label is missing', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c6',
      toolName: 'create_object',
      input: { name: 'project' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('required');
  });

  it('should reject fields with invalid snake_case names', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c7',
      toolName: 'create_object',
      input: {
        name: 'project',
        label: 'Project',
        fields: [
          { name: 'ValidField', type: 'text' },
        ],
      },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('snake_case');
    expect(metadataService.register).not.toHaveBeenCalled();
  });

  it('should reject fields with duplicate names', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c8',
      toolName: 'create_object',
      input: {
        name: 'project',
        label: 'Project',
        fields: [
          { name: 'status', type: 'text' },
          { name: 'status', type: 'select' },
        ],
      },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('Duplicate');
    expect(metadataService.register).not.toHaveBeenCalled();
  });

  it('should reject fields with missing name', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c9',
      toolName: 'create_object',
      input: {
        name: 'project',
        label: 'Project',
        fields: [
          { type: 'text' },
        ],
      },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toBeTruthy();
    expect(metadataService.register).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// add_field handler
// ═══════════════════════════════════════════════════════════════════

describe('add_field handler', () => {
  let registry: ToolRegistry;
  let metadataService: IMetadataService;

  beforeEach(() => {
    metadataService = createMockMetadataService({
      project: { name: 'project', label: 'Project', fields: {} },
    });
    registry = new ToolRegistry();
    registerMetadataTools(registry, { metadataService });
  });

  it('should add a field to an existing object', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c1',
      toolName: 'add_field',
      input: { objectName: 'project', name: 'due_date', type: 'date', label: 'Due Date' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.objectName).toBe('project');
    expect(parsed.fieldName).toBe('due_date');
    expect(parsed.fieldType).toBe('date');
    expect(metadataService.register).toHaveBeenCalledWith(
      'object',
      'project',
      expect.objectContaining({
        fields: expect.objectContaining({
          due_date: expect.objectContaining({ type: 'date', label: 'Due Date' }),
        }),
      }),
    );
  });

  it('should add a field with options (select type)', async () => {
    await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c2',
      toolName: 'add_field',
      input: {
        objectName: 'project',
        name: 'priority',
        type: 'select',
        options: [
          { label: 'Low', value: 'low' },
          { label: 'High', value: 'high' },
        ],
      },
    });

    expect(metadataService.register).toHaveBeenCalledWith(
      'object',
      'project',
      expect.objectContaining({
        fields: expect.objectContaining({
          priority: expect.objectContaining({
            type: 'select',
            options: [{ label: 'Low', value: 'low' }, { label: 'High', value: 'high' }],
          }),
        }),
      }),
    );
  });

  it('should reject adding field to non-existent object', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c3',
      toolName: 'add_field',
      input: { objectName: 'nonexistent', name: 'field_a', type: 'text' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('not found');
  });

  it('should reject duplicate field name', async () => {
    // Add the field first
    await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c4a',
      toolName: 'add_field',
      input: { objectName: 'project', name: 'status', type: 'text' },
    });

    // Try to add the same field again
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c4b',
      toolName: 'add_field',
      input: { objectName: 'project', name: 'status', type: 'select' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('already exists');
  });

  it('should reject invalid field name', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c5',
      toolName: 'add_field',
      input: { objectName: 'project', name: 'MyField', type: 'text' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('snake_case');
  });

  it('should reject invalid objectName (not snake_case)', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c6',
      toolName: 'add_field',
      input: { objectName: 'MyProject', name: 'status', type: 'text' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('snake_case');
  });

  it('should accept reference as a string (not object)', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c7',
      toolName: 'add_field',
      input: { objectName: 'project', name: 'account_id', type: 'lookup', reference: 'account' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.fieldName).toBe('account_id');
    expect(metadataService.register).toHaveBeenCalledWith(
      'object',
      'project',
      expect.objectContaining({
        fields: expect.objectContaining({
          account_id: expect.objectContaining({ type: 'lookup', reference: 'account' }),
        }),
      }),
    );
  });

  it('should reject invalid reference (not snake_case)', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c8',
      toolName: 'add_field',
      input: { objectName: 'project', name: 'account_id', type: 'lookup', reference: 'MyAccount' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('snake_case');
  });

  it('should reject invalid select option values (not snake_case)', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c9',
      toolName: 'add_field',
      input: {
        objectName: 'project',
        name: 'priority',
        type: 'select',
        options: [
          { label: 'High Priority', value: 'HighPriority' },
        ],
      },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('snake_case');
  });
});

// ═══════════════════════════════════════════════════════════════════
// modify_field handler
// ═══════════════════════════════════════════════════════════════════

describe('modify_field handler', () => {
  let registry: ToolRegistry;
  let metadataService: IMetadataService;

  beforeEach(() => {
    metadataService = createMockMetadataService({
      project: {
        name: 'project',
        label: 'Project',
        fields: {
          status: { type: 'text', label: 'Status', required: false },
          budget: { type: 'number', label: 'Budget' },
        },
      },
    });
    registry = new ToolRegistry();
    registerMetadataTools(registry, { metadataService });
  });

  it('should modify field label', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c1',
      toolName: 'modify_field',
      input: {
        objectName: 'project',
        fieldName: 'status',
        changes: { label: 'Project Status' },
      },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.objectName).toBe('project');
    expect(parsed.fieldName).toBe('status');
    expect(parsed.updatedProperties).toEqual(['label']);
  });

  it('should modify multiple field properties', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c2',
      toolName: 'modify_field',
      input: {
        objectName: 'project',
        fieldName: 'status',
        changes: { label: 'Project Status', required: true },
      },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.updatedProperties).toEqual(expect.arrayContaining(['label', 'required']));
  });

  it('should return error for non-existent object', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c3',
      toolName: 'modify_field',
      input: {
        objectName: 'nonexistent',
        fieldName: 'status',
        changes: { label: 'New' },
      },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('not found');
  });

  it('should return error for non-existent field', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c4',
      toolName: 'modify_field',
      input: {
        objectName: 'project',
        fieldName: 'nonexistent_field',
        changes: { label: 'New' },
      },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('not found');
  });
});

// ═══════════════════════════════════════════════════════════════════
// delete_field handler
// ═══════════════════════════════════════════════════════════════════

describe('delete_field handler', () => {
  let registry: ToolRegistry;
  let metadataService: IMetadataService;

  beforeEach(() => {
    metadataService = createMockMetadataService({
      project: {
        name: 'project',
        label: 'Project',
        fields: {
          status: { type: 'text', label: 'Status' },
          budget: { type: 'number', label: 'Budget' },
        },
      },
    });
    registry = new ToolRegistry();
    registerMetadataTools(registry, { metadataService });
  });

  it('should delete a field from an object', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c1',
      toolName: 'delete_field',
      input: { objectName: 'project', fieldName: 'budget' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.objectName).toBe('project');
    expect(parsed.fieldName).toBe('budget');
    expect(parsed.success).toBe(true);

    // Verify the field was removed from the re-registered object
    expect(metadataService.register).toHaveBeenCalledWith(
      'object',
      'project',
      expect.objectContaining({
        fields: expect.not.objectContaining({ budget: expect.anything() }),
      }),
    );
  });

  it('should return error for non-existent object', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c2',
      toolName: 'delete_field',
      input: { objectName: 'nonexistent', fieldName: 'status' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('not found');
  });

  it('should return error for non-existent field', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c3',
      toolName: 'delete_field',
      input: { objectName: 'project', fieldName: 'nonexistent_field' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('not found');
  });
});

// ═══════════════════════════════════════════════════════════════════
// list_metadata_objects handler
// ═══════════════════════════════════════════════════════════════════

describe('list_metadata_objects handler', () => {
  let registry: ToolRegistry;
  let metadataService: IMetadataService;

  beforeEach(() => {
    metadataService = createMockMetadataService({
      account: { name: 'account', label: 'Account', fields: { name: { type: 'text' } } },
      contact: { name: 'contact', label: 'Contact', fields: { email: { type: 'text' }, phone: { type: 'text' } } },
    });
    registry = new ToolRegistry();
    registerMetadataTools(registry, { metadataService });
  });

  it('should list all objects with name, label, and field count', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c1',
      toolName: 'list_metadata_objects',
      input: {},
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.totalCount).toBe(2);
    expect(parsed.objects).toHaveLength(2);
    expect(parsed.objects[0]).toEqual(expect.objectContaining({ name: 'account', label: 'Account', fieldCount: 1 }));
    expect(parsed.objects[1]).toEqual(expect.objectContaining({ name: 'contact', label: 'Contact', fieldCount: 2 }));
  });

  it('should filter objects by name/label substring', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c2',
      toolName: 'list_metadata_objects',
      input: { filter: 'account' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.totalCount).toBe(1);
    expect(parsed.objects[0].name).toBe('account');
  });

  it('should include field summaries when includeFields is true', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c3',
      toolName: 'list_metadata_objects',
      input: { includeFields: true },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.objects[0].fields).toBeDefined();
    expect(parsed.objects[0].fields).toHaveLength(1);
  });

  it('should return empty list when no objects exist', async () => {
    metadataService = createMockMetadataService({});
    registry = new ToolRegistry();
    registerMetadataTools(registry, { metadataService });

    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c4',
      toolName: 'list_metadata_objects',
      input: {},
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.totalCount).toBe(0);
    expect(parsed.objects).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// describe_metadata_object handler
// ═══════════════════════════════════════════════════════════════════

describe('describe_metadata_object handler', () => {
  let registry: ToolRegistry;
  let metadataService: IMetadataService;

  beforeEach(() => {
    metadataService = createMockMetadataService({
      account: {
        name: 'account',
        label: 'Account',
        fields: {
          name: { type: 'text', label: 'Account Name', required: true },
          revenue: { type: 'number', label: 'Revenue' },
          industry: { type: 'select', label: 'Industry', options: ['Tech', 'Finance'] },
        },
        enable: { trackHistory: true, apiEnabled: true },
      },
    });
    registry = new ToolRegistry();
    registerMetadataTools(registry, { metadataService });
  });

  it('should return full schema details with field array', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c1',
      toolName: 'describe_metadata_object',
      input: { objectName: 'account' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.name).toBe('account');
    expect(parsed.label).toBe('Account');
    expect(parsed.fields).toHaveLength(3);
    expect(parsed.enableFeatures).toEqual({ trackHistory: true, apiEnabled: true });

    const nameField = parsed.fields.find((f: any) => f.name === 'name');
    expect(nameField.type).toBe('text');
    expect(nameField.required).toBe(true);

    const industryField = parsed.fields.find((f: any) => f.name === 'industry');
    expect(industryField.options).toEqual(['Tech', 'Finance']);
  });

  it('should return error for unknown object', async () => {
    const result = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 'c2',
      toolName: 'describe_metadata_object',
      input: { objectName: 'nonexistent' },
    });

    const parsed = JSON.parse((result.output as any).value);
    expect(parsed.error).toContain('not found');
  });
});

// ═══════════════════════════════════════════════════════════════════
// End-to-End: full lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('Metadata Tools — full lifecycle', () => {
  let registry: ToolRegistry;
  let metadataService: IMetadataService;

  beforeEach(() => {
    metadataService = createMockMetadataService();
    registry = new ToolRegistry();
    registerMetadataTools(registry, { metadataService });
  });

  it('should support create → add_field → describe → modify → delete lifecycle', async () => {
    // 1. Create object
    await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 's1',
      toolName: 'create_object',
      input: { name: 'invoice', label: 'Invoice' },
    });

    // 2. Add fields
    await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 's2',
      toolName: 'add_field',
      input: { objectName: 'invoice', name: 'amount', type: 'number', label: 'Amount' },
    });

    await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 's3',
      toolName: 'add_field',
      input: { objectName: 'invoice', name: 'status', type: 'text', label: 'Status' },
    });

    // 3. Describe — should show both fields
    const descResult = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 's4',
      toolName: 'describe_metadata_object',
      input: { objectName: 'invoice' },
    });
    const desc = JSON.parse((descResult.output as any).value);
    expect(desc.fields).toHaveLength(2);

    // 4. Modify field
    await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 's5',
      toolName: 'modify_field',
      input: {
        objectName: 'invoice',
        fieldName: 'status',
        changes: { type: 'select', label: 'Invoice Status' },
      },
    });

    // 5. Delete field
    const delResult = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 's6',
      toolName: 'delete_field',
      input: { objectName: 'invoice', fieldName: 'amount' },
    });
    const del = JSON.parse((delResult.output as any).value);
    expect(del.success).toBe(true);

    // 6. Describe again — should show only 1 field (status, modified)
    const descResult2 = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 's7',
      toolName: 'describe_metadata_object',
      input: { objectName: 'invoice' },
    });
    const desc2 = JSON.parse((descResult2.output as any).value);
    expect(desc2.fields).toHaveLength(1);
    expect(desc2.fields[0].name).toBe('status');
    expect(desc2.fields[0].type).toBe('select');
    expect(desc2.fields[0].label).toBe('Invoice Status');

    // 7. List objects — should show the invoice
    const listResult = await registry.execute({
      type: 'tool-call' as const,
      toolCallId: 's8',
      toolName: 'list_metadata_objects',
      input: {},
    });
    const list = JSON.parse((listResult.output as any).value);
    expect(list.totalCount).toBe(1);
    expect(list.objects[0].name).toBe('invoice');
  });
});

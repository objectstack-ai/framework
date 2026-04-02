import { describe, it, expect } from 'vitest';
import {
  createObjectTool,
  addFieldTool,
  modifyFieldTool,
  deleteFieldTool,
  listObjectsTool,
  describeObjectTool,
  METADATA_TOOLS,
  METADATA_TOOL_NAMES,
} from './metadata-tools.zod';
import { ToolSchema } from './tool.zod';

describe('Metadata Tools — individual definitions', () => {
  it('create_object should have correct structure', () => {
    expect(createObjectTool.name).toBe('create_object');
    expect(createObjectTool.label).toBe('Create Object');
    expect(createObjectTool.category).toBe('action');
    expect(createObjectTool.builtIn).toBe(true);
    expect(createObjectTool.requiresConfirmation).toBe(true);
    expect(createObjectTool.permissions).toContain('metadata.object.create');
    expect(createObjectTool.parameters).toHaveProperty('required');
    expect((createObjectTool.parameters as Record<string, unknown>).required).toContain('name');
    expect((createObjectTool.parameters as Record<string, unknown>).required).toContain('label');
  });

  it('add_field should have correct structure', () => {
    expect(addFieldTool.name).toBe('add_field');
    expect(addFieldTool.label).toBe('Add Field');
    expect(addFieldTool.category).toBe('action');
    expect(addFieldTool.builtIn).toBe(true);
    expect(addFieldTool.requiresConfirmation).toBe(true);
    expect(addFieldTool.permissions).toContain('metadata.field.create');
    expect((addFieldTool.parameters as Record<string, unknown>).required).toContain('objectName');
    expect((addFieldTool.parameters as Record<string, unknown>).required).toContain('name');
    expect((addFieldTool.parameters as Record<string, unknown>).required).toContain('type');
  });

  it('modify_field should have correct structure', () => {
    expect(modifyFieldTool.name).toBe('modify_field');
    expect(modifyFieldTool.label).toBe('Modify Field');
    expect(modifyFieldTool.category).toBe('action');
    expect(modifyFieldTool.builtIn).toBe(true);
    expect(modifyFieldTool.requiresConfirmation).toBe(true);
    expect(modifyFieldTool.permissions).toContain('metadata.field.update');
    expect((modifyFieldTool.parameters as Record<string, unknown>).required).toContain('objectName');
    expect((modifyFieldTool.parameters as Record<string, unknown>).required).toContain('fieldName');
    expect((modifyFieldTool.parameters as Record<string, unknown>).required).toContain('changes');
  });

  it('delete_field should have correct structure', () => {
    expect(deleteFieldTool.name).toBe('delete_field');
    expect(deleteFieldTool.label).toBe('Delete Field');
    expect(deleteFieldTool.category).toBe('action');
    expect(deleteFieldTool.builtIn).toBe(true);
    expect(deleteFieldTool.requiresConfirmation).toBe(true);
    expect(deleteFieldTool.permissions).toContain('metadata.field.delete');
    expect((deleteFieldTool.parameters as Record<string, unknown>).required).toContain('objectName');
    expect((deleteFieldTool.parameters as Record<string, unknown>).required).toContain('fieldName');
  });

  it('list_objects should have correct structure', () => {
    expect(listObjectsTool.name).toBe('list_objects');
    expect(listObjectsTool.label).toBe('List Objects');
    expect(listObjectsTool.category).toBe('data');
    expect(listObjectsTool.builtIn).toBe(true);
    expect(listObjectsTool.requiresConfirmation).toBe(false);
    expect(listObjectsTool.permissions).toContain('metadata.object.read');
  });

  it('describe_object should have correct structure', () => {
    expect(describeObjectTool.name).toBe('describe_object');
    expect(describeObjectTool.label).toBe('Describe Object');
    expect(describeObjectTool.category).toBe('data');
    expect(describeObjectTool.builtIn).toBe(true);
    expect(describeObjectTool.requiresConfirmation).toBe(false);
    expect(describeObjectTool.permissions).toContain('metadata.object.read');
    expect((describeObjectTool.parameters as Record<string, unknown>).required).toContain('objectName');
  });
});

describe('Metadata Tools — schema validation', () => {
  it('every tool should pass ToolSchema validation', () => {
    METADATA_TOOLS.forEach(tool => {
      expect(() => ToolSchema.parse(tool)).not.toThrow();
    });
  });

  it('every tool should have a description for LLM consumption', () => {
    METADATA_TOOLS.forEach(tool => {
      expect(tool.description.length).toBeGreaterThan(20);
    });
  });

  it('every tool should have parameters as a JSON Schema object', () => {
    METADATA_TOOLS.forEach(tool => {
      expect(tool.parameters).toHaveProperty('type', 'object');
      expect(tool.parameters).toHaveProperty('properties');
    });
  });

  it('every tool should have an outputSchema', () => {
    METADATA_TOOLS.forEach(tool => {
      expect(tool.outputSchema).toBeDefined();
      expect(tool.outputSchema).toHaveProperty('type', 'object');
    });
  });

  it('every tool should have permissions defined', () => {
    METADATA_TOOLS.forEach(tool => {
      expect(tool.permissions).toBeDefined();
      expect(tool.permissions!.length).toBeGreaterThan(0);
    });
  });

  it('every tool should be marked as builtIn', () => {
    METADATA_TOOLS.forEach(tool => {
      expect(tool.builtIn).toBe(true);
    });
  });

  it('write tools should require confirmation, read tools should not', () => {
    const writeTools = [createObjectTool, addFieldTool, modifyFieldTool, deleteFieldTool];
    const readTools = [listObjectsTool, describeObjectTool];

    writeTools.forEach(tool => {
      expect(tool.requiresConfirmation).toBe(true);
    });
    readTools.forEach(tool => {
      expect(tool.requiresConfirmation).toBe(false);
    });
  });
});

describe('METADATA_TOOLS aggregate', () => {
  it('should contain exactly 6 tools', () => {
    expect(METADATA_TOOLS).toHaveLength(6);
  });

  it('should match METADATA_TOOL_NAMES ordering', () => {
    METADATA_TOOLS.forEach((tool, index) => {
      expect(tool.name).toBe(METADATA_TOOL_NAMES[index]);
    });
  });

  it('METADATA_TOOL_NAMES should contain all expected names', () => {
    expect(METADATA_TOOL_NAMES).toEqual([
      'create_object',
      'add_field',
      'modify_field',
      'delete_field',
      'list_objects',
      'describe_object',
    ]);
  });

  it('every tool name should follow snake_case convention', () => {
    METADATA_TOOL_NAMES.forEach(name => {
      expect(name).toMatch(/^[a-z_][a-z0-9_]*$/);
    });
  });
});

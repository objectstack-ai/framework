import { describe, it, expect } from 'vitest';
import {
  ToolSchema,
  ToolCategorySchema,
  defineTool,
  type Tool,
} from './tool.zod';

describe('ToolCategorySchema', () => {
  it('should accept all tool categories', () => {
    const categories = ['data', 'action', 'flow', 'integration', 'vector_search', 'analytics', 'utility'] as const;

    categories.forEach(category => {
      expect(ToolCategorySchema.parse(category)).toBe(category);
    });
  });

  it('should reject invalid category', () => {
    expect(() => ToolCategorySchema.parse('unknown')).toThrow();
  });
});

describe('ToolSchema', () => {
  it('should accept minimal tool', () => {
    const tool: Tool = {
      name: 'list_records',
      label: 'List Records',
      description: 'List records from a data object',
      parameters: {
        type: 'object',
        properties: {
          objectName: { type: 'string' },
        },
        required: ['objectName'],
      },
    };

    const result = ToolSchema.parse(tool);
    expect(result.name).toBe('list_records');
    expect(result.active).toBe(true);
    expect(result.builtIn).toBe(false);
    expect(result.requiresConfirmation).toBe(false);
  });

  it('should accept full tool', () => {
    const tool = {
      name: 'create_case',
      label: 'Create Support Case',
      description: 'Creates a new support case record',
      category: 'action' as const,
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Case subject' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['subject'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          caseNumber: { type: 'string' },
        },
      },
      objectName: 'support_case',
      requiresConfirmation: true,
      permissions: ['case.create', 'support.agent'],
      active: true,
      builtIn: false,
    };

    const result = ToolSchema.parse(tool);
    expect(result.name).toBe('create_case');
    expect(result.category).toBe('action');
    expect(result.objectName).toBe('support_case');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.permissions).toEqual(['case.create', 'support.agent']);
  });

  it('should enforce snake_case for tool name', () => {
    const validNames = ['list_records', 'create_case', '_internal_tool', 'query_orders'];
    validNames.forEach(name => {
      expect(() => ToolSchema.parse({
        name,
        label: 'Test',
        description: 'Test',
        parameters: {},
      })).not.toThrow();
    });

    const invalidNames = ['listRecords', 'Create-Case', '123tool'];
    invalidNames.forEach(name => {
      expect(() => ToolSchema.parse({
        name,
        label: 'Test',
        description: 'Test',
        parameters: {},
      })).toThrow();
    });
  });

  it('should enforce snake_case for objectName', () => {
    expect(() => ToolSchema.parse({
      name: 'test_tool',
      label: 'Test',
      description: 'Test',
      parameters: {},
      objectName: 'supportCase',
    })).toThrow();

    expect(() => ToolSchema.parse({
      name: 'test_tool',
      label: 'Test',
      description: 'Test',
      parameters: {},
      objectName: 'support_case',
    })).not.toThrow();
  });

  it('should accept built-in tool flag', () => {
    const tool = ToolSchema.parse({
      name: 'describe_object',
      label: 'Describe Object',
      description: 'Get object schema and field metadata',
      parameters: { type: 'object', properties: { objectName: { type: 'string' } } },
      builtIn: true,
    });
    expect(tool.builtIn).toBe(true);
  });
});

describe('defineTool', () => {
  it('should return a parsed tool', () => {
    const tool = defineTool({
      name: 'query_records',
      label: 'Query Records',
      description: 'Search and filter records',
      category: 'data',
      parameters: {
        type: 'object',
        properties: {
          objectName: { type: 'string' },
          filters: { type: 'object' },
        },
        required: ['objectName'],
      },
    });

    expect(tool.name).toBe('query_records');
    expect(tool.category).toBe('data');
    expect(tool.active).toBe(true);
  });

  it('should apply defaults', () => {
    const tool = defineTool({
      name: 'simple_tool',
      label: 'Simple Tool',
      description: 'A simple tool',
      parameters: {},
    });

    expect(tool.active).toBe(true);
    expect(tool.builtIn).toBe(false);
    expect(tool.requiresConfirmation).toBe(false);
  });

  it('should throw on invalid tool name', () => {
    expect(() => defineTool({
      name: 'InvalidName',
      label: 'Test',
      description: 'Test',
      parameters: {},
    })).toThrow();
  });
});

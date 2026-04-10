// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPServerRuntime } from '../mcp-server-runtime.js';
import type { MCPServerRuntimeConfig } from '../mcp-server-runtime.js';
import type { AIToolDefinition, ToolCallPart } from '@objectstack/spec/contracts';
import type { ToolRegistry, ToolExecutionResult } from '../types.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockToolRegistry(tools: AIToolDefinition[] = []): ToolRegistry {
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<string>>();

  return {
    getAll: () => tools,
    execute: vi.fn(async (toolCall: ToolCallPart): Promise<ToolExecutionResult> => {
      const handler = handlers.get(toolCall.toolName);
      if (!handler) {
        return {
          type: 'tool-result',
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          output: { type: 'text', value: `Tool "${toolCall.toolName}" not found` },
          isError: true,
        };
      }
      const args = typeof toolCall.input === 'string'
        ? JSON.parse(toolCall.input)
        : (toolCall.input as Record<string, unknown>) ?? {};
      const content = await handler(args);
      return {
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        output: { type: 'text', value: content },
      };
    }),
    // Expose for test setup
    _setHandler: (name: string, fn: (args: Record<string, unknown>) => Promise<string>) => {
      handlers.set(name, fn);
    },
  } as ToolRegistry & { _setHandler: (name: string, fn: any) => void };
}

function createMockMetadataService() {
  const objects: Record<string, any> = {
    account: {
      name: 'account',
      label: 'Account',
      fields: {
        name: { type: 'text', label: 'Name', required: true },
        email: { type: 'email', label: 'Email' },
        status: { type: 'select', label: 'Status' },
      },
      enable: { softDelete: true },
    },
    contact: {
      name: 'contact',
      label: 'Contact',
      fields: {
        first_name: { type: 'text', label: 'First Name', required: true },
        last_name: { type: 'text', label: 'Last Name', required: true },
      },
    },
  };

  const agents: Record<string, any> = {
    data_chat: {
      name: 'data_chat',
      label: 'Data Assistant',
      role: 'Business Data Analyst',
      instructions: 'You are a helpful data assistant.',
      active: true,
    },
    metadata_assistant: {
      name: 'metadata_assistant',
      label: 'Metadata Assistant',
      role: 'Schema Designer',
      instructions: 'You help design data schemas.',
      active: true,
    },
  };

  return {
    listObjects: vi.fn(async () => Object.values(objects)),
    getObject: vi.fn(async (name: string) => objects[name] ?? null),
    get: vi.fn(async (type: string, name: string) => {
      if (type === 'agent') return agents[name] ?? null;
      return null;
    }),
    list: vi.fn(async (type: string) => {
      if (type === 'agent') return Object.values(agents);
      return [];
    }),
    exists: vi.fn(async (type: string, name: string) => {
      if (type === 'agent') return name in agents;
      return false;
    }),
    getRegisteredTypes: vi.fn(async () => ['object', 'app', 'view', 'agent', 'tool']),
    register: vi.fn(),
    unregister: vi.fn(),
  };
}

function createMockDataEngine() {
  const records: Record<string, Record<string, any>> = {
    'account:abc123': { id: 'abc123', name: 'Acme Corp', status: 'active' },
    'contact:xyz789': { id: 'xyz789', first_name: 'John', last_name: 'Doe' },
  };

  return {
    find: vi.fn(async () => []),
    findOne: vi.fn(async (objectName: string, options: any) => {
      const recordId = options?.where?.id;
      return records[`${objectName}:${recordId}`] ?? null;
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(async () => 0),
    aggregate: vi.fn(async () => []),
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCPServerRuntime', () => {
  let runtime: MCPServerRuntime;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    runtime = new MCPServerRuntime({
      name: 'test-objectstack',
      version: '1.0.0-test',
      logger: mockLogger as any,
    });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const defaultRuntime = new MCPServerRuntime();
      expect(defaultRuntime).toBeDefined();
      expect(defaultRuntime.isStarted).toBe(false);
    });

    it('should create with custom config', () => {
      expect(runtime).toBeDefined();
      expect(runtime.isStarted).toBe(false);
    });

    it('should expose the underlying McpServer', () => {
      expect(runtime.server).toBeDefined();
    });
  });

  describe('bridgeTools', () => {
    it('should bridge all tools from ToolRegistry', () => {
      const tools: AIToolDefinition[] = [
        {
          name: 'list_objects',
          description: 'List all objects',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'query_records',
          description: 'Query records',
          parameters: { type: 'object', properties: { objectName: { type: 'string' } }, required: ['objectName'] },
        },
      ];

      const registry = createMockToolRegistry(tools);
      runtime.bridgeTools(registry);

      expect(mockLogger.info).toHaveBeenCalledWith('[MCP] Bridged 2 tools from ToolRegistry');
    });

    it('should bridge zero tools gracefully', () => {
      const registry = createMockToolRegistry([]);
      runtime.bridgeTools(registry);

      expect(mockLogger.info).toHaveBeenCalledWith('[MCP] Bridged 0 tools from ToolRegistry');
    });

    it('should bridge all 9 standard tools', () => {
      const standardTools: AIToolDefinition[] = [
        { name: 'create_object', description: 'Create object', parameters: {} },
        { name: 'add_field', description: 'Add field', parameters: {} },
        { name: 'modify_field', description: 'Modify field', parameters: {} },
        { name: 'delete_field', description: 'Delete field', parameters: {} },
        { name: 'list_objects', description: 'List objects', parameters: {} },
        { name: 'describe_object', description: 'Describe object', parameters: {} },
        { name: 'query_records', description: 'Query records', parameters: {} },
        { name: 'get_record', description: 'Get record', parameters: {} },
        { name: 'aggregate_data', description: 'Aggregate data', parameters: {} },
      ];

      const registry = createMockToolRegistry(standardTools);
      runtime.bridgeTools(registry);

      expect(mockLogger.info).toHaveBeenCalledWith('[MCP] Bridged 9 tools from ToolRegistry');
    });
  });

  describe('bridgeResources', () => {
    it('should bridge metadata resources', () => {
      const metadataService = createMockMetadataService();
      runtime.bridgeResources(metadataService as any);

      // Should register: object_list, object_schema, metadata_types (3 resources, no dataEngine = no record_by_id)
      expect(mockLogger.info).toHaveBeenCalledWith('[MCP] Bridged 3 resource endpoints');
    });

    it('should bridge record resources when DataEngine is available', () => {
      const metadataService = createMockMetadataService();
      const dataEngine = createMockDataEngine();
      runtime.bridgeResources(metadataService as any, dataEngine as any);

      // Should register: object_list, object_schema, record_by_id, metadata_types (4 resources)
      expect(mockLogger.info).toHaveBeenCalledWith('[MCP] Bridged 4 resource endpoints');
    });

    it('should skip metadata_types when getRegisteredTypes is not available', () => {
      const metadataService = createMockMetadataService();
      delete (metadataService as any).getRegisteredTypes;
      runtime.bridgeResources(metadataService as any);

      // Should register: object_list, object_schema only (2 resources)
      expect(mockLogger.info).toHaveBeenCalledWith('[MCP] Bridged 2 resource endpoints');
    });
  });

  describe('bridgePrompts', () => {
    it('should register agent prompt', () => {
      const metadataService = createMockMetadataService();
      runtime.bridgePrompts(metadataService as any);

      expect(mockLogger.info).toHaveBeenCalledWith('[MCP] Agent prompts bridged');
    });
  });

  describe('lifecycle', () => {
    it('should not be started initially', () => {
      expect(runtime.isStarted).toBe(false);
    });

    it('should warn when HTTP transport is requested', async () => {
      const httpRuntime = new MCPServerRuntime({
        transport: 'http',
        logger: mockLogger as any,
      });

      await httpRuntime.start();

      expect(httpRuntime.isStarted).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[MCP] HTTP transport is not yet supported. Use stdio transport.',
      );
    });

    it('should be idempotent on stop when not started', async () => {
      await runtime.stop();
      expect(runtime.isStarted).toBe(false);
    });
  });
});

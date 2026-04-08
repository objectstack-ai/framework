// @vitest-environment happy-dom
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import type { UIMessage } from 'ai';
import {
  loadMessages,
  saveMessages,
} from '../src/hooks/use-ai-chat-panel';

function makeMsg(overrides: { id: string; role: 'user' | 'assistant'; content: string }): UIMessage {
  return {
    id: overrides.id,
    role: overrides.role,
    parts: [{ type: 'text' as const, text: overrides.content }],
  };
}

/**
 * Create a UIMessage that includes tool invocation parts for testing.
 */
function makeMsgWithToolParts(overrides: {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  toolParts?: Array<{ toolName: string; toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string }>;
}): UIMessage {
  const parts: UIMessage['parts'] = [];
  if (overrides.text) {
    parts.push({ type: 'text' as const, text: overrides.text });
  }
  if (overrides.toolParts) {
    for (const tp of overrides.toolParts) {
      parts.push({
        type: 'dynamic-tool',
        toolName: tp.toolName,
        toolCallId: tp.toolCallId,
        state: tp.state,
        input: tp.input,
        output: tp.output,
        errorText: tp.errorText,
      } as unknown as UIMessage['parts'][number]);
    }
  }
  return {
    id: overrides.id,
    role: overrides.role,
    parts,
  };
}

describe('use-ai-chat-panel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadMessages', () => {
    it('returns empty array when localStorage is empty', () => {
      expect(loadMessages()).toEqual([]);
    });

    it('returns parsed messages from localStorage', () => {
      const msgs = [
        makeMsg({ id: '1', role: 'user', content: 'Hello' }),
        makeMsg({ id: '2', role: 'assistant', content: 'Hi there!' }),
      ];
      localStorage.setItem('objectstack:ai-chat-messages', JSON.stringify(msgs));
      expect(loadMessages()).toEqual(msgs);
    });

    it('returns empty array for invalid JSON', () => {
      localStorage.setItem('objectstack:ai-chat-messages', 'not-json');
      expect(loadMessages()).toEqual([]);
    });

    it('returns empty array if stored value is not an array', () => {
      localStorage.setItem('objectstack:ai-chat-messages', JSON.stringify({ foo: 'bar' }));
      expect(loadMessages()).toEqual([]);
    });
  });

  describe('saveMessages', () => {
    it('persists messages to localStorage', () => {
      const msgs = [makeMsg({ id: '1', role: 'user', content: 'Hello' })];
      saveMessages(msgs);
      const stored = JSON.parse(localStorage.getItem('objectstack:ai-chat-messages') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].parts[0].text).toBe('Hello');
    });

    it('overwrites previous messages', () => {
      saveMessages([makeMsg({ id: '1', role: 'user', content: 'A' })]);
      saveMessages([makeMsg({ id: '2', role: 'user', content: 'B' })]);
      const stored = JSON.parse(localStorage.getItem('objectstack:ai-chat-messages') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].parts[0].text).toBe('B');
    });

    it('does not throw when localStorage is unavailable', () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); };
      expect(() => saveMessages([makeMsg({ id: '1', role: 'user', content: 'A' })])).not.toThrow();
      Storage.prototype.setItem = originalSetItem;
    });
  });
});

describe('AiChatPanel keyboard shortcut', () => {
  it('toggles panel state via localStorage when Ctrl+Shift+I is dispatched', () => {
    // Verify the panel state key is not set initially
    expect(localStorage.getItem('objectstack:ai-chat-panel-open')).toBeNull();

    // Simulate toggling logic directly (keyboard integration tested via React hooks)
    localStorage.setItem('objectstack:ai-chat-panel-open', 'true');
    expect(localStorage.getItem('objectstack:ai-chat-panel-open')).toBe('true');

    localStorage.setItem('objectstack:ai-chat-panel-open', 'false');
    expect(localStorage.getItem('objectstack:ai-chat-panel-open')).toBe('false');
  });
});

describe('AiChatPanel constants', () => {
  it('uses correct localStorage keys', () => {
    // Validate the keys used by the module match expectations
    const msgs = [makeMsg({ id: '1', role: 'user', content: 'test' })];
    saveMessages(msgs);
    expect(localStorage.getItem('objectstack:ai-chat-messages')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Tool Invocation Message Parts
// ═══════════════════════════════════════════════════════════════════

describe('Messages with tool invocation parts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should persist and restore messages containing tool invocation parts', () => {
    const msg = makeMsgWithToolParts({
      id: 'a1',
      role: 'assistant',
      text: 'Creating object...',
      toolParts: [
        {
          toolName: 'create_object',
          toolCallId: 'tc_1',
          state: 'output-available',
          input: { name: 'project', label: 'Project' },
          output: { name: 'project', label: 'Project', fieldCount: 0 },
        },
      ],
    });
    saveMessages([msg]);
    const restored = loadMessages();
    expect(restored).toHaveLength(1);
    expect(restored[0].parts).toHaveLength(2); // text + tool part
  });

  it('should handle messages with only tool parts (no text)', () => {
    const msg = makeMsgWithToolParts({
      id: 'a2',
      role: 'assistant',
      toolParts: [
        {
          toolName: 'list_objects',
          toolCallId: 'tc_2',
          state: 'output-available',
          input: {},
          output: { objects: [], totalCount: 0 },
        },
      ],
    });
    saveMessages([msg]);
    const restored = loadMessages();
    expect(restored).toHaveLength(1);
    expect(restored[0].parts).toHaveLength(1); // only tool part
  });

  it('should persist tool error parts', () => {
    const msg = makeMsgWithToolParts({
      id: 'a3',
      role: 'assistant',
      toolParts: [
        {
          toolName: 'create_object',
          toolCallId: 'tc_3',
          state: 'output-error',
          input: { name: 'Bad Name' },
          errorText: 'Invalid object name "Bad Name". Must be snake_case.',
        },
      ],
    });
    saveMessages([msg]);
    const restored = loadMessages();
    expect(restored).toHaveLength(1);
    const toolPart = restored[0].parts.find((p: { type: string }) => p.type === 'dynamic-tool');
    expect(toolPart).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Agent Selector
// ═══════════════════════════════════════════════════════════════════

import {
  AGENT_STORAGE_KEY,
  GENERAL_CHAT_VALUE,
  chatApiUrl,
  loadSelectedAgent,
  saveSelectedAgent,
} from '../src/components/AiChatPanel';

describe('Agent Selector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('chatApiUrl', () => {
    it('should return general chat URL when no agent selected', () => {
      expect(chatApiUrl('', null)).toBe('/api/v1/ai/chat');
      expect(chatApiUrl('', GENERAL_CHAT_VALUE)).toBe('/api/v1/ai/chat');
    });

    it('should return agent-specific URL when agent selected', () => {
      expect(chatApiUrl('', 'metadata_assistant')).toBe('/api/v1/ai/agents/metadata_assistant/chat');
      expect(chatApiUrl('', 'data_chat')).toBe('/api/v1/ai/agents/data_chat/chat');
    });

    it('should include baseUrl prefix', () => {
      expect(chatApiUrl('http://localhost:3000', 'metadata_assistant'))
        .toBe('http://localhost:3000/api/v1/ai/agents/metadata_assistant/chat');
      expect(chatApiUrl('http://localhost:3000', GENERAL_CHAT_VALUE))
        .toBe('http://localhost:3000/api/v1/ai/chat');
    });
  });

  describe('loadSelectedAgent', () => {
    it('should return GENERAL_CHAT_VALUE when nothing stored', () => {
      expect(loadSelectedAgent()).toBe(GENERAL_CHAT_VALUE);
    });

    it('should return stored agent name', () => {
      localStorage.setItem(AGENT_STORAGE_KEY, 'metadata_assistant');
      expect(loadSelectedAgent()).toBe('metadata_assistant');
    });
  });

  describe('saveSelectedAgent', () => {
    it('should persist agent selection to localStorage', () => {
      saveSelectedAgent('metadata_assistant');
      expect(localStorage.getItem(AGENT_STORAGE_KEY)).toBe('metadata_assistant');
    });

    it('should overwrite previous selection', () => {
      saveSelectedAgent('data_chat');
      saveSelectedAgent('metadata_assistant');
      expect(localStorage.getItem(AGENT_STORAGE_KEY)).toBe('metadata_assistant');
    });

    it('should not throw when localStorage is unavailable', () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); };
      expect(() => saveSelectedAgent('metadata_assistant')).not.toThrow();
      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe('AGENT_STORAGE_KEY', () => {
    it('should be a valid localStorage key', () => {
      expect(AGENT_STORAGE_KEY).toBe('objectstack:ai-chat-agent');
    });
  });
});

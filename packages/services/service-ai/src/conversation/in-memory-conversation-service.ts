// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  AIConversation,
  AIResult,
  ModelMessage,
  IAIConversationService,
  MessageObservability,
} from '@objectstack/spec/contracts';

/** Compose the side-map key for a turn. */
function turnKey(conversationId: string, turnId: string): string {
  return `${conversationId}::${turnId}`;
}

/**
 * Whether an assistant message is the turn's FINAL reply — plain text with no
 * tool-call parts. Mirrors the ObjectQL service's "assistant row with no
 * pending tool_calls" rule so both impls agree on what completes a turn.
 */
function assistantReplyText(message: ModelMessage): string | null {
  if (message.role !== 'assistant') return null;
  if (typeof message.content === 'string') return message.content;
  const parts = message.content;
  if (parts.some((p) => p.type === 'tool-call')) return null;
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/**
 * InMemoryConversationService — Reference implementation of IAIConversationService.
 *
 * Stores conversations in a simple Map.  Suitable for development, testing,
 * and single-process deployments.  Production environments should replace
 * this with a persistent implementation (e.g., backed by ObjectQL/SQL).
 */
export class InMemoryConversationService implements IAIConversationService {
  private readonly store = new Map<string, AIConversation>();
  // Per-turn reconciliation state (ADR-0013 D1), keyed by
  // `${conversationId}::${turnId}`. Kept beside `store` because the public
  // `messages` array is plain `ModelMessage[]` with no turn tagging.
  private readonly turns = new Map<string, { userExists: boolean; reply: AIResult | null }>();
  private counter = 0;

  async create(options: {
    title?: string;
    agentId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  } = {}): Promise<AIConversation> {
    const now = new Date().toISOString();
    const id = `conv_${++this.counter}`;

    const conversation: AIConversation = {
      id,
      title: options.title,
      agentId: options.agentId,
      userId: options.userId,
      messages: [],
      createdAt: now,
      updatedAt: now,
      metadata: options.metadata,
    };

    this.store.set(id, conversation);
    return conversation;
  }

  async get(conversationId: string): Promise<AIConversation | null> {
    return this.store.get(conversationId) ?? null;
  }

  async list(options: {
    userId?: string;
    agentId?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<AIConversation[]> {
    let results = Array.from(this.store.values());

    if (options.userId) {
      results = results.filter(c => c.userId === options.userId);
    }
    if (options.agentId) {
      results = results.filter(c => c.agentId === options.agentId);
    }

    // Simple cursor-based pagination: cursor = conversation ID
    if (options.cursor) {
      const idx = results.findIndex(c => c.id === options.cursor);
      if (idx >= 0) {
        results = results.slice(idx + 1);
      }
    }

    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async addMessage(
    conversationId: string,
    message: ModelMessage,
    extras?: MessageObservability,
    turnId?: string,
  ): Promise<AIConversation> {
    // Observability extras are accepted for interface parity with
    // ObjectQLConversationService but not persisted — the in-memory
    // store is for testing only and doesn't surface analytics views.
    const conversation = this.store.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation "${conversationId}" not found`);
    }

    conversation.messages.push(message);
    conversation.updatedAt = new Date().toISOString();

    // Track per-turn state so getTurnState can dedup/short-circuit (ADR-0013 D1).
    if (turnId) {
      const key = turnKey(conversationId, turnId);
      const state = this.turns.get(key) ?? { userExists: false, reply: null };
      if (message.role === 'user') state.userExists = true;
      const replyText = assistantReplyText(message);
      if (replyText !== null) {
        state.reply = {
          content: replyText,
          ...(extras?.model ? { model: extras.model } : {}),
          ...(extras?.totalTokens != null
            ? {
                usage: {
                  promptTokens: extras.promptTokens ?? 0,
                  completionTokens: extras.completionTokens ?? 0,
                  totalTokens: extras.totalTokens,
                },
              }
            : {}),
        };
      }
      this.turns.set(key, state);
    }

    return conversation;
  }

  async getTurnState(
    conversationId: string,
    turnId: string,
  ): Promise<{ userExists: boolean; reply: AIResult | null }> {
    return this.turns.get(turnKey(conversationId, turnId)) ?? { userExists: false, reply: null };
  }

  async update(
    conversationId: string,
    patch: { title?: string; metadata?: Record<string, unknown> },
  ): Promise<AIConversation> {
    const conversation = this.store.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation "${conversationId}" not found`);
    }
    if (patch.title !== undefined) conversation.title = patch.title;
    if (patch.metadata !== undefined) conversation.metadata = patch.metadata;
    conversation.updatedAt = new Date().toISOString();
    return conversation;
  }

  async delete(conversationId: string): Promise<void> {
    this.store.delete(conversationId);
  }

  /** Total number of stored conversations. */
  get size(): number {
    return this.store.size;
  }

  /** Clear all conversations. */
  clear(): void {
    this.store.clear();
    this.turns.clear();
    this.counter = 0;
  }
}

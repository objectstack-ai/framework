// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  AIConversation,
  AIMessage,
  IAIConversationService,
} from '@objectstack/spec/contracts';

/**
 * InMemoryConversationService — Reference implementation of IAIConversationService.
 *
 * Stores conversations in a simple Map.  Suitable for development, testing,
 * and single-process deployments.  Production environments should replace
 * this with a persistent implementation (e.g., backed by ObjectQL/SQL).
 */
export class InMemoryConversationService implements IAIConversationService {
  private readonly store = new Map<string, AIConversation>();
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

  async addMessage(conversationId: string, message: AIMessage): Promise<AIConversation> {
    const conversation = this.store.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation "${conversationId}" not found`);
    }

    conversation.messages.push(message);
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
    this.counter = 0;
  }
}

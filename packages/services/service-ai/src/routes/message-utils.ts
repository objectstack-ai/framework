// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ModelMessage } from '@objectstack/spec/contracts';

/**
 * Normalize a Vercel AI SDK v6 message (which may use `parts` instead of
 * `content`) into a plain `{ role, content }` ModelMessage.
 *
 * Shared between the general chat routes and agent chat routes.
 */
export function normalizeMessage(raw: Record<string, unknown>): ModelMessage {
  const role = raw.role as string;

  // If content is already a string, use it directly
  if (typeof raw.content === 'string') {
    return { role, content: raw.content } as unknown as ModelMessage;
  }

  // If content is an array (multi-part), pass through
  if (Array.isArray(raw.content)) {
    return { role, content: raw.content } as unknown as ModelMessage;
  }

  // Vercel AI SDK v6: extract text from `parts` array
  if (Array.isArray(raw.parts)) {
    const textParts = (raw.parts as Array<Record<string, unknown>>)
      .filter(p => p.type === 'text' && typeof p.text === 'string')
      .map(p => p.text as string);
    if (textParts.length > 0) {
      return { role, content: textParts.join('') } as unknown as ModelMessage;
    }
  }

  // Fallback: empty content (e.g. tool-only assistant messages)
  return { role, content: '' } as unknown as ModelMessage;
}

/**
 * Validate message content/parts format (role-agnostic).
 *
 * Returns `null` when the content shape is valid, or an error string
 * describing the first violation found.
 *
 * Accepts:
 *  - Simple string `content` (legacy)
 *  - Array `content` (e.g. `[{ type: 'text', text: '...' }]`)
 *  - Vercel AI SDK v6 `parts` format (content may be absent/null)
 *  - Null/undefined `content` for assistant messages (when `allowEmpty` is true)
 */
export function validateMessageContent(
  msg: Record<string, unknown>,
  opts?: { allowEmptyContent?: boolean },
): string | null {
  const content = msg.content;

  // Vercel AI SDK v6 sends `parts` instead of (or alongside) `content`.
  // Accept any message that carries a `parts` array, even when `content` is absent.
  if (Array.isArray(msg.parts)) {
    return null;
  }

  // content is a plain string — OK
  if (typeof content === 'string') {
    return null;
  }

  // content is an array of typed parts (legacy multi-part format)
  if (Array.isArray(content)) {
    for (const part of content as unknown[]) {
      if (typeof part !== 'object' || part === null) {
        return 'message.content array elements must be non-null objects';
      }
      const partObj = part as Record<string, unknown>;
      if (typeof partObj.type !== 'string') {
        return 'each message.content array element must have a string "type" property';
      }
      if (partObj.type === 'text' && typeof partObj.text !== 'string') {
        return 'message.content elements with type "text" must have a string "text" property';
      }
    }
    return null;
  }

  // Allow empty content for certain roles (e.g. assistant tool-call messages)
  if ((content === null || content === undefined) && opts?.allowEmptyContent) {
    return null;
  }

  return 'message.content must be a string, an array, or include parts';
}

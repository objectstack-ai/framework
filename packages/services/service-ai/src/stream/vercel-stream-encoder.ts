// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Data Stream Encoder
 *
 * Converts `AsyncIterable<TextStreamPart<ToolSet>>` (the internal ObjectStack
 * streaming format, aligned with Vercel AI SDK types) into the Vercel AI SDK
 * **Data Stream Protocol** wire format.
 *
 * Each frame is a single line:  `<type-code>:<JSON>\n`
 *
 * | Code | Description              | Payload shape                                                |
 * |:-----|:-------------------------|:-------------------------------------------------------------|
 * | `0`  | Text delta               | `"<text>"`                                                   |
 * | `9`  | Tool call (full)         | `{"toolCallId","toolName","args"}`                           |
 * | `b`  | Tool call start          | `{"toolCallId","toolName"}`                                  |
 * | `c`  | Tool call delta          | `{"toolCallId","argsTextDelta"}`                             |
 * | `a`  | Tool result              | `{"toolCallId","result"}`                                    |
 * | `d`  | Finish (message-level)   | `{"finishReason","usage"?}`                                  |
 * | `e`  | Step finish              | `{"finishReason","usage"?,"isContinued"?}`                   |
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
 */

import type { TextStreamPart, ToolSet } from 'ai';

// ── Public API ──────────────────────────────────────────────────────

/**
 * Encode a single `TextStreamPart` event into its Vercel Data Stream frame(s).
 *
 * Returns an empty string for event types that have no wire-format mapping
 * (e.g. internal-only events).
 */
export function encodeStreamPart(part: TextStreamPart<ToolSet>): string {
  switch (part.type) {
    // ── Text ──────────────────────────────────────────────────
    case 'text-delta':
      return `0:${JSON.stringify(part.text)}\n`;

    // ── Tool calling ─────────────────────────────────────────
    case 'tool-call':
      return `9:${JSON.stringify({
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.input,
      })}\n`;

    case 'tool-input-start':
      return `b:${JSON.stringify({
        toolCallId: part.id,
        toolName: part.toolName,
      })}\n`;

    case 'tool-input-delta':
      return `c:${JSON.stringify({
        toolCallId: part.id,
        argsTextDelta: part.delta,
      })}\n`;

    case 'tool-result':
      return `a:${JSON.stringify({
        toolCallId: part.toolCallId,
        result: part.output,
      })}\n`;

    // ── Finish / Step ────────────────────────────────────────
    case 'finish':
      return `d:${JSON.stringify({
        finishReason: part.finishReason,
        usage: part.totalUsage ?? undefined,
      })}\n`;

    case 'finish-step':
      return `e:${JSON.stringify({
        finishReason: part.finishReason,
        usage: part.usage ?? undefined,
      })}\n`;

    // ── Unhandled types (silently skip) ──────────────────────
    default:
      return '';
  }
}

/**
 * Transform an `AsyncIterable<TextStreamPart>` into an `AsyncIterable<string>`
 * where each yielded string is a Vercel Data Stream frame.
 *
 * Empty frames (from unmapped event types) are silently dropped.
 */
export async function* encodeVercelDataStream(
  events: AsyncIterable<TextStreamPart<ToolSet>>,
): AsyncIterable<string> {
  for await (const part of events) {
    const frame = encodeStreamPart(part);
    if (frame) {
      yield frame;
    }
  }
}

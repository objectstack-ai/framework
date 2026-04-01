// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import type { TextStreamPart, ToolSet } from '@objectstack/spec/contracts';
import { encodeStreamPart, encodeVercelDataStream } from '../stream/vercel-stream-encoder.js';

// ─────────────────────────────────────────────────────────────────
// encodeStreamPart — individual frame encoding
// ─────────────────────────────────────────────────────────────────

describe('encodeStreamPart', () => {
  it('should encode text-delta as "0:" frame', () => {
    const part = { type: 'text-delta', text: 'Hello world' } as TextStreamPart<ToolSet>;
    expect(encodeStreamPart(part)).toBe('0:"Hello world"\n');
  });

  it('should JSON-escape text-delta content', () => {
    const part = { type: 'text-delta', text: 'say "hi"\nnewline' } as TextStreamPart<ToolSet>;
    const frame = encodeStreamPart(part);
    expect(frame).toBe(`0:${JSON.stringify('say "hi"\nnewline')}\n`);
    expect(frame.startsWith('0:')).toBe(true);

    // Verify round-trip: decode the frame payload back to the original text
    const decoded = JSON.parse(frame.slice(2).trim());
    expect(decoded).toBe('say "hi"\nnewline');
  });

  it('should encode tool-call as "9:" frame', () => {
    const part = {
      type: 'tool-call',
      toolCallId: 'call_1',
      toolName: 'get_weather',
      input: { location: 'San Francisco' },
    } as TextStreamPart<ToolSet>;

    const frame = encodeStreamPart(part);
    expect(frame.startsWith('9:')).toBe(true);

    const payload = JSON.parse(frame.slice(2));
    expect(payload).toEqual({
      toolCallId: 'call_1',
      toolName: 'get_weather',
      args: { location: 'San Francisco' },
    });
  });

  it('should encode tool-input-start as "b:" frame', () => {
    const part = {
      type: 'tool-input-start',
      id: 'call_2',
      toolName: 'search',
    } as TextStreamPart<ToolSet>;

    const frame = encodeStreamPart(part);
    expect(frame.startsWith('b:')).toBe(true);

    const payload = JSON.parse(frame.slice(2));
    expect(payload).toEqual({
      toolCallId: 'call_2',
      toolName: 'search',
    });
  });

  it('should encode tool-input-delta as "c:" frame', () => {
    const part = {
      type: 'tool-input-delta',
      id: 'call_2',
      delta: '{"query":',
    } as TextStreamPart<ToolSet>;

    const frame = encodeStreamPart(part);
    expect(frame.startsWith('c:')).toBe(true);

    const payload = JSON.parse(frame.slice(2));
    expect(payload).toEqual({
      toolCallId: 'call_2',
      argsTextDelta: '{"query":',
    });
  });

  it('should encode tool-result as "a:" frame', () => {
    const part = {
      type: 'tool-result',
      toolCallId: 'call_1',
      toolName: 'get_weather',
      output: { temperature: 72 },
    } as TextStreamPart<ToolSet>;

    const frame = encodeStreamPart(part);
    expect(frame.startsWith('a:')).toBe(true);

    const payload = JSON.parse(frame.slice(2));
    expect(payload).toEqual({
      toolCallId: 'call_1',
      result: { temperature: 72 },
    });
  });

  it('should encode finish as "d:" frame', () => {
    const part = {
      type: 'finish',
      finishReason: 'stop',
      totalUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      rawFinishReason: 'stop',
    } as unknown as TextStreamPart<ToolSet>;

    const frame = encodeStreamPart(part);
    expect(frame.startsWith('d:')).toBe(true);

    const payload = JSON.parse(frame.slice(2));
    expect(payload.finishReason).toBe('stop');
    expect(payload.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
  });

  it('should encode finish-step as "e:" frame', () => {
    const part = {
      type: 'finish-step',
      finishReason: 'tool-calls',
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
    } as unknown as TextStreamPart<ToolSet>;

    const frame = encodeStreamPart(part);
    expect(frame.startsWith('e:')).toBe(true);

    const payload = JSON.parse(frame.slice(2));
    expect(payload.finishReason).toBe('tool-calls');
  });

  it('should return empty string for unknown event types', () => {
    const part = { type: 'unknown-internal' } as unknown as TextStreamPart<ToolSet>;
    expect(encodeStreamPart(part)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────
// encodeVercelDataStream — async iterable transformation
// ─────────────────────────────────────────────────────────────────

describe('encodeVercelDataStream', () => {
  it('should transform stream events into Vercel Data Stream frames', async () => {
    async function* source(): AsyncIterable<TextStreamPart<ToolSet>> {
      yield { type: 'text-delta', text: 'Hello' } as TextStreamPart<ToolSet>;
      yield { type: 'text-delta', text: ' world' } as TextStreamPart<ToolSet>;
      yield {
        type: 'finish',
        finishReason: 'stop',
        totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        rawFinishReason: 'stop',
      } as unknown as TextStreamPart<ToolSet>;
    }

    const frames: string[] = [];
    for await (const frame of encodeVercelDataStream(source())) {
      frames.push(frame);
    }

    expect(frames).toHaveLength(3);
    expect(frames[0]).toBe('0:"Hello"\n');
    expect(frames[1]).toBe('0:" world"\n');
    expect(frames[2]).toMatch(/^d:/);
  });

  it('should skip events with no wire format mapping', async () => {
    async function* source(): AsyncIterable<TextStreamPart<ToolSet>> {
      yield { type: 'text-delta', text: 'Hi' } as TextStreamPart<ToolSet>;
      yield { type: 'unknown-internal' } as unknown as TextStreamPart<ToolSet>;
      yield {
        type: 'finish',
        finishReason: 'stop',
        totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        rawFinishReason: 'stop',
      } as unknown as TextStreamPart<ToolSet>;
    }

    const frames: string[] = [];
    for await (const frame of encodeVercelDataStream(source())) {
      frames.push(frame);
    }

    // 'unknown-internal' is silently dropped
    expect(frames).toHaveLength(2);
    expect(frames[0]).toBe('0:"Hi"\n');
    expect(frames[1]).toMatch(/^d:/);
  });

  it('should handle empty stream', async () => {
    async function* source(): AsyncIterable<TextStreamPart<ToolSet>> {
      // empty
    }

    const frames: string[] = [];
    for await (const frame of encodeVercelDataStream(source())) {
      frames.push(frame);
    }

    expect(frames).toHaveLength(0);
  });

  it('should handle tool-call events in stream', async () => {
    async function* source(): AsyncIterable<TextStreamPart<ToolSet>> {
      yield {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'search',
        input: { query: 'test' },
      } as TextStreamPart<ToolSet>;
      yield {
        type: 'tool-result',
        toolCallId: 'call_1',
        toolName: 'search',
        output: { hits: 42 },
      } as TextStreamPart<ToolSet>;
      yield {
        type: 'finish',
        finishReason: 'tool-calls',
        totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        rawFinishReason: 'tool_calls',
      } as unknown as TextStreamPart<ToolSet>;
    }

    const frames: string[] = [];
    for await (const frame of encodeVercelDataStream(source())) {
      frames.push(frame);
    }

    expect(frames).toHaveLength(3);
    expect(frames[0]).toMatch(/^9:/);
    expect(frames[1]).toMatch(/^a:/);
    expect(frames[2]).toMatch(/^d:/);

    // Verify tool-call frame content
    const toolCallPayload = JSON.parse(frames[0].slice(2));
    expect(toolCallPayload.toolCallId).toBe('call_1');
    expect(toolCallPayload.args).toEqual({ query: 'test' });
  });
});

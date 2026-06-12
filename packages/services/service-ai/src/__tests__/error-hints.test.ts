// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, expect, it } from 'vitest';
import { describeProviderError } from '../stream/error-hints.js';
import { encodeVercelDataStream } from '../stream/vercel-stream-encoder.js';

const GATEWAY = 'Vercel AI Gateway (model: claude/sonnet-4.6)';

describe('describeProviderError', () => {
  it('names the adapter and maps HTTP 400 to a model-id hint', () => {
    const msg = describeProviderError(
      { message: 'Bad Request', statusCode: 400 },
      GATEWAY,
    );
    expect(msg).toContain('Bad Request (HTTP 400)');
    expect(msg).toContain(GATEWAY);
    expect(msg).toContain('provider/model');
  });

  it('maps auth failures to a credential hint', () => {
    const msg = describeProviderError(
      { name: 'GatewayAuthenticationError', message: 'Unauthorized', statusCode: 401 },
      GATEWAY,
    );
    expect(msg).toContain('API key');
    expect(msg).toContain('Test connection');
  });

  it('appends the provider response body excerpt', () => {
    const msg = describeProviderError({
      message: 'Bad Request',
      statusCode: 400,
      responseBody: '{"error":"model claude/sonnet-4.6 not found"}',
    });
    expect(msg).toContain('provider says:');
    expect(msg).toContain('not found');
  });

  it('reads nested cause status and survives non-object errors', () => {
    expect(describeProviderError({ message: 'fail', cause: { statusCode: 429 } })).toContain('HTTP 429');
    expect(describeProviderError('plain text error')).toContain('plain text error');
    expect(describeProviderError(undefined)).toContain('Unknown provider error');
  });
});

describe('encodeVercelDataStream error enrichment', () => {
  async function* failingStream(): AsyncIterable<any> {
    yield { type: 'error', error: { message: 'Bad Request', statusCode: 400 } };
  }

  it('emits the enriched error text on provider error parts', async () => {
    const frames: string[] = [];
    for await (const f of encodeVercelDataStream(failingStream() as any, { adapterDescription: GATEWAY })) {
      frames.push(f);
    }
    const errFrame = frames.find((f) => f.includes('"type":"error"'))!;
    expect(errFrame).toContain('HTTP 400');
    expect(errFrame).toContain('claude/sonnet-4.6');
    const finish = frames.find((f) => f.includes('"type":"finish"'))!;
    expect(finish).toContain('"finishReason":"error"');
  });

  it('enriches thrown errors too', async () => {
    async function* throwingStream(): AsyncIterable<any> {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      yield undefined; // unreachable — makes this a generator
    }
    const frames: string[] = [];
    for await (const f of encodeVercelDataStream(throwingStream() as any, { adapterDescription: GATEWAY })) {
      frames.push(f);
    }
    const errFrame = frames.find((f) => f.includes('"type":"error"'))!;
    expect(errFrame).toContain('HTTP 401');
    expect(errFrame).toContain('API key');
  });
});

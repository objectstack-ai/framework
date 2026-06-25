// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../agent-runtime.js';

// Dogfood regression: apps built from a Chinese prompt came back with English
// labels because the model was only told to "use the same language" (inferred).
// The runtime now detects the user's language and states it EXPLICITLY in the
// agent's system prompt so generated labels (on the granular authoring path)
// reliably match it.
const metadata = {
  get: async () => undefined,
  list: async () => [],
  getObject: async () => undefined,
} as never;

const agent = {
  name: 'build',
  label: 'Builder',
  role: 'Architect',
  instructions: 'Base persona.',
  surface: 'build',
  skills: [],
  active: true,
} as never;

describe('buildSystemMessages — explicit user-language directive', () => {
  const rt = new AgentRuntime(metadata);

  it('states the language and requires labels in it when context.userLanguage is set', () => {
    const sys = rt
      .buildSystemMessages(agent, { userLanguage: 'Chinese' } as never)
      .map((m) => m.content)
      .join('\n');
    expect(sys).toContain('--- User language ---');
    expect(sys).toContain('Chinese');
    expect(sys).toMatch(/MUST be written in/);
  });

  it('omits the directive when no userLanguage is provided', () => {
    const sys = rt
      .buildSystemMessages(agent, {} as never)
      .map((m) => m.content)
      .join('\n');
    expect(sys).not.toContain('--- User language ---');
  });
});

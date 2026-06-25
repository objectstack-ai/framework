// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// listAgents() access-aware catalog (ADR-0049 / ADR-0068).
//
// The runtime catalog (GET /api/v1/ai/agents) is what the console keys off to
// decide whether to SHOW the in-UI AI surfaces ("Build with AI" / "Ask AI").
// When a caller context is supplied, listAgents() hides agents the caller
// cannot chat (per-agent `permissions`/`access` — e.g. the per-user AI-seat
// gate), so a seat-less user never sees a button that would 403 on click. No
// caller (internal default-agent resolution) -> unfiltered (unchanged).

import { describe, it, expect } from 'vitest';
import type { Agent } from '@objectstack/spec/ai';
import type { IMetadataService } from '@objectstack/spec/contracts';
import { AgentRuntime } from '../agent-runtime.js';
import { SkillRegistry } from '../skill-registry.js';
import { registerAgentAlias } from '../agents/agent-aliases.js';

// Make `build`/`ask` recognised platform agents (mirrors the cloud plugin init).
registerAgentAlias('metadata_assistant', 'build');

/** A platform agent gated behind the `ai_seat` permission. */
const gated = (name: string, surface: 'build' | 'ask'): Agent =>
  ({
    name,
    label: name,
    role: 'r',
    surface,
    instructions: 'x',
    model: { provider: 'openai', model: 'gpt-4', temperature: 0.2, maxTokens: 4096 },
    skills: [],
    active: true,
    visibility: 'global',
    permissions: ['ai_seat'], // the per-user gate
    _provenance: 'package', // intrinsic platform-agent signal (isPlatformAgentRecord)
  }) as any;

function runtimeListing(agents: Agent[]): AgentRuntime {
  const md = {
    list: async () => agents,
    get: async () => undefined,
    exists: async () => false,
    register: async () => {},
    unregister: async () => {},
  } as unknown as IMetadataService;
  return new AgentRuntime(md, new SkillRegistry(md));
}

describe('listAgents() — access-aware catalog (ADR-0068)', () => {
  const agents = [gated('build', 'build'), gated('ask', 'ask')];

  it('no caller -> unfiltered (internal/default-agent resolution unchanged)', async () => {
    const out = await runtimeListing(agents).listAgents();
    expect(out.map((a) => a.name).sort()).toEqual(['ask', 'build']);
  });

  it('seat-less caller -> gated agents hidden (console renders no AI surface)', async () => {
    const out = await runtimeListing(agents).listAgents({
      userId: 'u',
      permissions: [],
      roles: [],
    } as any);
    expect(out).toEqual([]);
  });

  it('seated caller (holds the ai_seat permission-set) -> gated agents visible', async () => {
    const out = await runtimeListing(agents).listAgents({
      userId: 'u',
      permissions: ['ai_seat'],
      roles: [],
    } as any);
    expect(out.map((a) => a.name).sort()).toEqual(['ask', 'build']);
  });

  it('seat granted via a ROLE also unlocks (roles union permissions)', async () => {
    const out = await runtimeListing(agents).listAgents({
      userId: 'u',
      permissions: [],
      roles: ['ai_seat'],
    } as any);
    expect(out.map((a) => a.name).sort()).toEqual(['ask', 'build']);
  });

  it('ungated agents (no permissions, e.g. kill-switch off) stay visible to everyone', async () => {
    const ungated = [{ ...gated('build', 'build'), permissions: undefined }] as any;
    const out = await runtimeListing(ungated).listAgents({
      userId: 'u',
      permissions: [],
      roles: [],
    } as any);
    expect(out.map((a: { name: string }) => a.name)).toEqual(['build']);
  });
});

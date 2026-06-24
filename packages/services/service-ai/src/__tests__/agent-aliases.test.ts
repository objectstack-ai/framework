// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Back-compat for the Path A agent rename (`data_chat`→`ask`, and cloud's
 * `metadata_assistant`→`build` registered via the public registry). Verifies
 * the alias table and that AgentRuntime.loadAgent normalizes a legacy name to
 * its canonical record so old `/agents/:name/chat` links keep resolving.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IMetadataService } from '@objectstack/spec/contracts';
import { AgentRuntime } from '../agent-runtime.js';
import {
  ASK_AGENT_NAME,
  LEGACY_DATA_AGENT_NAME,
  registerAgentAlias,
  resolveAgentAlias,
} from '../agents/agent-aliases.js';
import type { Agent } from '@objectstack/spec/ai';

// The real `ask` PERSONA moved to the cloud-only @objectstack/service-ai-studio
// package; the framework now exports only the NAME CONSTANTS + the alias
// registry (the mechanism). This minimal local stub stands in for the persona so
// the alias-aware `AgentRuntime.loadAgent` resolution is still exercised here.
const ASK_AGENT_STUB: Agent = {
  name: ASK_AGENT_NAME,
  label: 'Assistant',
  role: 'Business Application Assistant',
  instructions: 'Stub ask persona for alias resolution tests.',
  active: true,
  visibility: 'global',
};

function mockMetadata(overrides: Partial<IMetadataService> = {}): IMetadataService {
  return {
    register: vi.fn(async () => {}),
    get: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
    unregister: vi.fn(async () => {}),
    exists: vi.fn(async () => false),
    listNames: vi.fn(async () => []),
    getObject: vi.fn(async () => undefined),
    listObjects: vi.fn(async () => []),
    ...overrides,
  } as unknown as IMetadataService;
}

describe('agent-aliases', () => {
  it('seeds the framework data-agent rename', () => {
    expect(ASK_AGENT_NAME).toBe('ask');
    expect(LEGACY_DATA_AGENT_NAME).toBe('data_chat');
    expect(resolveAgentAlias('data_chat')).toBe('ask');
  });

  it('passes unknown / canonical names through unchanged', () => {
    expect(resolveAgentAlias('ask')).toBe('ask');
    expect(resolveAgentAlias('sales_assistant')).toBe('sales_assistant');
  });

  it('lets another package register its own rename (e.g. cloud build agent)', () => {
    registerAgentAlias('metadata_assistant', 'build');
    expect(resolveAgentAlias('metadata_assistant')).toBe('build');
    // No-ops that must not corrupt the table.
    registerAgentAlias('', 'x');
    registerAgentAlias('same', 'same');
    expect(resolveAgentAlias('same')).toBe('same');
  });

  it('anchors the registry on globalThis so the ESM and CJS builds share one table', () => {
    // The package ships dual builds; a module-level `new Map()` would give each
    // its own copy and silently drop a cross-build alias (the real cause of the
    // `metadata_assistant`→`build` 404). The table must live on a well-known
    // global Symbol so both builds resolve to the SAME instance.
    registerAgentAlias('legacy_probe', 'ask');
    const shared = (globalThis as Record<symbol, unknown>)[
      Symbol.for('@objectstack/service-ai#agentNameAliases')
    ] as Map<string, string> | undefined;
    expect(shared).toBeInstanceOf(Map);
    expect(shared!.get('legacy_probe')).toBe('ask');
    // A second "build copy" reading via the same global key sees the alias.
    expect(shared!.get('data_chat')).toBe('ask');
  });
});

describe('AgentRuntime.loadAgent (alias-aware)', () => {
  it('resolves a legacy name to the renamed agent record', async () => {
    const get = vi.fn(async (_type: string, name: string) =>
      name === ASK_AGENT_NAME ? ASK_AGENT_STUB : undefined,
    );
    const runtime = new AgentRuntime(mockMetadata({ get: get as never }));

    const viaLegacy = await runtime.loadAgent('data_chat');
    expect(viaLegacy?.name).toBe('ask');
    expect(get).toHaveBeenCalledWith('agent', 'ask');

    const viaCanonical = await runtime.loadAgent('ask');
    expect(viaCanonical?.name).toBe('ask');
  });

  it('returns undefined for a genuinely unknown agent', async () => {
    const runtime = new AgentRuntime(mockMetadata());
    expect(await runtime.loadAgent('nope')).toBeUndefined();
  });
});

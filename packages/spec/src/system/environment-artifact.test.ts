// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  ENVIRONMENT_ARTIFACT_SCHEMA_VERSION,
  EnvironmentArtifactSchema,
  EnvironmentArtifactChecksumSchema,
  EnvironmentArtifactFunctionSchema,
  EnvironmentArtifactManifestSchema,
} from './environment-artifact.zod';

describe('EnvironmentArtifactSchema', () => {
  const minimal = {
    schemaVersion: ENVIRONMENT_ARTIFACT_SCHEMA_VERSION,
    environmentId: 'proj_01HABCDE',
    commitId: 'commit_01HABCDE',
    checksum: { algorithm: 'sha256' as const, value: 'a1b2c3d4' },
    metadata: {},
    functions: [],
    manifest: {},
  };

  it('accepts a minimal valid artifact', () => {
    const parsed = EnvironmentArtifactSchema.parse(minimal);
    expect(parsed.schemaVersion).toBe('0.1');
    expect(parsed.functions).toEqual([]);
  });

  it('defaults functions to an empty array when omitted', () => {
    const { functions: _omit, ...rest } = minimal;
    const parsed = EnvironmentArtifactSchema.parse(rest);
    expect(parsed.functions).toEqual([]);
  });

  it('rejects unknown schemaVersion values', () => {
    const result = EnvironmentArtifactSchema.safeParse({ ...minimal, schemaVersion: '9.9' });
    expect(result.success).toBe(false);
  });

  it('requires environmentId and commitId', () => {
    expect(EnvironmentArtifactSchema.safeParse({ ...minimal, environmentId: '' }).success).toBe(false);
    expect(EnvironmentArtifactSchema.safeParse({ ...minimal, commitId: '' }).success).toBe(false);
  });

  it('passes through unknown metadata categories without dropping them', () => {
    const parsed = EnvironmentArtifactSchema.parse({
      ...minimal,
      metadata: { objects: [{ name: 'account' }], futureCategory: [{ id: 'x' }] },
    });
    expect((parsed.metadata as Record<string, unknown>).futureCategory).toBeDefined();
  });

  it('accepts optional builtAt / builtWith provenance', () => {
    const parsed = EnvironmentArtifactSchema.parse({
      ...minimal,
      builtAt: '2026-04-26T00:00:00Z',
      builtWith: 'objectstack-cli@3.4.0',
    });
    expect(parsed.builtAt).toBe('2026-04-26T00:00:00Z');
  });

  it('accepts optional payloadRef for future S3 indirection', () => {
    const parsed = EnvironmentArtifactSchema.parse({
      ...minimal,
      payloadRef: {
        url: 'https://artifacts.objectstack.io/proj_x/commit_y.json',
        checksum: { algorithm: 'sha256' as const, value: 'deadbeef' },
      },
    });
    expect(parsed.payloadRef?.url).toContain('artifacts.objectstack.io');
  });
});

describe('EnvironmentArtifactChecksumSchema', () => {
  it('accepts lowercase hex values', () => {
    expect(EnvironmentArtifactChecksumSchema.parse({ value: 'abc123' }).algorithm).toBe('sha256');
  });

  it('rejects uppercase / non-hex values', () => {
    expect(EnvironmentArtifactChecksumSchema.safeParse({ value: 'ABC123' }).success).toBe(false);
    expect(EnvironmentArtifactChecksumSchema.safeParse({ value: 'not-hex' }).success).toBe(false);
  });
});

describe('EnvironmentArtifactFunctionSchema', () => {
  it('accepts a typical inlined function', () => {
    const parsed = EnvironmentArtifactFunctionSchema.parse({
      name: 'on_account_create',
      code: 'export default async (ctx) => {}',
    });
    expect(parsed.language).toBe('javascript');
  });

  it('rejects function names that are not snake_case', () => {
    expect(
      EnvironmentArtifactFunctionSchema.safeParse({ name: 'OnAccountCreate', code: '' }).success,
    ).toBe(false);
  });
});

describe('EnvironmentArtifactManifestSchema', () => {
  it('accepts an empty manifest', () => {
    expect(EnvironmentArtifactManifestSchema.parse({})).toEqual({});
  });

  it('accepts plugins, drivers and engine constraints', () => {
    const parsed = EnvironmentArtifactManifestSchema.parse({
      plugins: [{ id: '@objectstack/plugin-auth', version: '^3.0.0' }],
      drivers: [{ id: '@objectstack/driver-turso' }],
      engine: { objectstack: '>=3.0.0' },
    });
    expect(parsed.plugins?.[0].id).toBe('@objectstack/plugin-auth');
    expect(parsed.engine?.objectstack).toBe('>=3.0.0');
  });

  it('rejects malformed engine version ranges', () => {
    expect(
      EnvironmentArtifactManifestSchema.safeParse({ engine: { objectstack: 'not-a-range' } }).success,
    ).toBe(false);
  });
});

// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Regression: the artifact-serve path (`objectstack dev`/`serve`/`start`
// booting from `dist/objectstack.json`, no host `objectstack.config.ts`) must
// surface the artifact's app-declared RBAC — `permissions[]` and `roles[]` — at
// the top level of the returned stack config. The CLI reads `config.permissions`
// to honour an app-declared default profile (ADR-0056 D7 — `appDefaultProfileName`
// → SecurityPlugin `fallbackPermissionSet`) and reads `roles[]`/`permissions[]`
// to register app org roles. Before this was fixed, `createStandaloneStack`
// surfaced `objects`/`requires`/`manifest` but dropped `permissions`/`roles`, so
// an `isDefault` profile carrying e.g. `readScope: 'unit_and_below'` was silently
// ignored under `objectstack dev` and every user fell back to the built-in
// owner-only `member_default`.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStandaloneStack } from './standalone-stack.js';
import { createDefaultHostConfig } from './default-host.js';

// A minimal `objectstack build` artifact carrying an app-declared default
// profile with a hierarchy read scope, an add-on permission set, app roles,
// plus the metadata the path already surfaced (objects/requires/manifest).
const ARTIFACT = {
  manifest: { id: 'com.test.scope-app', name: 'Scope App', version: '1.0.0' },
  requires: ['auth'],
  objects: [{ name: 'note', label: 'Note', fields: { title: { type: 'text' } } }],
  roles: [
    { name: 'manager', label: 'Manager' },
    { name: 'contributor', label: 'Contributor' },
  ],
  permissions: [
    {
      name: 'app_member_default',
      label: 'App Member (Default)',
      isProfile: true,
      isDefault: true,
      objects: {
        note: { allowRead: true, allowCreate: true, readScope: 'unit_and_below', writeScope: 'unit' },
      },
    },
    {
      name: 'app_contributor',
      label: 'Contributor add-on',
      isProfile: false,
      objects: { note: { allowEdit: true } },
    },
  ],
};

// Mirrors `appDefaultProfileName` from @objectstack/plugin-security (not a
// runtime dependency, so the resolution rule is reproduced here): the first
// `isDefault && isProfile !== false` permission set's name.
function appDefaultProfileName(permissions: unknown): string | undefined {
  if (!Array.isArray(permissions)) return undefined;
  for (const p of permissions) {
    if (p && typeof p === 'object') {
      const ps = p as { name?: unknown; isProfile?: unknown; isDefault?: unknown };
      if (ps.isDefault === true && ps.isProfile !== false && typeof ps.name === 'string' && ps.name.length > 0) {
        return ps.name;
      }
    }
  }
  return undefined;
}

describe('createStandaloneStack — surfaces app RBAC from the artifact (ADR-0056 D7)', () => {
  let dir: string;
  let artifactPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'os-standalone-rbac-'));
    artifactPath = join(dir, 'objectstack.json');
    writeFileSync(artifactPath, JSON.stringify(ARTIFACT), 'utf-8');
  });
  afterAll(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ } });

  it('surfaces permissions[] (with isDefault profile + readScope) at the top level', async () => {
    const result = await createStandaloneStack({ artifactPath, databaseUrl: 'memory://standalone-rbac' });
    expect(Array.isArray(result.permissions)).toBe(true);
    expect(result.permissions!.map((p: any) => p.name).sort()).toEqual(['app_contributor', 'app_member_default']);
    const def = result.permissions!.find((p: any) => p.name === 'app_member_default');
    expect(def.isDefault).toBe(true);
    // the hierarchy read scope must ride through intact — this is what was lost.
    expect(def.objects.note.readScope).toBe('unit_and_below');
  });

  it('surfaces roles[] at the top level', async () => {
    const result = await createStandaloneStack({ artifactPath, databaseUrl: 'memory://standalone-rbac' });
    expect(Array.isArray(result.roles)).toBe(true);
    expect(result.roles!.map((r: any) => r.name).sort()).toEqual(['contributor', 'manager']);
  });

  it('still surfaces objects/requires/manifest (no regression)', async () => {
    const result = await createStandaloneStack({ artifactPath, databaseUrl: 'memory://standalone-rbac' });
    expect(result.requires).toEqual(['auth']);
    expect(result.objects!.map((o: any) => o.name)).toEqual(['note']);
    expect(result.manifest?.id).toBe('com.test.scope-app');
  });

  it('the surfaced config drives appDefaultProfileName → the app profile (the exact CLI wiring)', async () => {
    // Reproduce serve.ts: `config = { ...originalConfig, ...standaloneStack }`,
    // then `appDefaultProfileName(config.permissions)` → SecurityPlugin fallback.
    const standaloneStack = await createStandaloneStack({ artifactPath, databaseUrl: 'memory://standalone-rbac' });
    const config: any = { ...{}, ...standaloneStack };
    expect(appDefaultProfileName(config.permissions)).toBe('app_member_default');
  });

  it('createDefaultHostConfig (the actual serve artifact-fallback) surfaces the same', async () => {
    const result = await createDefaultHostConfig({
      requireArtifact: true,
      artifactPath,
      databaseUrl: 'memory://standalone-rbac',
    });
    expect(appDefaultProfileName(result.permissions)).toBe('app_member_default');
    expect(result.roles!.map((r: any) => r.name).sort()).toEqual(['contributor', 'manager']);
  });
});

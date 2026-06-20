// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// ADR-0057 D1 — scope-depth read grants on the REAL showcase app.
// A grant's `readScope` widens the owner-match for an owner-scoped (`private`)
// object: `unit` → records owned by my business-unit co-members; `unit_and_below`
// → my BU plus all descendant BUs (BFS). Sharing still widens on top; cross-BU
// stays isolated. ('own' depth is already proven by showcase-private-owd.)
//
// @proof: showcase-scope-depth

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import showcaseStack from '@objectstack/example-showcase';
import { bootStack, type VerifyStack } from '@objectstack/verify';
import { SecurityPlugin, securityDefaultPermissionSets } from '@objectstack/plugin-security';
import { PermissionSetSchema } from '@objectstack/spec/security';

const OBJ = '/data/showcase_private_note';
const WHO = ['alice', 'bob', 'carol', 'dave'] as const;
type Who = (typeof WHO)[number];

function scopeProfile(scope: 'unit' | 'unit_and_below') {
  return PermissionSetSchema.parse({
    name: `scope_${scope}_profile`,
    label: `Scope ${scope}`,
    isProfile: true,
    isDefault: true,
    objects: {
      showcase_private_note: {
        allowRead: true, allowCreate: true, allowEdit: true,
        readScope: scope, writeScope: scope,
      },
    },
  });
}

interface World { stack: VerifyStack; tokens: Record<Who, string>; }

// Build a BU world: bu_parent ⊃ bu_child (sibling bu_other is separate).
// alice+carol ∈ bu_parent, bob ∈ bu_child, dave ∈ bu_other. Each owns one note.
async function bootScopeWorld(scope: 'unit' | 'unit_and_below'): Promise<World> {
  const stack = await bootStack(showcaseStack, {
    security: new SecurityPlugin({
      defaultPermissionSets: [...securityDefaultPermissionSets, scopeProfile(scope)],
    }),
  });
  await stack.signIn();
  const tokens = {} as Record<Who, string>;
  for (const who of WHO) tokens[who] = await stack.signUp(`scope-${who}-${scope}@verify.test`);

  const ql: any = await stack.kernel.getServiceAsync('objectql');
  const sys = (o: string, d: any) => ql.insert(o, d, { context: { isSystem: true } });
  const uid = async (who: Who) =>
    (await ql.findOne('sys_user', { where: { email: `scope-${who}-${scope}@verify.test` }, context: { isSystem: true } }))?.id;
  const id = {} as Record<Who, string>;
  for (const who of WHO) id[who] = await uid(who);

  // org (BU.organization_id is required) — reuse any existing, else create one.
  let org = await ql.findOne('sys_organization', { where: {}, context: { isSystem: true } }).catch(() => null);
  let orgId = org?.id;
  if (!orgId) { orgId = 'org_scope'; await sys('sys_organization', { id: orgId, name: 'Scope Org', slug: `scope_${scope}` }).catch(() => {}); }

  const p = `${scope}`;
  await sys('sys_business_unit', { id: `bu_parent_${p}`, name: 'Parent', kind: 'division', organization_id: orgId, active: true });
  await sys('sys_business_unit', { id: `bu_child_${p}`, name: 'Child', kind: 'department', parent_business_unit_id: `bu_parent_${p}`, organization_id: orgId, active: true });
  await sys('sys_business_unit', { id: `bu_other_${p}`, name: 'Other', kind: 'division', organization_id: orgId, active: true });
  await sys('sys_business_unit_member', { id: `m_a_${p}`, business_unit_id: `bu_parent_${p}`, user_id: id.alice });
  await sys('sys_business_unit_member', { id: `m_c_${p}`, business_unit_id: `bu_parent_${p}`, user_id: id.carol });
  await sys('sys_business_unit_member', { id: `m_b_${p}`, business_unit_id: `bu_child_${p}`, user_id: id.bob });
  await sys('sys_business_unit_member', { id: `m_d_${p}`, business_unit_id: `bu_other_${p}`, user_id: id.dave });

  for (const who of WHO) {
    const r = await stack.apiAs(tokens[who], 'POST', OBJ, { title: `${who} note` });
    expect(r.status, `${who} creates note`).toBeLessThan(300);
  }
  return { stack, tokens };
}

async function titles(stack: VerifyStack, token: string): Promise<string[]> {
  const r = await stack.apiAs(token, 'GET', OBJ);
  expect(r.status).toBe(200);
  const b: any = await r.json();
  return (b.records ?? b.data ?? b ?? []).map((x: any) => x.title).filter(Boolean);
}

describe('showcase: scope-depth read — `unit` (ADR-0057 D1)', () => {
  let world: World;
  beforeAll(async () => { world = await bootScopeWorld('unit'); }, 120_000);
  afterAll(async () => { await world?.stack?.stop(); });

  it('widens to BU co-members, NOT child or sibling BUs', async () => {
    const t = await titles(world.stack, world.tokens.alice);
    expect(t).toContain('alice note');   // own
    expect(t).toContain('carol note');   // same BU (widened)
    expect(t).not.toContain('bob note');  // child BU — `unit` does not descend
    expect(t).not.toContain('dave note'); // sibling BU — isolated
  });

  it('a lone child member sees only their own', async () => {
    const t = await titles(world.stack, world.tokens.bob);
    expect(t.sort()).toEqual(['bob note']);
  });
});

describe('showcase: scope-depth read — `unit_and_below` (ADR-0057 D1)', () => {
  let world: World;
  beforeAll(async () => { world = await bootScopeWorld('unit_and_below'); }, 120_000);
  afterAll(async () => { await world?.stack?.stop(); });

  it('descends into child BUs (BFS subtree)', async () => {
    const t = await titles(world.stack, world.tokens.alice);
    expect(t).toContain('alice note');   // own
    expect(t).toContain('carol note');   // same BU
    expect(t).toContain('bob note');     // child BU — subtree descent
    expect(t).not.toContain('dave note'); // sibling root — still isolated
  });

  it('the child member does NOT roll up into the parent', async () => {
    const t = await titles(world.stack, world.tokens.bob);
    expect(t.sort()).toEqual(['bob note']); // child has no descendants; no upward visibility
  });
});

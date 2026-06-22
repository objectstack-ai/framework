// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0057 addendum D10 — Setup-nav surfacing follows capability.
 *
 * Organizations/Invitations are gated on the `org-scoping` (multi-org) kernel
 * service via `NavigationItem.requiresService`, enforced server-side in
 * rest-server's `filterAppForUser`. Business Units is intentionally NOT gated
 * (open per the open/paid seam + D12). This proves the served Setup app
 * metadata reflects that across single-tenant vs multi-org boots.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import showcaseStack from '@objectstack/example-showcase';
import { bootStack, type VerifyStack } from '@objectstack/verify';

async function servedAppMetaText(multiTenant: boolean): Promise<string> {
  const stack: VerifyStack = await bootStack(showcaseStack, { multiTenant });
  try {
    const token = await stack.signIn();
    const res = await stack.apiAs(token, 'GET', '/meta/app');
    expect(res.status).toBe(200);
    return JSON.stringify(await res.json());
  } finally {
    await stack.stop();
  }
}

describe('ADR-0057 D10: Setup nav surfacing follows capability', () => {
  let single = '';
  let multi = '';

  beforeAll(async () => {
    single = await servedAppMetaText(false);
    multi = await servedAppMetaText(true);
  }, 180_000);

  it('hides Organizations/Invitations in single-tenant (no org-scoping service)', () => {
    expect(single).not.toContain('nav_organizations');
    expect(single).not.toContain('nav_invitations');
  });

  it('shows Organizations/Invitations when multi-org (org-scoping) is active', () => {
    expect(multi).toContain('nav_organizations');
    expect(multi).toContain('nav_invitations');
  });

  it('keeps Business Units visible in BOTH editions (open per seam + D12)', () => {
    expect(single).toContain('nav_business_units');
    expect(multi).toContain('nav_business_units');
  });
});

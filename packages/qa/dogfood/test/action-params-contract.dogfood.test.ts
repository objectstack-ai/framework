// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// ADR-0104 D2 — action param contract enforced at dispatch, over real HTTP.
//
// The showcase `showcase_action_param_gallery` action (on field-zoo) declares
// a required `p_text`, an option-bearing `p_priority` select, and an inline
// lookup `p_account`. Its body echoes the received param keys. We drive the
// real `/actions/:object/:action` route to prove the declared contract is
// enforced BEFORE the body runs:
//   - warn-first (default): a malformed bag still passes (legacy callers keep
//     working; the drift is logged, not fatal).
//   - strict (OS_ACTION_PARAMS_STRICT_ENABLED=1): the same bag is rejected 400
//     before the handler runs; a conformant bag passes.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import showcaseStack from '@objectstack/example-showcase';
import { bootStack, type VerifyStack } from '@objectstack/verify';

const ACTION_PATH = '/actions/showcase_field_zoo/showcase_action_param_gallery';

describe('dogfood: action param contract enforced at dispatch (ADR-0104 D2)', () => {
  let stack: VerifyStack;
  let token: string;

  beforeAll(async () => {
    stack = await bootStack(showcaseStack);
    token = await stack.signIn();
  }, 60_000);

  afterAll(async () => {
    delete process.env.OS_ACTION_PARAMS_STRICT_ENABLED;
    await stack?.stop();
  });

  // A bag that violates the declaration three ways: missing required `p_text`,
  // a `p_priority` outside its options, and an undeclared `bogus` key.
  const badBag = { p_priority: 'NOT_AN_OPTION', bogus: 123 };
  const goodBag = { p_text: 'Hello', p_priority: 'high' };

  it('warn-first (default): a malformed param bag still passes and the body runs', async () => {
    delete process.env.OS_ACTION_PARAMS_STRICT_ENABLED;
    const res = await stack.apiAs(token, 'POST', ACTION_PATH, { params: badBag });
    expect(res.status, `expected pass-through, got ${res.status}: ${await res.clone().text()}`).toBeLessThan(300);
  });

  it('strict: the same malformed bag is rejected 400 before the handler runs', async () => {
    process.env.OS_ACTION_PARAMS_STRICT_ENABLED = '1';
    try {
      const res = await stack.apiAs(token, 'POST', ACTION_PATH, { params: badBag });
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toMatch(/p_text/);       // required
      expect(text).toMatch(/p_priority/);   // bad option
      expect(text).toMatch(/bogus/);        // unknown key
    } finally {
      delete process.env.OS_ACTION_PARAMS_STRICT_ENABLED;
    }
  });

  it('strict: a conformant bag passes (dispatcher built-in keys are allowlisted)', async () => {
    process.env.OS_ACTION_PARAMS_STRICT_ENABLED = '1';
    try {
      const res = await stack.apiAs(token, 'POST', ACTION_PATH, { params: goodBag });
      expect(res.status, `expected pass, got ${res.status}: ${await res.clone().text()}`).toBeLessThan(300);
    } finally {
      delete process.env.OS_ACTION_PARAMS_STRICT_ENABLED;
    }
  });
});

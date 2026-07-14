import { test, expect, request as pwRequest } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Permission-model configuration-surface e2e (checklist sections N + O).
 *
 * Section N — how a system administrator configures positions through the
 * Setup app UI (Access Control group): list page, create form, record detail
 * overlay with the Holders / Permission Sets related lists, non-admin denial,
 * anchor-row protection.
 *
 * Section O — position → permission-set mapping end to end: bind
 * showcase_auditor to a UI-created position, assign a baseline user, watch
 * the capability arrive in the console (empty inquiry list → full list),
 * then revoke and watch it disappear. Visual evidence goes to
 * docs/test/screenshots/.
 *
 * Run together with the behaviour spec (see playwright.permission.config.ts):
 *   PERM_BASE_URL=http://localhost:3777 pnpm exec playwright test --config playwright.permission.config.ts
 */

const BASE = process.env.PERM_BASE_URL || 'http://localhost:3000';
const PASSWORD = 'Passw0rd!234';
const ADMIN_EMAIL = 'admin@objectos.ai';
const ADMIN_PASSWORD = 'admin123';
const SHOTS = 'docs/test/screenshots';

/** Position created through the UI in N3 and torn down in O9. */
const POSITION_NAME = 'qa_lead';
const POSITION_LABEL = 'QA Lead';
const BOUND_SET = 'showcase_auditor';
const ASSIGNEE_EMAIL = 'newbie@example.com';
const SEED_INQUIRIES = /meridian|brightline|oldrequest/;

async function signIn(email: string, password = PASSWORD) {
  const anon = await pwRequest.newContext({ baseURL: BASE });
  const res = await anon.post('/api/v1/auth/sign-in/email', {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) throw new Error(`sign-in ${email} failed (${res.status()}): ${await res.text()}`);
  const token = ((await res.json()) as { token: string }).token;
  const cookies = (await anon.storageState()).cookies;
  await anon.dispose();
  const api = await pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  return { token, cookies, api };
}

async function uiContext(browser: Browser, email: string, password = PASSWORD): Promise<BrowserContext> {
  const { token, cookies } = await signIn(email, password);
  return browser.newContext({
    storageState: {
      cookies,
      origins: [{ origin: BASE, localStorage: [{ name: 'auth-session-token', value: token }] }],
    },
  });
}

async function records(api: APIRequestContext, path: string): Promise<Record<string, unknown>[]> {
  const res = await api.get(`/api/v1/data/${path}`);
  expect(res.ok(), `GET ${path} -> ${res.status()}`).toBe(true);
  return ((await res.json()) as { records?: Record<string, unknown>[] }).records ?? [];
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function settle(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

/** Effective permissions as the console sees them (GET /auth/me/permissions). */
async function mePermissions(email: string): Promise<string> {
  const { api } = await signIn(email);
  const res = await api.get('/api/v1/auth/me/permissions');
  expect(res.ok()).toBe(true);
  const body = JSON.stringify(await res.json());
  await api.dispose();
  return body;
}

let admin: APIRequestContext;

async function positionRow(name: string): Promise<Record<string, unknown> | undefined> {
  return (await records(admin, 'sys_position?limit=200')).find((p) => p.name === name);
}

/** Remove any qa_lead leftovers from a previous (possibly aborted) run. */
async function cleanupQaLead() {
  const held = await records(admin, `sys_user_position?limit=500`);
  for (const h of held.filter((h) => h.position === POSITION_NAME)) {
    await admin.delete(`/api/v1/data/sys_user_position/${h.id}`);
  }
  const pos = await positionRow(POSITION_NAME);
  if (pos) {
    const bindings = await records(admin, 'sys_position_permission_set?limit=500');
    for (const b of bindings.filter((b) => b.position_id === pos.id)) {
      await admin.delete(`/api/v1/data/sys_position_permission_set/${b.id}`);
    }
    await admin.delete(`/api/v1/data/sys_position/${pos.id}`);
  }
}

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  admin = (await signIn(ADMIN_EMAIL, ADMIN_PASSWORD)).api;
  // The assignee persona may not exist on a fresh backend (idempotent sign-up).
  const anon = await pwRequest.newContext({ baseURL: BASE });
  await anon.post('/api/v1/auth/sign-up/email', {
    data: { email: ASSIGNEE_EMAIL, password: PASSWORD, name: 'Newbie' },
    headers: { 'Content-Type': 'application/json' },
  });
  await anon.dispose();
  await cleanupQaLead();
});

test.afterAll(async () => {
  await cleanupQaLead();
  await admin?.dispose();
});

// ---------------------------------------------------------------------------
// N. admin configures positions through the Setup UI
// ---------------------------------------------------------------------------

test.describe.serial('N. Setup UI — position administration', () => {
  test('N1 — positions list: showcase + built-in + anchor rows, New button, view tabs', async ({
    browser,
  }) => {
    const ctx = await uiContext(browser, ADMIN_EMAIL, ADMIN_PASSWORD);
    const page = await ctx.newPage();
    await settle(page, `${BASE}/_console/apps/setup/sys_position`);
    const body = await page.locator('body').innerText();
    // App-declared positions, built-in identity positions, audience anchors.
    for (const expected of ['Contributor', 'Auditor', 'Platform Admin', 'Everyone', 'Guest']) {
      expect(body, `positions grid must list ${expected}`).toContain(expected);
    }
    await expect(page.getByRole('button', { name: 'New', exact: true }).first()).toBeVisible();
    // List views contributed by the sys_position object definition.
    expect(body).toContain('Default');
    await shot(page, 'N1-admin-positions-list');
    await ctx.close();
  });

  test('N2 — create-position form exposes the ADR-0090/0091 fields', async ({ browser }) => {
    const ctx = await uiContext(browser, ADMIN_EMAIL, ADMIN_PASSWORD);
    const page = await ctx.newPage();
    await settle(page, `${BASE}/_console/apps/setup/sys_position`);
    await page.getByRole('button', { name: 'New', exact: true }).first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('input[name="label"]')).toBeVisible({ timeout: 10_000 });
    for (const field of ['input[name="name"]', 'input[name="active"]', 'input[name="is_default"]', 'input[name="delegatable"]']) {
      await expect(dialog.locator(field)).toBeAttached();
    }
    const text = await dialog.innerText();
    expect(text).toContain('Default Position'); // is_default: auto-assigned to new users
    expect(text).toContain('Delegatable'); // ADR-0091 D3 self-service delegation opt-in
    await shot(page, 'N2-position-new-form');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await ctx.close();
  });

  test('N3 — admin creates a position through the UI', async ({ browser }) => {
    const ctx = await uiContext(browser, ADMIN_EMAIL, ADMIN_PASSWORD);
    const page = await ctx.newPage();
    await settle(page, `${BASE}/_console/apps/setup/sys_position`);
    await page.getByRole('button', { name: 'New', exact: true }).first().click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[name="label"]').fill(POSITION_LABEL);
    await dialog.locator('input[name="name"]').fill(POSITION_NAME);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    // The row lands in sys_position as an ordinary (non-system) record.
    await expect.poll(async () => (await positionRow(POSITION_NAME)) !== undefined, {
      timeout: 15_000,
    }).toBe(true);
    const row = (await positionRow(POSITION_NAME))!;
    expect(row.managed_by ?? 'user').not.toBe('system');
    await settle(page, `${BASE}/_console/apps/setup/sys_position`);
    await expect(page.locator('body')).toContainText(POSITION_LABEL);
    await shot(page, 'N3-position-qa-lead-created');
    await ctx.close();
  });

  test('N4 — position detail overlay: Holders + Permission Sets related lists', async ({
    browser,
  }) => {
    const contributor = await positionRow('contributor');
    expect(contributor).toBeTruthy();
    const ctx = await uiContext(browser, ADMIN_EMAIL, ADMIN_PASSWORD);
    const page = await ctx.newPage();
    await settle(page, `${BASE}/_console/apps/setup/sys_position?recordId=${contributor!.id}`);
    await page.waitForTimeout(1500);
    const body = await page.locator('body').innerText();
    expect(body).toContain('Holders'); // sys_user_position related list
    expect(body).toContain('Permission Sets'); // sys_position_permission_set related list
    expect(body).toContain('Assign user');
    await shot(page, 'N4-position-detail-related-lists');
    await ctx.close();
  });

  test('N5 — non-admin (ada) gets no Setup access: nav absent, grid load denied', async ({
    browser,
  }) => {
    const ctx = await uiContext(browser, 'ada@example.com');
    const page = await ctx.newPage();
    await settle(page, `${BASE}/_console/apps/setup/sys_position`);
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    // The setup app (gated by setup.access) is not resolvable for ada: the
    // console falls back to her default app shell and the sys_position grid
    // query is rejected by the data plane.
    expect(body).not.toContain('Access Control');
    expect(body).toMatch(/Couldn.t load records/);
    await shot(page, 'N5-nonadmin-positions-denied');
    await ctx.close();
  });

  test('N6 — anchor rows (everyone/guest) are system-managed and undeletable', async () => {
    const everyone = await positionRow('everyone');
    expect(everyone).toBeTruthy();
    expect(everyone!.managed_by).toBe('system');
    const del = await admin.delete(`/api/v1/data/sys_position/${everyone!.id}`);
    expect(del.status(), 'deleting the everyone anchor must be rejected').toBeGreaterThanOrEqual(400);
    expect(await positionRow('everyone')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// O. position → permission-set mapping + assignment, end to end
// ---------------------------------------------------------------------------

test.describe.serial('O. mapping + assignment end-to-end', () => {
  let positionId: string;
  let permissionSetId: string;
  let bindingId: string;
  let assignmentId: string;

  test('O1 — before: newbie sees no inquiries (everyone baseline only)', async ({ browser }) => {
    const ctx = await uiContext(browser, ASSIGNEE_EMAIL);
    const page = await ctx.newPage();
    await settle(page, `${BASE}/_console/apps/showcase_app/showcase_inquiry`);
    expect(await page.locator('body').innerText()).not.toMatch(SEED_INQUIRIES);
    await shot(page, 'O1-newbie-inquiries-before');
    await ctx.close();
  });

  test('O2 — admin binds showcase_auditor to qa_lead; detail shows the binding', async ({
    browser,
  }) => {
    const pos = await positionRow(POSITION_NAME); // created via the UI in N3
    expect(pos, 'qa_lead must exist (N3)').toBeTruthy();
    positionId = pos!.id as string;
    const sets = await records(admin, 'sys_permission_set?limit=200');
    permissionSetId = sets.find((s) => s.name === BOUND_SET)?.id as string;
    expect(permissionSetId, `${BOUND_SET} projection row must exist`).toBeTruthy();

    const bind = await admin.post('/api/v1/data/sys_position_permission_set', {
      data: { position_id: positionId, permission_set_id: permissionSetId },
    });
    expect(bind.ok(), `bind -> ${bind.status()}`).toBe(true);
    bindingId = ((await bind.json()) as { id: string }).id;

    const ctx = await uiContext(browser, ADMIN_EMAIL, ADMIN_PASSWORD);
    const page = await ctx.newPage();
    await settle(page, `${BASE}/_console/apps/setup/sys_position?recordId=${positionId}`);
    const tab = page.getByRole('tab', { name: /Permission Sets/ });
    if (await tab.count()) {
      await tab.first().click();
    } else {
      await page.getByText('Permission Sets', { exact: true }).last().click();
    }
    await page.waitForTimeout(1500);
    // The related-list grid renders the bound set's API name (lookup columns
    // resolve the target's `name` field), plus the "Bind permission set" CTA.
    await expect(page.locator('body')).toContainText('showcase_auditor');
    await expect(page.locator('body')).toContainText('Bind permission set');
    await shot(page, 'O2-qa-lead-bound-showcase-auditor');
    await ctx.close();
  });

  test('O3 — admin assigns newbie; grant shows up in /auth/me/permissions', async () => {
    const users = await records(admin, 'sys_user?limit=200');
    const uid = users.find((u) => u.email === ASSIGNEE_EMAIL)?.id as string;
    expect(uid).toBeTruthy();
    const assign = await admin.post('/api/v1/data/sys_user_position', {
      data: { user_id: uid, position: POSITION_NAME },
    });
    expect(assign.ok(), `assign -> ${assign.status()}`).toBe(true);
    assignmentId = ((await assign.json()) as { id: string }).id;

    const me = await mePermissions(ASSIGNEE_EMAIL);
    expect(me).toContain(POSITION_NAME);
    expect(me).toContain(BOUND_SET);
  });

  test('O4 — after: newbie sees every inquiry (viewAllRecords via new position)', async ({
    browser,
  }) => {
    const adminCount = (await records(admin, 'showcase_inquiry?limit=200')).length;
    const { api } = await signIn(ASSIGNEE_EMAIL);
    expect((await records(api, 'showcase_inquiry?limit=200')).length).toBe(adminCount);
    await api.dispose();

    const ctx = await uiContext(browser, ASSIGNEE_EMAIL);
    const page = await ctx.newPage();
    await settle(page, `${BASE}/_console/apps/showcase_app/showcase_inquiry`);
    expect(await page.locator('body').innerText()).toMatch(SEED_INQUIRIES);
    await shot(page, 'O4-newbie-inquiries-after-assignment');
    await ctx.close();
  });

  test('O5 — VAMA read-only boundary: newbie still cannot edit a foreign inquiry', async () => {
    const target = (await records(admin, 'showcase_inquiry?limit=10'))[0];
    const { api } = await signIn(ASSIGNEE_EMAIL);
    const patch = await api.patch(`/api/v1/data/showcase_inquiry/${target.id}`, {
      data: { message: 'qa-lead-write-attempt' },
    });
    expect(patch.status()).toBeGreaterThanOrEqual(400);
    await api.dispose();
  });

  test('O6 — duplicate binding is rejected (unique position_id + permission_set_id)', async () => {
    const dup = await admin.post('/api/v1/data/sys_position_permission_set', {
      data: { position_id: positionId, permission_set_id: permissionSetId },
    });
    expect(dup.ok()).toBe(false);
  });

  test('O7 — revoking the assignment takes the capability away again', async ({ browser }) => {
    const del = await admin.delete(`/api/v1/data/sys_user_position/${assignmentId}`);
    expect(del.ok()).toBe(true);

    const me = await mePermissions(ASSIGNEE_EMAIL);
    expect(me).not.toContain(POSITION_NAME);

    const { api } = await signIn(ASSIGNEE_EMAIL);
    expect((await records(api, 'showcase_inquiry?limit=200')).length).toBe(0);
    await api.dispose();

    const ctx = await uiContext(browser, ASSIGNEE_EMAIL);
    const page = await ctx.newPage();
    await settle(page, `${BASE}/_console/apps/showcase_app/showcase_inquiry`);
    expect(await page.locator('body').innerText()).not.toMatch(SEED_INQUIRIES);
    await shot(page, 'O7-newbie-inquiries-revoked');
    await ctx.close();
  });

  test('O9 — cleanup: unbind and delete the qa_lead position', async () => {
    const unbind = await admin.delete(`/api/v1/data/sys_position_permission_set/${bindingId}`);
    expect(unbind.ok()).toBe(true);
    const delPos = await admin.delete(`/api/v1/data/sys_position/${positionId}`);
    expect(delPos.ok()).toBe(true);
    expect(await positionRow(POSITION_NAME)).toBeUndefined();
  });
});

import { test, expect, request } from '@playwright/test';

/**
 * Shared driver-acceptance suite for the CRM example.
 * Each driver-specific spec calls `runDriverAcceptance({ label, baseURL })`.
 * The CRM dev server is expected to be reachable at `baseURL`,
 * already booted with the appropriate `OS_DATABASE_URL` for the driver
 * under test (this is wired by the Playwright `webServer` config or by
 * a wrapper script that boots the server out-of-band).
 */
export function runDriverAcceptance(opts: { label: string; baseURL?: string }) {
  const BASE_URL = opts.baseURL ?? process.env.CRM_BASE_URL ?? 'http://localhost:3001';

  test.describe(`CRM running on ${opts.label} driver`, () => {
    test('Studio responds', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const studio = await ctx.get('/_studio/');
      expect(studio.status()).toBeGreaterThanOrEqual(200);
      expect(studio.status()).toBeLessThan(500);
      await ctx.dispose();
    });

    test('seed data is queryable', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/api/v1/data/account?limit=10');
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body.object).toBe('account');
      expect(Array.isArray(body.records)).toBe(true);
      expect(body.records.length).toBeGreaterThan(0);
      await ctx.dispose();
    });

    test('CRUD round-trip on account', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const unique = `Playwright ${opts.label} ${Date.now()}`;

      const created = await ctx.post('/api/v1/data/account', {
        data: { name: unique, industry: 'technology', type: 'prospect' },
      });
      expect(created.ok()).toBe(true);
      const createdBody = await created.json();
      const id = createdBody.id ?? createdBody.record?.id;
      expect(id).toBeTruthy();
      expect(createdBody.record?.name).toBe(unique);

      const fetched = await ctx.get(`/api/v1/data/account/${id}`);
      expect(fetched.ok()).toBe(true);
      const fetchedBody = await fetched.json();
      expect(fetchedBody.record?.name).toBe(unique);

      const updated = await ctx.patch(`/api/v1/data/account/${id}`, {
        data: { industry: 'finance' },
      });
      expect(updated.ok()).toBe(true);

      const reread = await ctx.get(`/api/v1/data/account/${id}`);
      const rereadBody = await reread.json();
      expect(rereadBody.record?.industry).toBe('finance');

      const deleted = await ctx.delete(`/api/v1/data/account/${id}`);
      expect(deleted.ok()).toBe(true);

      await ctx.dispose();
    });

    test('analytics aggregate returns measure values per dimension', async () => {
      // Regression guard for a 3-layer bug where:
      //   1. engine.aggregate() called driver.find() instead of driver.aggregate(),
      //      so groupBy / aggregations were silently ignored.
      //   2. resolveMeasure() did not accept `${field}_${type}` aliases (e.g.
      //      'amount_sum' for measure 'amount' of type 'sum'), so the measure
      //      was dropped from the SELECT.
      // Without this test the failure mode is silent (200 OK, rows present,
      // but every row is missing the measure value), and dashboard charts
      // render empty axes with no bars.
      const ctx = await request.newContext({ baseURL: BASE_URL });

      const grouped = await ctx.post('/api/v1/analytics/query', {
        data: {
          cube: 'opportunity',
          measures: ['amount_sum'],
          dimensions: ['stage'],
        },
      });
      expect(grouped.ok()).toBe(true);
      const groupedBody = await grouped.json();
      const groupedRows: Array<Record<string, unknown>> =
        groupedBody?.data?.rows ?? groupedBody?.rows ?? [];
      expect(groupedRows.length).toBeGreaterThan(0);
      for (const row of groupedRows) {
        expect(row).toHaveProperty('stage');
        expect(typeof row.amount_sum).toBe('number');
        expect(row.amount_sum as number).toBeGreaterThan(0);
      }

      const total = await ctx.post('/api/v1/analytics/query', {
        data: {
          cube: 'opportunity',
          measures: ['amount_sum'],
        },
      });
      expect(total.ok()).toBe(true);
      const totalBody = await total.json();
      const totalRows: Array<Record<string, unknown>> =
        totalBody?.data?.rows ?? totalBody?.rows ?? [];
      expect(totalRows).toHaveLength(1);
      expect(typeof totalRows[0].amount_sum).toBe('number');
      const groupedSum = groupedRows.reduce(
        (acc, r) => acc + ((r.amount_sum as number) || 0),
        0,
      );
      expect(totalRows[0].amount_sum).toBe(groupedSum);

      await ctx.dispose();
    });
  });
}

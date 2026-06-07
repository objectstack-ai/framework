// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import type { Cube } from '@objectstack/spec/data';
import type { AnalyticsQuery, StrategyContext } from '@objectstack/spec/contracts';
import { NativeSQLStrategy } from '../strategies/native-sql-strategy.js';

/** opportunity cube with a relationship dimension (account.region). */
const cube: Cube = {
  name: 'sales',
  title: 'Sales',
  sql: 'opportunity',
  measures: { revenue: { name: 'revenue', label: 'Revenue', type: 'sum', sql: 'amount' } },
  dimensions: { region: { name: 'region', label: 'Region', type: 'string', sql: 'account.region' } },
  public: false,
};

const query: AnalyticsQuery = {
  cube: 'sales',
  measures: ['revenue'],
  dimensions: ['region'],
  timezone: 'UTC',
};

function ctxWith(overrides: Partial<StrategyContext>): StrategyContext {
  return {
    getCube: (name) => (name === 'sales' ? cube : undefined),
    queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
    executeRawSql: async () => [],
    ...overrides,
  };
}

describe('NativeSQLStrategy — D-C RLS hardening', () => {
  it('injects the tenant read scope for BOTH the base table and the joined object', async () => {
    const strategy = new NativeSQLStrategy();
    const ctx = ctxWith({
      getReadScope: (obj) => ({ organization_id: `org_for_${obj}` }),
      getAllowedRelationships: () => new Set(['account']),
    });

    const { sql, params } = await strategy.generateSql(query, ctx);

    // base table opportunity is scoped
    expect(sql).toContain('"opportunity"."organization_id" =');
    // joined table account is scoped too — this is the bypass that D-C closes
    expect(sql).toContain('"account"."organization_id" =');
    // both tenant params are bound
    expect(params).toContain('org_for_opportunity');
    expect(params).toContain('org_for_account');
  });

  it('rejects a join whose alias is not in the declared relationship allowlist', async () => {
    const strategy = new NativeSQLStrategy();
    const ctx = ctxWith({
      // account is NOT allowed → the account.region join must be refused
      getAllowedRelationships: () => new Set<string>(),
    });

    await expect(strategy.generateSql(query, ctx)).rejects.toThrow(
      /join "account" is not backed by a declared relationship/,
    );
  });

  it('allows the join when the relationship is declared', async () => {
    const strategy = new NativeSQLStrategy();
    const ctx = ctxWith({ getAllowedRelationships: () => new Set(['account']) });
    const { sql } = await strategy.generateSql(query, ctx);
    expect(sql).toContain('LEFT JOIN "account"');
  });

  it('joins the resolved TARGET TABLE when cube.joins maps alias→table (namespaced)', async () => {
    // alias `account` → table `crm_account` (what the dataset compiler emits).
    const nsCube: Cube = { ...cube, joins: { account: { name: 'crm_account', relationship: 'many_to_one', sql: '' } } };
    const strategy = new NativeSQLStrategy();
    const ctx = ctxWith({
      getCube: (n) => (n === 'sales' ? nsCube : undefined),
      getReadScope: (obj) => ({ organization_id: `org:${obj}` }),
      getAllowedRelationships: () => new Set(['account']),
    });
    const { sql, params } = await strategy.generateSql(query, ctx);
    // join targets the real table, aliased to the relationship name
    expect(sql).toContain('LEFT JOIN "crm_account" "account" ON "opportunity"."account" = "account"."id"');
    expect(sql).toContain('"account"."region"');
    // RLS scope for the joined object uses the TARGET object name (crm_account)
    expect(params).toContain('org:crm_account');
    expect(params).toContain('org:opportunity');
  });

  it('is backward-compatible: no scope hooks → no scope predicates, no allowlist check', async () => {
    const strategy = new NativeSQLStrategy();
    const ctx = ctxWith({});
    const { sql } = await strategy.generateSql(query, ctx);
    expect(sql).not.toContain('organization_id');
    expect(sql).toContain('LEFT JOIN "account"');
  });

  it('renumbers scope params after existing filter params', async () => {
    const strategy = new NativeSQLStrategy();
    const ctx = ctxWith({
      getReadScope: (obj) => (obj === 'opportunity' ? { organization_id: 'org1' } : undefined),
      getAllowedRelationships: () => new Set(['account']),
    });
    const filteredQuery: AnalyticsQuery = { ...query, where: { stage: 'won' } };
    const { sql, params } = await strategy.generateSql(filteredQuery, ctx);
    // filter param bound first ($1), scope param second ($2)
    expect(params).toEqual(['won', 'org1']);
    expect(sql).toContain('$2');
  });
});

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetupPlugin } from './setup-plugin.js';
import { SETUP_AREAS, SETUP_AREA_IDS } from './setup-areas.js';
import { SETUP_APP_DEFAULTS } from './setup-app.js';
import type { SetupNavContribution } from './setup-app.js';

// ---------------------------------------------------------------------------
// Helper — mock PluginContext
// ---------------------------------------------------------------------------
function createMockContext() {
  const services = new Map<string, any>();
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    },
    registerService: vi.fn((name: string, svc: any) => {
      services.set(name, svc);
    }),
    getService: vi.fn((name: string) => services.get(name)),
    services,
  } as any;
}

// ---------------------------------------------------------------------------
// Setup Areas — constants
// ---------------------------------------------------------------------------
describe('SETUP_AREAS', () => {
  it('should define exactly 4 built-in areas', () => {
    expect(SETUP_AREAS).toHaveLength(4);
  });

  it('should have well-known IDs', () => {
    const ids = SETUP_AREAS.map((a) => a.id);
    expect(ids).toContain(SETUP_AREA_IDS.administration);
    expect(ids).toContain(SETUP_AREA_IDS.platform);
    expect(ids).toContain(SETUP_AREA_IDS.system);
    expect(ids).toContain(SETUP_AREA_IDS.ai);
  });

  it('should have empty navigation arrays by default', () => {
    for (const area of SETUP_AREAS) {
      expect(area.navigation).toEqual([]);
    }
  });

  it('should be sorted by ascending order', () => {
    const orders = SETUP_AREAS.map((a) => a.order!);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThan(orders[i - 1]);
    }
  });

  it('each area should have i18n labels', () => {
    for (const area of SETUP_AREAS) {
      expect(typeof area.label).toBe('object');
      expect((area.label as any).key).toBeDefined();
      expect((area.label as any).defaultValue).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Setup App defaults
// ---------------------------------------------------------------------------
describe('SETUP_APP_DEFAULTS', () => {
  it('should have name "setup"', () => {
    expect(SETUP_APP_DEFAULTS.name).toBe('setup');
  });

  it('should have i18n label', () => {
    expect(typeof SETUP_APP_DEFAULTS.label).toBe('object');
    expect((SETUP_APP_DEFAULTS.label as any).defaultValue).toBe('Setup');
  });

  it('should require setup.access permission', () => {
    expect(SETUP_APP_DEFAULTS.requiredPermissions).toContain('setup.access');
  });

  it('should use the settings icon', () => {
    expect(SETUP_APP_DEFAULTS.icon).toBe('settings');
  });
});

// ---------------------------------------------------------------------------
// SetupPlugin — metadata
// ---------------------------------------------------------------------------
describe('SetupPlugin', () => {
  let plugin: SetupPlugin;
  let ctx: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    plugin = new SetupPlugin();
    ctx = createMockContext();
  });

  it('should have correct metadata', () => {
    expect(plugin.name).toBe('com.objectstack.setup');
    expect(plugin.type).toBe('standard');
    expect(plugin.version).toBe('1.0.0');
  });

  // ─── init ──────────────────────────────────────────────────────

  it('should register the setupNav service during init', async () => {
    await plugin.init(ctx);

    expect(ctx.registerService).toHaveBeenCalledWith(
      'setupNav',
      expect.objectContaining({ contribute: expect.any(Function) }),
    );
  });

  // ─── start — no contributions ──────────────────────────────────

  it('should register the Setup App with no areas when no contributions', async () => {
    await plugin.init(ctx);
    await plugin.start(ctx);

    expect(ctx.registerService).toHaveBeenCalledWith(
      'app.com.objectstack.setup',
      expect.objectContaining({
        id: 'com.objectstack.setup',
        apps: expect.arrayContaining([
          expect.objectContaining({ name: 'setup' }),
        ]),
      }),
    );

    // No areas should be present — all areas are empty.
    const call = ctx.registerService.mock.calls.find(
      (c: any[]) => c[0] === 'app.com.objectstack.setup',
    );
    const app = call[1].apps[0];
    expect(app.areas).toBeUndefined();
  });

  // ─── start — with contributions ────────────────────────────────

  it('should merge contributions into correct areas', async () => {
    await plugin.init(ctx);

    // Simulate another plugin contributing nav items.
    const setupNav = ctx.services.get('setupNav');
    setupNav.contribute({
      areaId: SETUP_AREA_IDS.administration,
      items: [
        { id: 'nav_users', type: 'object', label: 'Users', objectName: 'sys_user' },
      ],
    });
    setupNav.contribute({
      areaId: SETUP_AREA_IDS.ai,
      items: [
        { id: 'nav_agents', type: 'object', label: 'Agents', objectName: 'sys_agent' },
      ],
    });

    await plugin.start(ctx);

    const call = ctx.registerService.mock.calls.find(
      (c: any[]) => c[0] === 'app.com.objectstack.setup',
    );
    const app = call[1].apps[0];

    // Only non-empty areas should be present.
    expect(app.areas).toHaveLength(2);
    expect(app.areas[0].id).toBe(SETUP_AREA_IDS.administration);
    expect(app.areas[0].navigation).toHaveLength(1);
    expect(app.areas[1].id).toBe(SETUP_AREA_IDS.ai);
    expect(app.areas[1].navigation).toHaveLength(1);
  });

  it('should support custom (unknown) area contributions', async () => {
    await plugin.init(ctx);

    const setupNav = ctx.services.get('setupNav');
    setupNav.contribute({
      areaId: 'area_custom_billing',
      items: [
        { id: 'nav_billing', type: 'page', label: 'Billing', pageName: 'page_billing' },
      ],
    });

    await plugin.start(ctx);

    const call = ctx.registerService.mock.calls.find(
      (c: any[]) => c[0] === 'app.com.objectstack.setup',
    );
    const app = call[1].apps[0];
    expect(app.areas).toHaveLength(1);
    expect(app.areas[0].id).toBe('area_custom_billing');
    expect(app.areas[0].navigation).toHaveLength(1);
  });

  it('should sort areas by order', async () => {
    await plugin.init(ctx);

    const setupNav = ctx.services.get('setupNav');
    // Contribute to system (order 30) and administration (order 10).
    setupNav.contribute({
      areaId: SETUP_AREA_IDS.system,
      items: [{ id: 'nav_logs', type: 'page', label: 'Logs', pageName: 'page_logs' }],
    });
    setupNav.contribute({
      areaId: SETUP_AREA_IDS.administration,
      items: [{ id: 'nav_users', type: 'object', label: 'Users', objectName: 'sys_user' }],
    });

    await plugin.start(ctx);

    const call = ctx.registerService.mock.calls.find(
      (c: any[]) => c[0] === 'app.com.objectstack.setup',
    );
    const app = call[1].apps[0];
    // Administration (order 10) should come before System (order 30).
    expect(app.areas[0].id).toBe(SETUP_AREA_IDS.administration);
    expect(app.areas[1].id).toBe(SETUP_AREA_IDS.system);
  });

  it('should accumulate multiple contributions to the same area', async () => {
    await plugin.init(ctx);

    const setupNav = ctx.services.get('setupNav');
    setupNav.contribute({
      areaId: SETUP_AREA_IDS.platform,
      items: [{ id: 'nav_objects', type: 'page', label: 'Objects', pageName: 'page_objects' }],
    });
    setupNav.contribute({
      areaId: SETUP_AREA_IDS.platform,
      items: [{ id: 'nav_fields', type: 'page', label: 'Fields', pageName: 'page_fields' }],
    });

    await plugin.start(ctx);

    const call = ctx.registerService.mock.calls.find(
      (c: any[]) => c[0] === 'app.com.objectstack.setup',
    );
    const app = call[1].apps[0];
    const platformArea = app.areas.find((a: any) => a.id === SETUP_AREA_IDS.platform);
    expect(platformArea).toBeDefined();
    expect(platformArea!.navigation).toHaveLength(2);
  });

  // ─── destroy ───────────────────────────────────────────────────

  it('should clean up contributions on destroy', async () => {
    await plugin.init(ctx);

    const setupNav = ctx.services.get('setupNav');
    setupNav.contribute({
      areaId: SETUP_AREA_IDS.administration,
      items: [{ id: 'nav_users', type: 'object', label: 'Users', objectName: 'sys_user' }],
    });

    await plugin.destroy();

    // After destroy + re-start, contributions should be empty.
    const ctx2 = createMockContext();
    await plugin.init(ctx2);
    await plugin.start(ctx2);

    const call = ctx2.registerService.mock.calls.find(
      (c: any[]) => c[0] === 'app.com.objectstack.setup',
    );
    const app = call[1].apps[0];
    expect(app.areas).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mergeAreas — unit tests
// ---------------------------------------------------------------------------
describe('SetupPlugin.mergeAreas', () => {
  it('should return empty array when no contributions', () => {
    const plugin = new SetupPlugin();
    expect(plugin.mergeAreas([])).toEqual([]);
  });

  it('should not mutate the SETUP_AREAS constant', () => {
    const plugin = new SetupPlugin();
    const navBefore = SETUP_AREAS.map((a) => [...a.navigation]);

    plugin.mergeAreas([
      {
        areaId: SETUP_AREA_IDS.administration,
        items: [{ id: 'nav_x', type: 'page', label: 'X', pageName: 'x' }],
      },
    ]);

    const navAfter = SETUP_AREAS.map((a) => [...a.navigation]);
    expect(navAfter).toEqual(navBefore);
  });

  it('should filter out empty areas', () => {
    const plugin = new SetupPlugin();
    const result = plugin.mergeAreas([
      {
        areaId: SETUP_AREA_IDS.platform,
        items: [{ id: 'nav_obj', type: 'page', label: 'Obj', pageName: 'p' }],
      },
    ]);
    // Only platform area should be returned.
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(SETUP_AREA_IDS.platform);
  });
});

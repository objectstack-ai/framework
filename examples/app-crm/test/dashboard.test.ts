// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { DashboardSchema } from '@objectstack/spec/ui';
import {
  CrmOverviewDashboard,
  ExecutiveDashboard,
  SalesDashboard,
  ServiceDashboard,
} from '../src/dashboards';

const dashboards = [
  ['CrmOverviewDashboard', CrmOverviewDashboard],
  ['ExecutiveDashboard', ExecutiveDashboard],
  ['SalesDashboard', SalesDashboard],
  ['ServiceDashboard', ServiceDashboard],
] as const;

describe('CRM dashboards', () => {
  for (const [name, dashboard] of dashboards) {
    describe(name, () => {
      it('parses against DashboardSchema', () => {
        expect(() => DashboardSchema.parse(dashboard)).not.toThrow();
      });

      it('uses semantic colorVariant tokens (no raw hex in widget options.color)', () => {
        for (const widget of dashboard.widgets) {
          const opts = widget.options as { color?: unknown } | undefined;
          expect(opts?.color, `widget ${widget.id} should not use options.color hex`).toBeUndefined();
        }
      });

      it('every widget has a description for accessibility/clarity', () => {
        for (const widget of dashboard.widgets) {
          expect(widget.description, `widget ${widget.id} missing description`).toBeTruthy();
        }
      });

      it('declares a header with at least one action', () => {
        expect(dashboard.header).toBeDefined();
        expect(dashboard.header?.actions?.length ?? 0).toBeGreaterThan(0);
      });

      it('declares a dateRange with a sensible default preset', () => {
        expect(dashboard.dateRange).toBeDefined();
        expect(dashboard.dateRange?.defaultRange).toBeTruthy();
      });
    });
  }
});

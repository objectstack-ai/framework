// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import stack from '../objectstack.config.js';
import { PipelineDashboard } from '../src/dashboards/pipeline.dashboard.js';

describe('app-crm minimal metadata bundle', () => {
  it('exposes the expected manifest', () => {
    expect(stack.manifest.id).toBe('com.example.crm');
    expect(stack.manifest.namespace).toBe('crm');
    expect(stack.manifest.type).toBe('app');
  });

  it('registers the 5 core objects', () => {
    const names = (stack.objects ?? []).map((o) => o.name).sort();
    expect(names).toEqual(['crm_account', 'crm_activity', 'crm_contact', 'crm_lead', 'crm_opportunity']);
  });

  it('registers exactly one app, one dashboard, one hook, and at least 3 flows', () => {
    expect(stack.apps).toHaveLength(1);
    expect(stack.dashboards).toHaveLength(1);
    expect(stack.hooks).toHaveLength(1);
    expect((stack.flows ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('ships seed data for every object', () => {
    expect(stack.data).toBeDefined();
    expect((stack.data ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('Pipeline dashboard', () => {
  const byId = new Map(PipelineDashboard.widgets.map((w: any) => [w.id, w]));

  it('lays out all 6 widgets', () => {
    expect(PipelineDashboard.widgets).toHaveLength(6);
    expect([...byId.keys()].sort()).toEqual(
      [
        'avg_deal_size_yoy',
        'opportunities_by_stage',
        'pipeline_by_industry',
        'pipeline_trend_90d',
        'total_pipeline',
        'won_this_quarter',
      ],
    );
  });

  it('uses `compareTo: previousPeriod` for the current-quarter KPI', () => {
    const w: any = byId.get('won_this_quarter');
    expect(w.compareTo).toBe('previousPeriod');
    expect(w.filter.close_date.$gte).toBe('{current_quarter_start}');
    expect(w.filter.close_date.$lte).toBe('{current_quarter_end}');
  });

  it('uses `compareTo: previousYear` for the YoY KPI', () => {
    const w: any = byId.get('avg_deal_size_yoy');
    expect(w.compareTo).toBe('previousYear');
    expect(w.filter.close_date.$gte).toBe('{current_year_start}');
    expect(w.filter.close_date.$lte).toBe('{current_year_end}');
  });

  it('uses a YoY `previousYear` compareTo on the trend chart', () => {
    const w: any = byId.get('pipeline_trend_90d');
    expect(w.compareTo).toBe('previousYear');
    expect(w.type).toBe('line');
    expect(w.categoryGranularity).toBe('month');
  });

  it('omits compareTo on widgets that do not need it (pie, total)', () => {
    expect((byId.get('total_pipeline') as any).compareTo).toBeUndefined();
    expect((byId.get('pipeline_by_industry') as any).compareTo).toBeUndefined();
  });

  it('uses `compareTo: previousPeriod` on the Opportunities by Stage bar chart', () => {
    const w: any = byId.get('opportunities_by_stage');
    expect(w.compareTo).toBe('previousPeriod');
    expect(w.type).toBe('bar');
  });

  it('widgets bind to the opportunity object', () => {
    for (const w of PipelineDashboard.widgets) {
      expect((w as any).object).toBe('crm_opportunity');
    }
  });

  it('layout positions do not overlap and fit within 12 columns', () => {
    const cells: Record<string, string> = {};
    for (const w of PipelineDashboard.widgets as any[]) {
      const { x, y, w: ww, h } = w.layout;
      expect(x + ww).toBeLessThanOrEqual(12);
      for (let i = x; i < x + ww; i++) {
        for (let j = y; j < y + h; j++) {
          const key = `${i},${j}`;
          if (cells[key]) {
            throw new Error(`Widget ${w.id} overlaps ${cells[key]} at ${key}`);
          }
          cells[key] = w.id;
        }
      }
    }
  });
});

describe('Pipeline dashboard schema validation', () => {
  it('passes the DashboardSchema zod parser end-to-end', async () => {
    const { DashboardSchema } = await import('@objectstack/spec/ui');
    const parsed = DashboardSchema.parse(PipelineDashboard);
    expect(parsed.name).toBe('pipeline_dashboard');
    expect(parsed.widgets).toHaveLength(6);
  });
});

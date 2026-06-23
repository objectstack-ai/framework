// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Operations Command Center (大屏) — a dense, full-bleed "big screen" built as a
 * pure SDUI micro-page that FOLLOWS the console theme (light ↔ dark).
 *
 * Density: object-chart's ChartContainer is `h-[350px]` by default, but it
 * honours a consumer className (→ AdvancedChartImpl → ChartContainer), so each
 * chart node carries a `responsiveStyles` height that shrinks it toward the
 * ~280px floor. Compact title + KPI strip + tight 2-col rows then fit the whole
 * board — KPIs, five charts and the work queue — without a long scroll.
 *
 * Theme-adaptive: every colour is a theme token (`hsl(var(--card))` panels,
 * `hsl(var(--foreground))` text, `hsl(var(--border))`). The root overrides
 * `--chart-1..5` with one cohesive mid-lightness ramp (reads on light AND dark);
 * KPI numbers reuse it.
 *
 * Layout note: object-chart must sit in a `display: block` panel, and the root
 * column needs `align-items: stretch` or children shrink to content width.
 */

const CHART_RAMP = {
  '--chart-1': '192 86% 46%',
  '--chart-2': '214 84% 56%',
  '--chart-3': '256 72% 62%',
  '--chart-4': '168 76% 42%',
  '--chart-5': '322 72% 56%',
};

function head(id: string, title: string, accent: string, badge?: string): any {
  return {
    id: id + '_h', type: 'flex',
    responsiveStyles: { large: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '7px', borderBottom: '1px solid hsl(var(--border))' } },
    properties: {
      children: [
        { id: id + '_bar', type: 'flex', responsiveStyles: { large: { width: '4px', height: '13px', borderRadius: '2px', background: accent, boxShadow: '0 0 9px ' + accent } }, properties: { children: [] } },
        { id: id + '_t', type: 'element:text', responsiveStyles: { large: { fontSize: '13px', fontWeight: '700', letterSpacing: '0.03em', color: 'hsl(var(--foreground))' } }, properties: { content: title } },
        ...(badge
          ? [
              { id: id + '_sp', type: 'flex', responsiveStyles: { large: { flex: '1 1 auto' } }, properties: { children: [] } },
              { id: id + '_b', type: 'element:text', responsiveStyles: { large: { fontSize: '10px', fontWeight: '700', color: 'hsl(var(--chart-2))', background: 'hsl(var(--chart-2) / 0.12)', border: '1px solid hsl(var(--chart-2) / 0.4)', borderRadius: '999px', padding: '2px 9px' } }, properties: { content: badge } },
            ]
          : []),
      ],
    },
  };
}

function panel(o: { id: string; title?: string; accent: string; badge?: string; minHeight?: string; span?: string; pad?: string; child: any }): any {
  return {
    id: o.id, type: 'flex',
    responsiveStyles: {
      large: {
        display: 'block', minWidth: '0', minHeight: o.minHeight ?? '0px',
        ...(o.span ? { gridColumn: o.span } : {}),
        padding: o.pad ?? '12px 14px 12px', borderRadius: '14px',
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        boxShadow: '0 14px 34px -24px rgba(2,6,23,0.45), inset 0 1px 0 hsl(var(--foreground) / 0.04)',
      },
      small: { padding: '12px' },
    },
    properties: { children: [...(o.title ? [head(o.id, o.title, o.accent, o.badge)] : []), o.child] },
  };
}

function band(id: string, cols: number, children: any[], gap = '12px'): any {
  return {
    id, type: 'flex',
    responsiveStyles: {
      large: { display: 'grid', gridTemplateColumns: 'repeat(' + cols + ', minmax(0,1fr))', gap, alignItems: 'stretch' },
      medium: { gridTemplateColumns: 'repeat(2, minmax(0,1fr))' },
      small: { gridTemplateColumns: '1fr' },
    },
    properties: { children },
  };
}

function stat(id: string, value: string, label: string, chartVar: string): any {
  return {
    id, type: 'flex',
    responsiveStyles: { large: { display: 'flex', flexDirection: 'column', gap: '1px', padding: '2px 4px' } },
    properties: {
      children: [
        { id: id + '_v', type: 'element:text', responsiveStyles: { large: { fontSize: '30px', fontWeight: '800', lineHeight: '1.05', color: 'hsl(var(' + chartVar + '))', fontVariantNumeric: 'tabular-nums' } }, properties: { content: value } },
        { id: id + '_l', type: 'element:text', responsiveStyles: { large: { fontSize: '11px', fontWeight: '500', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))' } }, properties: { content: label } },
      ],
    },
  };
}

// Each chart node carries a height → shrinks the ChartContainer toward its
// ~280px floor (denser than the default h-[350px]).
function chart(id: string, chartType: string, dataset: string, dimensions: string[], values: string[]): any {
  return { id, type: 'object-chart', responsiveStyles: { large: { width: '100%', minWidth: '0', height: '200px' } }, properties: { dataset, dimensions, values, chartType } };
}

const A = { c1: 'hsl(var(--chart-1))', c2: 'hsl(var(--chart-2))', c3: 'hsl(var(--chart-3))', c4: 'hsl(var(--chart-4))', c5: 'hsl(var(--chart-5))' };

export const CommandCenterPage = definePage({
  name: 'showcase_command_center',
  label: 'Command Center (大屏)',
  type: 'app',
  template: 'default',
  kind: 'full',
  isDefault: false,
  regions: [
    {
      name: 'main',
      width: 'full',
      components: [
        {
          id: 'cc_root',
          type: 'flex',
          responsiveStyles: {
            large: {
              ...CHART_RAMP,
              minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px',
              padding: '10px 20px 18px',
              background:
                'radial-gradient(1200px 520px at 50% -16%, hsl(var(--chart-1) / 0.10) 0%, transparent 60%), ' +
                'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
            },
            small: { padding: '12px', gap: '10px' },
          },
          properties: {
            children: [
              // ── Title (compact) ─────────────────────────────────────────
              {
                id: 'cc_titlebar', type: 'flex',
                responsiveStyles: { large: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '0' } },
                properties: {
                  children: [
                    { id: 'cc_title', type: 'element:text', responsiveStyles: { large: { fontSize: '23px', fontWeight: '800', letterSpacing: '0.36em', color: 'hsl(var(--foreground))', textShadow: '0 0 22px hsl(var(--chart-1) / 0.45)' }, small: { fontSize: '17px', letterSpacing: '0.14em' } }, properties: { content: '交 付 运 营 数 据 大 屏' } },
                    { id: 'cc_subtitle', type: 'element:text', responsiveStyles: { large: { fontSize: '10px', fontWeight: '600', letterSpacing: '0.34em', color: 'hsl(var(--muted-foreground))' } }, properties: { content: 'DELIVERY OPERATIONS · COMMAND CENTER' } },
                  ],
                },
              },

              // ── KPI hero strip — 6 metrics across the full width ─────────
              panel({
                id: 'cc_kpi', accent: A.c3, pad: '10px 16px',
                child: band('cc_kpi_grid', 6, [
                  stat('cc_k1', '5', '项目 Projects', '--chart-1'),
                  stat('cc_k2', '10', '任务 Tasks', '--chart-2'),
                  stat('cc_k3', '13', '客户 Accounts', '--chart-3'),
                  stat('cc_k4', '8', '待办 Open', '--chart-4'),
                  stat('cc_k5', '2', '复审 Review', '--chart-5'),
                  stat('cc_k6', '1.09M', '预算 Budget', '--chart-1'),
                ], '8px'),
              }),

              // ── Row 1 — trend (wide) + status ───────────────────────────
              band('cc_r1', 3, [
                panel({ id: 'cc_throughput', title: '任务吞吐趋势 (月)', accent: A.c2, span: 'span 2', child: chart('cc_thr_c', 'area', 'showcase_task_metrics', ['created_at'], ['task_count']) }),
                panel({ id: 'cc_status', title: '任务状态分布', accent: A.c1, child: chart('cc_status_c', 'bar', 'showcase_task_metrics', ['status'], ['task_count']) }),
              ]),

              // ── Row 2 — three charts ────────────────────────────────────
              band('cc_r2', 3, [
                panel({ id: 'cc_priority', title: '优先级分布', accent: A.c5, child: chart('cc_pri_c', 'bar', 'showcase_task_metrics', ['priority'], ['task_count']) }),
                panel({ id: 'cc_budget', title: '预算 vs 支出 (按客户)', accent: A.c4, child: chart('cc_bud_c', 'bar', 'showcase_project_metrics', ['account'], ['budget_sum', 'spent_sum']) }),
                panel({ id: 'cc_health', title: '项目健康度', accent: A.c4, child: chart('cc_health_c', 'donut', 'showcase_project_metrics', ['health'], ['project_count']) }),
              ]),

              // ── Row 3 — work queue, full width, compact ─────────────────
              panel({
                id: 'cc_queue', title: '待审核列表 · Work Queue', accent: A.c1, badge: '审批中', pad: '12px 14px 8px',
                child: { id: 'cc_queue_g', type: 'object-grid', responsiveStyles: { large: { minWidth: '0', display: 'block' } }, properties: { objectName: 'showcase_task', columns: ['title', 'project', 'status', 'priority', 'due_date'] } },
              }),
            ],
          },
        },
      ],
    },
  ],
});

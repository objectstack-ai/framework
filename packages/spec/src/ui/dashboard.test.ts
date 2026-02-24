import { describe, it, expect } from 'vitest';
import {
  DashboardSchema,
  DashboardWidgetSchema,
  DashboardHeaderSchema,
  DashboardHeaderActionSchema,
  WidgetMeasureSchema,
  Dashboard,
  WidgetColorVariantSchema,
  WidgetActionTypeSchema,
  GlobalFilterSchema,
  GlobalFilterOptionsFromSchema,
  type Dashboard as DashboardType,
  type DashboardWidget,
  type DashboardHeader,
  type DashboardHeaderAction,
  type WidgetMeasure,
  type GlobalFilter,
  type GlobalFilterOptionsFrom,
} from './dashboard.zod';
import { ChartTypeSchema } from './chart.zod';

describe('ChartTypeSchema', () => {
  it('should accept all chart types', () => {
    const types = ['metric', 'bar', 'line', 'pie', 'funnel', 'table', 'bubble', 'gauge', 'heatmap', 'pivot', 'grouped-bar'];
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid chart types', () => {
    expect(() => ChartTypeSchema.parse('invalid-chart')).toThrow();
    expect(() => ChartTypeSchema.parse('unknown')).toThrow();
  });
});

describe('DashboardWidgetSchema', () => {
  it('should accept minimal widget with layout', () => {
    const widget: DashboardWidget = {
      id: 'widget_1',
      layout: {
        x: 0,
        y: 0,
        w: 4,
        h: 2,
      },
    };

    const result = DashboardWidgetSchema.parse(widget);
    expect(result.type).toBe('metric');
    expect(result.aggregate).toBe('count');
  });

  it('should accept metric widget', () => {
    const widget: DashboardWidget = {
      id: 'total_opportunities',
      title: 'Total Opportunities',
      type: 'metric',
      object: 'opportunity',
      aggregate: 'count',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    };

    expect(() => DashboardWidgetSchema.parse(widget)).not.toThrow();
  });

  it('should accept bar chart widget', () => {
    const widget: DashboardWidget = {
      id: 'opportunities_by_stage',
      title: 'Opportunities by Stage',
      type: 'bar',
      object: 'opportunity',
      categoryField: 'stage',
      valueField: 'amount',
      aggregate: 'sum',
      layout: { x: 3, y: 0, w: 6, h: 4 },
    };

    expect(() => DashboardWidgetSchema.parse(widget)).not.toThrow();
  });

  it('should accept line chart widget', () => {
    const widget: DashboardWidget = {
      id: 'revenue_trend',
      title: 'Revenue Trend',
      type: 'line',
      object: 'opportunity',
      categoryField: 'close_date',
      valueField: 'amount',
      aggregate: 'sum',
      layout: { x: 0, y: 2, w: 12, h: 4 },
    };

    expect(() => DashboardWidgetSchema.parse(widget)).not.toThrow();
  });

  it('should accept pie chart widget', () => {
    const widget: DashboardWidget = {
      id: 'opportunities_by_type',
      title: 'Opportunities by Type',
      type: 'pie',
      object: 'opportunity',
      categoryField: 'type',
      aggregate: 'count',
      layout: { x: 9, y: 0, w: 3, h: 3 },
    };

    expect(() => DashboardWidgetSchema.parse(widget)).not.toThrow();
  });

  it('should accept pivot widget', () => {
    const widget: DashboardWidget = {
      id: 'revenue_by_region_product',
      title: 'Revenue by Region × Product',
      type: 'pivot',
      object: 'order',
      categoryField: 'region',
      measures: [
        { valueField: 'revenue', aggregate: 'sum', label: 'Total Revenue', format: '$0,0' },
        { valueField: 'quantity', aggregate: 'sum', label: 'Units Sold' },
      ],
      layout: { x: 0, y: 0, w: 12, h: 6 },
    };

    const result = DashboardWidgetSchema.parse(widget);
    expect(result.type).toBe('pivot');
    expect(result.measures).toHaveLength(2);
  });

  it('should accept funnel widget', () => {
    const widget: DashboardWidget = {
      id: 'sales_funnel',
      title: 'Sales Funnel',
      type: 'funnel',
      object: 'opportunity',
      categoryField: 'stage',
      valueField: 'amount',
      aggregate: 'sum',
      layout: { x: 0, y: 0, w: 6, h: 4 },
    };

    const result = DashboardWidgetSchema.parse(widget);
    expect(result.type).toBe('funnel');
  });

  it('should accept grouped-bar widget', () => {
    const widget: DashboardWidget = {
      id: 'quarterly_revenue_by_region',
      title: 'Quarterly Revenue by Region',
      type: 'grouped-bar',
      object: 'order',
      categoryField: 'quarter',
      valueField: 'revenue',
      aggregate: 'sum',
      layout: { x: 0, y: 0, w: 12, h: 4 },
    };

    const result = DashboardWidgetSchema.parse(widget);
    expect(result.type).toBe('grouped-bar');
  });

  it('should accept table widget', () => {
    const widget: DashboardWidget = {
      id: 'top_accounts',
      title: 'Top Accounts',
      type: 'table',
      object: 'account',
      filter: { annual_revenue: { $gt: 1000000 } },  // Modern MongoDB-style filter
      layout: { x: 0, y: 6, w: 12, h: 4 },
    };

    expect(() => DashboardWidgetSchema.parse(widget)).not.toThrow();
  });

  it('should accept widget with filter', () => {
    const widget: DashboardWidget = {
      id: 'active_opportunities',
      title: 'Active Opportunities',
      type: 'metric',
      object: 'opportunity',
      filter: { status: 'active' },
      aggregate: 'count',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    };

    expect(() => DashboardWidgetSchema.parse(widget)).not.toThrow();
  });

  it('should accept all aggregate functions', () => {
    const aggregates = ['count', 'sum', 'avg', 'min', 'max'] as const;
    
    aggregates.forEach(aggregate => {
      const widget: DashboardWidget = {
        id: 'aggregate_test',
        type: 'metric',
        aggregate,
        layout: { x: 0, y: 0, w: 3, h: 2 },
      };
      expect(() => DashboardWidgetSchema.parse(widget)).not.toThrow();
    });
  });

  it('should accept widget with custom options', () => {
    const widget: DashboardWidget = {
      id: 'custom_chart',
      title: 'Custom Chart',
      type: 'bar',
      object: 'opportunity',
      categoryField: 'stage',
      valueField: 'amount',
      layout: { x: 0, y: 0, w: 6, h: 4 },
      options: {
        colors: ['#FF6384', '#36A2EB', '#FFCE56'],
        showLegend: true,
        orientation: 'horizontal',
      },
    };

    expect(() => DashboardWidgetSchema.parse(widget)).not.toThrow();
  });

  it('should accept metric widget for text/markdown content', () => {
    const widget: DashboardWidget = {
      id: 'welcome_message',
      title: 'Welcome Message',
      type: 'metric',
      layout: { x: 0, y: 0, w: 12, h: 2 },
      options: {
        content: '# Welcome to Sales Dashboard\n\nThis dashboard shows...',
      },
    };

    expect(() => DashboardWidgetSchema.parse(widget)).not.toThrow();
  });
});

describe('DashboardSchema', () => {
  it('should accept minimal dashboard', () => {
    const dashboard: DashboardType = {
      name: 'sales_overview',
      label: 'Sales Overview',
      widgets: [],
    };

    expect(() => DashboardSchema.parse(dashboard)).not.toThrow();
  });

  it('should enforce snake_case for dashboard name', () => {
    const validNames = ['sales_dashboard', 'revenue_overview', 'my_metrics'];
    validNames.forEach(name => {
      expect(() => DashboardSchema.parse({ name, label: 'Test', widgets: [] })).not.toThrow();
    });

    const invalidNames = ['salesDashboard', 'Sales-Dashboard', '123dashboard', '_internal'];
    invalidNames.forEach(name => {
      expect(() => DashboardSchema.parse({ name, label: 'Test', widgets: [] })).toThrow();
    });
  });

  it('should accept dashboard with description', () => {
    const dashboard: DashboardType = {
      name: 'executive_dashboard',
      label: 'Executive Dashboard',
      description: 'High-level metrics for executive team',
      widgets: [],
    };

    expect(() => DashboardSchema.parse(dashboard)).not.toThrow();
  });

  describe('Real-World Dashboard Examples', () => {
    it('should accept sales pipeline dashboard', () => {
      const salesDashboard: DashboardType = {
        name: 'sales_pipeline',
        label: 'Sales Pipeline',
        description: 'Overview of sales opportunities and pipeline health',
        widgets: [
          {
            id: 'total_pipeline_value',
            title: 'Total Pipeline Value',
            type: 'metric',
            object: 'opportunity',
            valueField: 'amount',
            aggregate: 'sum',
            filter: { is_closed: false },
            layout: { x: 0, y: 0, w: 3, h: 2 },
          },
          {
            id: 'open_opportunities',
            title: 'Open Opportunities',
            type: 'metric',
            object: 'opportunity',
            aggregate: 'count',
            filter: { is_closed: false },
            layout: { x: 3, y: 0, w: 3, h: 2 },
          },
          {
            id: 'win_rate',
            title: 'Win Rate',
            type: 'metric',
            object: 'opportunity',
            layout: { x: 6, y: 0, w: 3, h: 2 },
            options: {
              formula: 'COUNT(status="won") / COUNT(is_closed=true) * 100',
              suffix: '%',
            },
          },
          {
            id: 'avg_deal_size',
            title: 'Avg Deal Size',
            type: 'metric',
            object: 'opportunity',
            valueField: 'amount',
            aggregate: 'avg',
            filter: { status: 'won' },
            layout: { x: 9, y: 0, w: 3, h: 2 },
          },
          {
            id: 'pipeline_by_stage',
            title: 'Pipeline by Stage',
            type: 'bar',
            object: 'opportunity',
            categoryField: 'stage',
            valueField: 'amount',
            aggregate: 'sum',
            filter: { is_closed: false },
            layout: { x: 0, y: 2, w: 8, h: 4 },
            options: {
              horizontal: true,
              showValues: true,
            },
          },
          {
            id: 'opps_by_type',
            title: 'Opportunities by Type',
            type: 'pie',
            object: 'opportunity',
            categoryField: 'type',
            aggregate: 'count',
            layout: { x: 8, y: 2, w: 4, h: 4 },
          },
          {
            id: 'revenue_trend_12m',
            title: 'Revenue Trend (Last 12 Months)',
            type: 'line',
            object: 'opportunity',
            categoryField: 'close_date',
            valueField: 'amount',
            aggregate: 'sum',
            filter: { close_date: '{last_12_months}' },
            layout: { x: 0, y: 6, w: 12, h: 4 },
            options: {
              smoothCurve: true,
              showDataPoints: true,
            },
          },
        ],
      };

      expect(() => DashboardSchema.parse(salesDashboard)).not.toThrow();
    });

    it('should accept service desk dashboard', () => {
      const serviceDashboard: DashboardType = {
        name: 'service_desk',
        label: 'Service Desk Overview',
        description: 'Customer support metrics and case tracking',
        widgets: [
          {
            id: 'open_cases',
            title: 'Open Cases',
            type: 'metric',
            object: 'case',
            aggregate: 'count',
            filter: { status: { $ne: 'closed' } },
            layout: { x: 0, y: 0, w: 3, h: 2 },
            options: {
              color: '#FF6384',
            },
          },
          {
            id: 'cases_closed_today',
            title: 'Cases Closed Today',
            type: 'metric',
            object: 'case',
            aggregate: 'count',
            filter: {  // Modern MongoDB-style filter
              status: 'closed',
              closed_date: '{today}'
            },
            layout: { x: 3, y: 0, w: 3, h: 2 },
          },
          {
            id: 'avg_response_time',
            title: 'Avg Response Time',
            type: 'metric',
            object: 'case',
            valueField: 'first_response_time',
            aggregate: 'avg',
            layout: { x: 6, y: 0, w: 3, h: 2 },
            options: {
              unit: 'hours',
            },
          },
          {
            id: 'customer_satisfaction',
            title: 'Customer Satisfaction',
            type: 'metric',
            object: 'case',
            valueField: 'satisfaction_rating',
            aggregate: 'avg',
            filter: { satisfaction_rating: { $null: false } },
            layout: { x: 9, y: 0, w: 3, h: 2 },
            options: {
              max: 5,
              suffix: '/5',
            },
          },
          {
            id: 'cases_by_priority',
            title: 'Cases by Priority',
            type: 'funnel',
            object: 'case',
            categoryField: 'priority',
            aggregate: 'count',
            filter: { status: { $ne: 'closed' } },
            layout: { x: 0, y: 2, w: 6, h: 4 },
          },
          {
            id: 'cases_by_status',
            title: 'Cases by Status',
            type: 'pie',
            object: 'case',
            categoryField: 'status',
            aggregate: 'count',
            layout: { x: 6, y: 2, w: 6, h: 4 },
          },
          {
            id: 'recent_high_priority_cases',
            title: 'Recent High Priority Cases',
            type: 'table',
            object: 'case',
            filter: { priority: 'high' },  // Modern MongoDB-style filter
            layout: { x: 0, y: 6, w: 12, h: 4 },
            options: {
              columns: ['case_number', 'subject', 'account', 'owner', 'created_date'],
              limit: 10,
            },
          },
        ],
      };

      expect(() => DashboardSchema.parse(serviceDashboard)).not.toThrow();
    });

    it('should accept executive dashboard with mixed widgets', () => {
      const executiveDashboard: DashboardType = {
        name: 'executive_overview',
        label: 'Executive Overview',
        description: 'Key business metrics at a glance',
        widgets: [
          {
            id: 'quarterly_revenue',
            title: 'Quarterly Revenue',
            type: 'metric',
            object: 'opportunity',
            valueField: 'amount',
            aggregate: 'sum',
            filter: {  // Modern MongoDB-style filter
              status: 'won',
              close_date: '{this_quarter}'
            },
            layout: { x: 0, y: 0, w: 4, h: 3 },
            options: {
              prefix: '$',
              trend: 'up',
              trendValue: '+15%',
            },
          },
          {
            id: 'new_customers',
            title: 'New Customers',
            type: 'metric',
            object: 'account',
            aggregate: 'count',
            filter: { created_date: '{this_month}' },  // Modern MongoDB-style filter
            layout: { x: 4, y: 0, w: 4, h: 3 },
          },
          {
            id: 'active_users',
            title: 'Active Users',
            type: 'metric',
            object: 'user',
            aggregate: 'count',
            filter: { is_active: true },
            layout: { x: 8, y: 0, w: 4, h: 3 },
          },
          {
            id: 'revenue_by_product_line',
            title: 'Revenue by Product Line',
            type: 'bar',
            object: 'opportunity',
            categoryField: 'product_line',
            valueField: 'amount',
            aggregate: 'sum',
            filter: { status: 'won' },
            layout: { x: 0, y: 3, w: 8, h: 4 },
          },
          {
            id: 'team_performance',
            title: 'Team Performance',
            type: 'table',
            object: 'user',
            layout: { x: 8, y: 3, w: 4, h: 4 },
            options: {
              columns: ['name', 'deals_closed', 'revenue_generated'],
            },
          },
          {
            id: 'welcome',
            title: 'Welcome',
            type: 'metric',
            layout: { x: 0, y: 7, w: 12, h: 1 },
            options: {
              content: '**Last updated:** {NOW()}',
            },
          },
        ],
      };

      expect(() => DashboardSchema.parse(executiveDashboard)).not.toThrow();
    });
  });
});

describe('Dashboard Factory', () => {
  it('should create dashboard with default widget values', () => {
    const dashboard = Dashboard.create({
      name: 'test_dashboard',
      label: 'Test Dashboard',
      widgets: [
        {
          id: 'test_widget',
          title: 'Test Widget',
          type: 'table',
          object: 'account',
          layout: { x: 0, y: 0, w: 12, h: 4 },
        },
      ],
    });
    
    expect(dashboard.name).toBe('test_dashboard');
    expect(dashboard.widgets).toHaveLength(1);
    expect(dashboard.widgets[0].aggregate).toBe('count');
  });

  it('should create dashboard without aggregate (uses default)', () => {
    const dashboard = Dashboard.create({
      name: 'sales_dashboard',
      label: 'Sales Dashboard',
      widgets: [
        {
          id: 'total_revenue',
          title: 'Total Revenue',
          type: 'metric',
          object: 'opportunity',
          valueField: 'amount',
          layout: { x: 0, y: 0, w: 3, h: 2 },
        },
      ],
    });
    
    expect(dashboard.widgets[0].aggregate).toBe('count');
  });
});

describe('Dashboard I18n Integration', () => {
  it('should accept i18n object as dashboard label', () => {
    expect(() => DashboardSchema.parse({
      name: 'i18n_dashboard',
      label: { key: 'dashboards.sales', defaultValue: 'Sales Dashboard' },
      widgets: [],
    })).not.toThrow();
  });
  it('should accept i18n object as dashboard description', () => {
    expect(() => DashboardSchema.parse({
      name: 'test_dashboard',
      label: 'Test',
      description: { key: 'dashboards.test.desc', defaultValue: 'Test dashboard' },
      widgets: [],
    })).not.toThrow();
  });
  it('should accept i18n object as widget title', () => {
    expect(() => DashboardWidgetSchema.parse({
      id: 'total_revenue',
      title: { key: 'widgets.revenue', defaultValue: 'Total Revenue' },
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    })).not.toThrow();
  });
  it('should accept i18n object in global filter label', () => {
    expect(() => DashboardSchema.parse({
      name: 'filter_dash',
      label: 'Filtered',
      widgets: [],
      globalFilters: [{
        field: 'status',
        label: { key: 'filters.status', defaultValue: 'Status' },
        type: 'select',
      }],
    })).not.toThrow();
  });
});

describe('Dashboard ARIA Integration', () => {
  it('should accept dashboard with ARIA attributes', () => {
    expect(() => DashboardSchema.parse({
      name: 'accessible_dash',
      label: 'Accessible Dashboard',
      widgets: [],
      aria: { ariaLabel: 'Sales dashboard overview', role: 'region' },
    })).not.toThrow();
  });
  it('should accept widget with ARIA attributes', () => {
    expect(() => DashboardWidgetSchema.parse({
      id: 'revenue_metric',
      title: 'Revenue',
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
      aria: { ariaLabel: 'Total revenue metric', ariaDescribedBy: 'revenue-desc' },
    })).not.toThrow();
  });
});

describe('Dashboard Responsive Integration', () => {
  it('should accept widget with responsive config', () => {
    expect(() => DashboardWidgetSchema.parse({
      id: 'responsive_metric',
      type: 'metric',
      layout: { x: 0, y: 0, w: 6, h: 2 },
      responsive: { hiddenOn: ['xs'] },
    })).not.toThrow();
  });
});

describe('Dashboard Performance Integration', () => {
  it('should accept dashboard with performance config', () => {
    expect(() => DashboardSchema.parse({
      name: 'perf_dash',
      label: 'Performance Dashboard',
      widgets: [],
      performance: { lazyLoad: true, cacheStrategy: 'stale-while-revalidate' },
    })).not.toThrow();
  });
});

// ============================================================================
// Protocol Improvement Tests: Dashboard dateRange
// ============================================================================

describe('DashboardSchema - dateRange', () => {
  it('should accept dateRange configuration', () => {
    const result = DashboardSchema.parse({
      name: 'sales_dashboard',
      label: 'Sales',
      widgets: [],
      dateRange: {
        field: 'created_at',
        defaultRange: 'this_quarter',
        allowCustomRange: true,
      },
    });
    expect(result.dateRange?.field).toBe('created_at');
    expect(result.dateRange?.defaultRange).toBe('this_quarter');
    expect(result.dateRange?.allowCustomRange).toBe(true);
  });

  it('should default dateRange.defaultRange to this_month', () => {
    const result = DashboardSchema.parse({
      name: 'dashboard',
      label: 'Dashboard',
      widgets: [],
      dateRange: {},
    });
    expect(result.dateRange?.defaultRange).toBe('this_month');
    expect(result.dateRange?.allowCustomRange).toBe(true);
  });

  it('should accept all dateRange preset values', () => {
    const presets = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year', 'last_7_days', 'last_30_days', 'last_90_days', 'custom'];
    for (const preset of presets) {
      expect(() => DashboardSchema.parse({
        name: 'test_dash',
        label: 'Test',
        widgets: [],
        dateRange: { defaultRange: preset },
      })).not.toThrow();
    }
  });

  it('should accept dashboard without dateRange (optional)', () => {
    const result = DashboardSchema.parse({
      name: 'simple_dash',
      label: 'Simple',
      widgets: [],
    });
    expect(result.dateRange).toBeUndefined();
  });
});

// ============================================================================
// Protocol Enhancement Tests: colorVariant, description, actionUrl/actionType
// ============================================================================

describe('WidgetColorVariantSchema', () => {
  it('should accept all color variants', () => {
    const variants = ['default', 'blue', 'teal', 'orange', 'purple', 'success', 'warning', 'danger'];
    variants.forEach(variant => {
      expect(() => WidgetColorVariantSchema.parse(variant)).not.toThrow();
    });
  });

  it('should reject invalid color variants', () => {
    expect(() => WidgetColorVariantSchema.parse('red')).toThrow();
    expect(() => WidgetColorVariantSchema.parse('unknown')).toThrow();
  });
});

describe('WidgetActionTypeSchema', () => {
  it('should accept all action types', () => {
    const types = ['script', 'url', 'modal', 'flow', 'api'];
    types.forEach(type => {
      expect(() => WidgetActionTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid action types', () => {
    expect(() => WidgetActionTypeSchema.parse('invalid')).toThrow();
  });
});

describe('DashboardWidgetSchema - colorVariant', () => {
  it('should accept widget with colorVariant', () => {
    const widget: DashboardWidget = {
      id: 'total_revenue',
      title: 'Total Revenue',
      type: 'metric',
      colorVariant: 'teal',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    };
    const result = DashboardWidgetSchema.parse(widget);
    expect(result.colorVariant).toBe('teal');
  });

  it('should accept widget without colorVariant (optional)', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'metric_widget',
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    });
    expect(result.colorVariant).toBeUndefined();
  });

  it('should reject invalid colorVariant', () => {
    expect(() => DashboardWidgetSchema.parse({
      type: 'metric',
      colorVariant: 'neon',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    })).toThrow();
  });
});

describe('DashboardWidgetSchema - description', () => {
  it('should accept widget with string description', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'revenue_widget',
      title: 'Revenue',
      description: 'Year-to-date total revenue',
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    });
    expect(result.description).toBe('Year-to-date total revenue');
  });

  it('should accept widget with i18n description', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'revenue_i18n',
      title: 'Revenue',
      description: { key: 'widgets.revenue.desc', defaultValue: 'Total revenue' },
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    });
    expect(result.description).toEqual({ key: 'widgets.revenue.desc', defaultValue: 'Total revenue' });
  });

  it('should accept widget without description (optional)', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'no_desc_widget',
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    });
    expect(result.description).toBeUndefined();
  });
});

describe('DashboardWidgetSchema - actionUrl/actionType/actionIcon', () => {
  it('should accept widget with actionUrl and actionType', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'open_tickets',
      title: 'Open Tickets',
      type: 'metric',
      actionUrl: 'https://example.com/tickets',
      actionType: 'url',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    });
    expect(result.actionUrl).toBe('https://example.com/tickets');
    expect(result.actionType).toBe('url');
  });

  it('should accept widget with actionIcon', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'details_widget',
      title: 'Details',
      type: 'metric',
      actionUrl: '/details',
      actionType: 'url',
      actionIcon: 'external-link',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    });
    expect(result.actionIcon).toBe('external-link');
  });

  it('should accept widget with modal action type', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'breakdown_widget',
      title: 'Breakdown',
      type: 'metric',
      actionUrl: 'revenue_breakdown',
      actionType: 'modal',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    });
    expect(result.actionType).toBe('modal');
  });

  it('should accept widget with flow action type', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'refresh_data',
      title: 'Refresh Data',
      type: 'metric',
      actionUrl: 'refresh_pipeline_flow',
      actionType: 'flow',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    });
    expect(result.actionType).toBe('flow');
  });

  it('should accept widget without action fields (optional)', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'no_action_widget',
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    });
    expect(result.actionUrl).toBeUndefined();
    expect(result.actionType).toBeUndefined();
    expect(result.actionIcon).toBeUndefined();
  });

  it('should reject invalid actionType', () => {
    expect(() => DashboardWidgetSchema.parse({
      type: 'metric',
      actionType: 'invalid',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    })).toThrow();
  });
});

describe('DashboardWidgetSchema - combined new fields', () => {
  it('should accept KPI widget with all new fields', () => {
    const widget: DashboardWidget = {
      id: 'revenue_kpi',
      title: 'Revenue',
      description: 'Q4 total revenue across all regions',
      type: 'metric',
      colorVariant: 'success',
      actionUrl: 'https://reports.example.com/revenue',
      actionType: 'url',
      actionIcon: 'external-link',
      object: 'opportunity',
      valueField: 'amount',
      aggregate: 'sum',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    };

    const result = DashboardWidgetSchema.parse(widget);
    expect(result.description).toBe('Q4 total revenue across all regions');
    expect(result.colorVariant).toBe('success');
    expect(result.actionUrl).toBe('https://reports.example.com/revenue');
    expect(result.actionType).toBe('url');
    expect(result.actionIcon).toBe('external-link');
  });

  it('should work in a full dashboard with color-coded KPI cards', () => {
    const dashboard = Dashboard.create({
      name: 'kpi_dashboard',
      label: 'KPI Dashboard',
      widgets: [
        {
          id: 'kpi_revenue',
          title: 'Revenue',
          description: 'Total quarterly revenue',
          type: 'metric',
          colorVariant: 'success',
          object: 'opportunity',
          valueField: 'amount',
          aggregate: 'sum',
          layout: { x: 0, y: 0, w: 3, h: 2 },
        },
        {
          id: 'open_issues',
          title: 'Open Issues',
          description: 'Unresolved support tickets',
          type: 'metric',
          colorVariant: 'warning',
          actionUrl: '/issues',
          actionType: 'url',
          object: 'case',
          aggregate: 'count',
          layout: { x: 3, y: 0, w: 3, h: 2 },
        },
        {
          id: 'critical_bugs',
          title: 'Critical Bugs',
          description: 'P0/P1 bugs requiring attention',
          type: 'metric',
          colorVariant: 'danger',
          actionUrl: 'bug_triage_flow',
          actionType: 'flow',
          actionIcon: 'alert-triangle',
          object: 'bug',
          aggregate: 'count',
          layout: { x: 6, y: 0, w: 3, h: 2 },
        },
        {
          id: 'team_velocity',
          title: 'Team Velocity',
          type: 'bar',
          colorVariant: 'blue',
          object: 'sprint',
          categoryField: 'sprint_name',
          valueField: 'story_points',
          aggregate: 'sum',
          layout: { x: 0, y: 2, w: 12, h: 4 },
        },
      ],
    });

    expect(dashboard.widgets).toHaveLength(4);
    expect(dashboard.widgets[0].colorVariant).toBe('success');
    expect(dashboard.widgets[1].actionUrl).toBe('/issues');
    expect(dashboard.widgets[2].description).toBe('P0/P1 bugs requiring attention');
    expect(dashboard.widgets[3].colorVariant).toBe('blue');
  });
});

// ============================================================================
// Protocol Enhancement Tests: GlobalFilterSchema — options, optionsFrom,
// defaultValue, scope, targetWidgets (#712)
// ============================================================================

describe('GlobalFilterOptionsFromSchema', () => {
  it('should accept valid optionsFrom config', () => {
    const result = GlobalFilterOptionsFromSchema.parse({
      object: 'account',
      valueField: 'id',
      labelField: 'name',
    });
    expect(result.object).toBe('account');
    expect(result.valueField).toBe('id');
    expect(result.labelField).toBe('name');
  });

  it('should accept optionsFrom with filter', () => {
    const result = GlobalFilterOptionsFromSchema.parse({
      object: 'account',
      valueField: 'id',
      labelField: 'name',
      filter: { is_active: true },
    });
    expect(result.filter).toEqual({ is_active: true });
  });

  it('should reject optionsFrom without required fields', () => {
    expect(() => GlobalFilterOptionsFromSchema.parse({ object: 'account' })).toThrow();
    expect(() => GlobalFilterOptionsFromSchema.parse({ valueField: 'id' })).toThrow();
    expect(() => GlobalFilterOptionsFromSchema.parse({})).toThrow();
  });
});

describe('GlobalFilterSchema', () => {
  it('should accept minimal filter (backward compat)', () => {
    const result = GlobalFilterSchema.parse({
      field: 'status',
    });
    expect(result.field).toBe('status');
    expect(result.scope).toBe('dashboard');
  });

  it('should accept old-style filter with label and type', () => {
    const result = GlobalFilterSchema.parse({
      field: 'status',
      label: 'Status',
      type: 'select',
    });
    expect(result.field).toBe('status');
    expect(result.label).toBe('Status');
    expect(result.type).toBe('select');
  });

  it('should accept all filter types including lookup', () => {
    const types = ['text', 'select', 'date', 'number', 'lookup'] as const;
    types.forEach(type => {
      expect(() => GlobalFilterSchema.parse({ field: 'f', type })).not.toThrow();
    });
  });

  it('should reject invalid filter type', () => {
    expect(() => GlobalFilterSchema.parse({ field: 'f', type: 'checkbox' })).toThrow();
  });

  it('should accept filter with static options', () => {
    const result = GlobalFilterSchema.parse({
      field: 'priority',
      type: 'select',
      options: [
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ],
    });
    expect(result.options).toHaveLength(3);
    expect(result.options![0].value).toBe('high');
    expect(result.options![0].label).toBe('High');
  });

  it('should accept filter with i18n option labels', () => {
    const result = GlobalFilterSchema.parse({
      field: 'priority',
      type: 'select',
      options: [
        { value: 'high', label: { key: 'filter.priority.high', defaultValue: 'High' } },
      ],
    });
    expect(result.options![0].label).toEqual({ key: 'filter.priority.high', defaultValue: 'High' });
  });

  it('should accept filter with optionsFrom (dynamic binding)', () => {
    const result = GlobalFilterSchema.parse({
      field: 'account_id',
      type: 'lookup',
      optionsFrom: {
        object: 'account',
        valueField: 'id',
        labelField: 'name',
      },
    });
    expect(result.optionsFrom).toBeDefined();
    expect(result.optionsFrom!.object).toBe('account');
    expect(result.optionsFrom!.valueField).toBe('id');
    expect(result.optionsFrom!.labelField).toBe('name');
  });

  it('should accept filter with optionsFrom and filter', () => {
    const result = GlobalFilterSchema.parse({
      field: 'owner_id',
      type: 'lookup',
      optionsFrom: {
        object: 'user',
        valueField: 'id',
        labelField: 'full_name',
        filter: { is_active: true },
      },
    });
    expect(result.optionsFrom!.filter).toEqual({ is_active: true });
  });

  it('should accept filter with defaultValue', () => {
    const result = GlobalFilterSchema.parse({
      field: 'status',
      type: 'select',
      defaultValue: 'open',
    });
    expect(result.defaultValue).toBe('open');
  });

  it('should default scope to dashboard', () => {
    const result = GlobalFilterSchema.parse({ field: 'status' });
    expect(result.scope).toBe('dashboard');
  });

  it('should accept scope widget', () => {
    const result = GlobalFilterSchema.parse({
      field: 'status',
      scope: 'widget',
    });
    expect(result.scope).toBe('widget');
  });

  it('should reject invalid scope', () => {
    expect(() => GlobalFilterSchema.parse({ field: 'f', scope: 'global' })).toThrow();
  });

  it('should accept targetWidgets', () => {
    const result = GlobalFilterSchema.parse({
      field: 'region',
      scope: 'widget',
      targetWidgets: ['revenue_chart', 'pipeline_table'],
    });
    expect(result.targetWidgets).toEqual(['revenue_chart', 'pipeline_table']);
  });

  it('should accept filter without targetWidgets (optional)', () => {
    const result = GlobalFilterSchema.parse({ field: 'status' });
    expect(result.targetWidgets).toBeUndefined();
  });
});

describe('DashboardSchema - enhanced globalFilters', () => {
  it('should still accept old-style globalFilters (backward compat)', () => {
    const result = DashboardSchema.parse({
      name: 'compat_dash',
      label: 'Compat Dashboard',
      widgets: [],
      globalFilters: [
        { field: 'status', label: 'Status', type: 'select' },
        { field: 'created_at', type: 'date' },
      ],
    });
    expect(result.globalFilters).toHaveLength(2);
    expect(result.globalFilters![0].scope).toBe('dashboard');
  });

  it('should accept globalFilters with optionsFrom', () => {
    const result = DashboardSchema.parse({
      name: 'dynamic_filters_dash',
      label: 'Dynamic Filters',
      widgets: [],
      globalFilters: [
        {
          field: 'account_id',
          label: 'Account',
          type: 'lookup',
          optionsFrom: {
            object: 'account',
            valueField: 'id',
            labelField: 'name',
          },
        },
      ],
    });
    expect(result.globalFilters![0].optionsFrom!.object).toBe('account');
  });

  it('should accept globalFilters with static options', () => {
    const result = DashboardSchema.parse({
      name: 'static_options_dash',
      label: 'Static Options',
      widgets: [],
      globalFilters: [
        {
          field: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ],
          defaultValue: 'medium',
        },
      ],
    });
    expect(result.globalFilters![0].options).toHaveLength(3);
    expect(result.globalFilters![0].defaultValue).toBe('medium');
  });

  it('should accept globalFilters with targetWidgets', () => {
    const result = DashboardSchema.parse({
      name: 'targeted_filter_dash',
      label: 'Targeted Filters',
      widgets: [
        { id: 'chart_a', title: 'Chart A', type: 'bar', layout: { x: 0, y: 0, w: 6, h: 4 } },
        { id: 'chart_b', title: 'Chart B', type: 'line', layout: { x: 6, y: 0, w: 6, h: 4 } },
      ],
      globalFilters: [
        {
          field: 'region',
          label: 'Region',
          type: 'select',
          scope: 'widget',
          targetWidgets: ['chart_a'],
          options: [
            { value: 'na', label: 'North America' },
            { value: 'eu', label: 'Europe' },
          ],
        },
      ],
    });
    expect(result.globalFilters![0].scope).toBe('widget');
    expect(result.globalFilters![0].targetWidgets).toEqual(['chart_a']);
  });

  it('should accept Airtable-style dashboard with full filter bar config', () => {
    const dashboard = Dashboard.create({
      name: 'airtable_style_dash',
      label: 'Airtable Style Dashboard',
      widgets: [
        {
          id: 'revenue_by_region',
          title: 'Revenue by Region',
          type: 'bar',
          object: 'opportunity',
          categoryField: 'region',
          valueField: 'amount',
          aggregate: 'sum',
          layout: { x: 0, y: 0, w: 12, h: 4 },
        },
      ],
      globalFilters: [
        {
          field: 'owner_id',
          label: 'Owner',
          type: 'lookup',
          optionsFrom: {
            object: 'user',
            valueField: 'id',
            labelField: 'full_name',
            filter: { is_active: true },
          },
        },
        {
          field: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
          ],
          defaultValue: 'open',
        },
        {
          field: 'region',
          label: 'Region',
          type: 'select',
          scope: 'widget',
          targetWidgets: ['revenue_chart'],
          optionsFrom: {
            object: 'region',
            valueField: 'code',
            labelField: 'name',
          },
        },
      ],
    });

    expect(dashboard.globalFilters).toHaveLength(3);
    expect(dashboard.globalFilters![0].optionsFrom!.object).toBe('user');
    expect(dashboard.globalFilters![1].defaultValue).toBe('open');
    expect(dashboard.globalFilters![2].targetWidgets).toEqual(['revenue_chart']);
  });
});

// ============================================================================
// Protocol Enhancement Tests: DashboardHeaderSchema (#714)
// ============================================================================

describe('DashboardHeaderActionSchema', () => {
  it('should accept valid header action', () => {
    const result = DashboardHeaderActionSchema.parse({
      label: 'Export PDF',
      actionUrl: '/export/pdf',
    });
    expect(result.label).toBe('Export PDF');
    expect(result.actionUrl).toBe('/export/pdf');
  });

  it('should accept action with all fields', () => {
    const result = DashboardHeaderActionSchema.parse({
      label: 'Run Report',
      actionUrl: 'generate_report_flow',
      actionType: 'flow',
      icon: 'play',
    });
    expect(result.actionType).toBe('flow');
    expect(result.icon).toBe('play');
  });

  it('should accept i18n label', () => {
    const result = DashboardHeaderActionSchema.parse({
      label: { key: 'actions.export', defaultValue: 'Export' },
      actionUrl: '/export',
    });
    expect(result.label).toEqual({ key: 'actions.export', defaultValue: 'Export' });
  });

  it('should reject action without required fields', () => {
    expect(() => DashboardHeaderActionSchema.parse({ label: 'Test' })).toThrow();
    expect(() => DashboardHeaderActionSchema.parse({ actionUrl: '/test' })).toThrow();
    expect(() => DashboardHeaderActionSchema.parse({})).toThrow();
  });
});

describe('DashboardHeaderSchema', () => {
  it('should accept empty header with defaults', () => {
    const result = DashboardHeaderSchema.parse({});
    expect(result.showTitle).toBe(true);
    expect(result.showDescription).toBe(true);
    expect(result.actions).toBeUndefined();
  });

  it('should accept header with showTitle/showDescription overrides', () => {
    const result = DashboardHeaderSchema.parse({
      showTitle: false,
      showDescription: false,
    });
    expect(result.showTitle).toBe(false);
    expect(result.showDescription).toBe(false);
  });

  it('should accept header with actions', () => {
    const result = DashboardHeaderSchema.parse({
      actions: [
        { label: 'Export', actionUrl: '/export/pdf', icon: 'download' },
        { label: 'Share', actionUrl: 'share_modal', actionType: 'modal', icon: 'share' },
      ],
    });
    expect(result.actions).toHaveLength(2);
    expect(result.actions![0].label).toBe('Export');
    expect(result.actions![1].actionType).toBe('modal');
  });
});

describe('DashboardSchema - header', () => {
  it('should accept dashboard with header configuration', () => {
    const result = DashboardSchema.parse({
      name: 'sales_dashboard',
      label: 'Sales Dashboard',
      description: 'Q4 sales performance',
      header: {
        showTitle: true,
        showDescription: true,
        actions: [
          { label: 'Export PDF', actionUrl: '/export/pdf', icon: 'download' },
        ],
      },
      widgets: [],
    });
    expect(result.header).toBeDefined();
    expect(result.header!.showTitle).toBe(true);
    expect(result.header!.actions).toHaveLength(1);
  });

  it('should accept dashboard without header (backward compat)', () => {
    const result = DashboardSchema.parse({
      name: 'simple_dash',
      label: 'Simple',
      widgets: [],
    });
    expect(result.header).toBeUndefined();
  });

  it('should accept dashboard with header hiding title/description', () => {
    const result = DashboardSchema.parse({
      name: 'minimal_header_dash',
      label: 'Minimal',
      header: {
        showTitle: false,
        showDescription: false,
      },
      widgets: [],
    });
    expect(result.header!.showTitle).toBe(false);
    expect(result.header!.showDescription).toBe(false);
  });

  it('should work with Dashboard factory', () => {
    const dashboard = Dashboard.create({
      name: 'executive_dash',
      label: 'Executive Dashboard',
      description: 'Key business metrics',
      header: {
        actions: [
          { label: 'Export', actionUrl: '/export', actionType: 'url', icon: 'download' },
          { label: 'Refresh', actionUrl: 'refresh_flow', actionType: 'flow', icon: 'refresh' },
        ],
      },
      widgets: [
        { id: 'revenue_widget', title: 'Revenue', type: 'metric', layout: { x: 0, y: 0, w: 3, h: 2 } },
      ],
    });
    expect(dashboard.header!.showTitle).toBe(true);
    expect(dashboard.header!.actions).toHaveLength(2);
    expect(dashboard.header!.actions![1].actionType).toBe('flow');
  });
});

// ============================================================================
// Protocol Enhancement Tests: WidgetMeasureSchema / multi-measure pivot (#714)
// ============================================================================

describe('WidgetMeasureSchema', () => {
  it('should accept minimal measure', () => {
    const result = WidgetMeasureSchema.parse({
      valueField: 'amount',
    });
    expect(result.valueField).toBe('amount');
    expect(result.aggregate).toBe('count');
  });

  it('should accept measure with all fields', () => {
    const result = WidgetMeasureSchema.parse({
      valueField: 'amount',
      aggregate: 'sum',
      label: 'Total Amount',
      format: '$0,0.00',
    });
    expect(result.aggregate).toBe('sum');
    expect(result.label).toBe('Total Amount');
    expect(result.format).toBe('$0,0.00');
  });

  it('should accept measure with i18n label', () => {
    const result = WidgetMeasureSchema.parse({
      valueField: 'quantity',
      aggregate: 'avg',
      label: { key: 'measures.avg_qty', defaultValue: 'Average Quantity' },
    });
    expect(result.label).toEqual({ key: 'measures.avg_qty', defaultValue: 'Average Quantity' });
  });

  it('should accept all aggregate functions', () => {
    const aggregates = ['count', 'sum', 'avg', 'min', 'max'] as const;
    aggregates.forEach(aggregate => {
      expect(() => WidgetMeasureSchema.parse({ valueField: 'f', aggregate })).not.toThrow();
    });
  });

  it('should reject measure without valueField', () => {
    expect(() => WidgetMeasureSchema.parse({})).toThrow();
    expect(() => WidgetMeasureSchema.parse({ aggregate: 'sum' })).toThrow();
  });
});

describe('DashboardWidgetSchema - measures (multi-measure pivot)', () => {
  it('should accept pivot widget with measures', () => {
    const widget = DashboardWidgetSchema.parse({
      id: 'sales_by_region_product',
      title: 'Sales by Region and Product',
      type: 'pivot',
      object: 'opportunity',
      categoryField: 'region',
      measures: [
        { valueField: 'amount', aggregate: 'sum', label: 'Total Amount', format: '$0,0' },
        { valueField: 'amount', aggregate: 'avg', label: 'Avg Deal Size', format: '$0,0.00' },
        { valueField: 'amount', aggregate: 'count', label: 'Deal Count' },
      ],
      layout: { x: 0, y: 0, w: 12, h: 6 },
    });
    expect(widget.measures).toHaveLength(3);
    expect(widget.measures![0].aggregate).toBe('sum');
    expect(widget.measures![1].aggregate).toBe('avg');
    expect(widget.measures![2].aggregate).toBe('count');
  });

  it('should accept widget without measures (backward compat)', () => {
    const result = DashboardWidgetSchema.parse({
      id: 'bar_widget',
      type: 'bar',
      object: 'opportunity',
      valueField: 'amount',
      aggregate: 'sum',
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    expect(result.measures).toBeUndefined();
  });

  it('should accept table widget with measures for multi-aggregate', () => {
    const widget = DashboardWidgetSchema.parse({
      id: 'regional_summary',
      title: 'Regional Summary',
      type: 'table',
      object: 'order',
      categoryField: 'region',
      measures: [
        { valueField: 'revenue', aggregate: 'sum', label: 'Revenue' },
        { valueField: 'quantity', aggregate: 'sum', label: 'Units Sold' },
        { valueField: 'revenue', aggregate: 'avg', label: 'Avg Order Value' },
      ],
      layout: { x: 0, y: 0, w: 12, h: 6 },
    });
    expect(widget.measures).toHaveLength(3);
  });

  it('should work in full dashboard with pivot multi-measure', () => {
    const dashboard = Dashboard.create({
      name: 'analytics_dashboard',
      label: 'Analytics Dashboard',
      header: {
        actions: [
          { label: 'Export CSV', actionUrl: '/export/csv', icon: 'download' },
        ],
      },
      widgets: [
        {
          id: 'revenue_metric',
          title: 'Revenue',
          type: 'metric',
          object: 'order',
          valueField: 'amount',
          aggregate: 'sum',
          layout: { x: 0, y: 0, w: 4, h: 2 },
        },
        {
          id: 'sales_pivot_analysis',
          title: 'Sales Pivot Analysis',
          type: 'pivot',
          object: 'opportunity',
          categoryField: 'region',
          measures: [
            { valueField: 'amount', aggregate: 'sum', label: 'Total Revenue', format: '$0,0' },
            { valueField: 'amount', aggregate: 'count', label: 'Deals' },
            { valueField: 'amount', aggregate: 'avg', label: 'Avg Deal', format: '$0,0.00' },
            { valueField: 'margin', aggregate: 'avg', label: 'Avg Margin', format: '0.0%' },
          ],
          layout: { x: 0, y: 2, w: 12, h: 6 },
        },
      ],
    });

    expect(dashboard.header!.actions).toHaveLength(1);
    expect(dashboard.widgets[1].measures).toHaveLength(4);
    expect(dashboard.widgets[1].measures![0].format).toBe('$0,0');
    expect(dashboard.widgets[1].measures![3].valueField).toBe('margin');
  });
});

// ============================================================================
// Protocol Enhancement Tests: pivot / funnel / grouped-bar widget types (#713)
// ============================================================================

describe('DashboardWidgetSchema - pivot/funnel/grouped-bar types', () => {
  it('should accept funnel widget with chartConfig', () => {
    const widget = DashboardWidgetSchema.parse({
      id: 'lead_conversion_funnel',
      title: 'Lead Conversion Funnel',
      type: 'funnel',
      object: 'lead',
      categoryField: 'stage',
      aggregate: 'count',
      chartConfig: {
        type: 'funnel',
        showDataLabels: true,
        colors: ['#4CAF50', '#FF9800', '#F44336'],
      },
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    expect(widget.type).toBe('funnel');
    expect(widget.chartConfig!.type).toBe('funnel');
    expect(widget.chartConfig!.showDataLabels).toBe(true);
  });

  it('should accept grouped-bar widget with chartConfig', () => {
    const widget = DashboardWidgetSchema.parse({
      id: 'revenue_by_region_quarter',
      title: 'Revenue by Region & Quarter',
      type: 'grouped-bar',
      object: 'order',
      categoryField: 'region',
      valueField: 'revenue',
      aggregate: 'sum',
      chartConfig: {
        type: 'grouped-bar',
        showLegend: true,
        showDataLabels: false,
        xAxis: { field: 'region', title: 'Region' },
        yAxis: [{ field: 'revenue', title: 'Revenue ($)', format: '$0,0' }],
      },
      layout: { x: 0, y: 0, w: 12, h: 4 },
    });
    expect(widget.type).toBe('grouped-bar');
    expect(widget.chartConfig!.type).toBe('grouped-bar');
    expect(widget.chartConfig!.showLegend).toBe(true);
  });

  it('should accept pivot widget with measures and chartConfig', () => {
    const widget = DashboardWidgetSchema.parse({
      id: 'sales_cross_tab',
      title: 'Sales Cross-Tab Analysis',
      type: 'pivot',
      object: 'opportunity',
      categoryField: 'region',
      measures: [
        { valueField: 'amount', aggregate: 'sum', label: 'Total', format: '$0,0' },
        { valueField: 'amount', aggregate: 'count', label: 'Count' },
      ],
      chartConfig: {
        type: 'pivot',
        showDataLabels: true,
      },
      layout: { x: 0, y: 0, w: 12, h: 6 },
    });
    expect(widget.type).toBe('pivot');
    expect(widget.measures).toHaveLength(2);
  });

  it('should accept dashboard with pivot, funnel, and grouped-bar widgets', () => {
    const dashboard = Dashboard.create({
      name: 'analytics_overview',
      label: 'Analytics Overview',
      description: 'Dashboard combining pivot, funnel, and grouped-bar widgets',
      widgets: [
        {
          id: 'sales_funnel',
          title: 'Sales Funnel',
          type: 'funnel',
          object: 'lead',
          categoryField: 'stage',
          aggregate: 'count',
          layout: { x: 0, y: 0, w: 6, h: 4 },
        },
        {
          id: 'revenue_region_quarter',
          title: 'Revenue by Region & Quarter',
          type: 'grouped-bar',
          object: 'order',
          categoryField: 'region',
          valueField: 'revenue',
          aggregate: 'sum',
          layout: { x: 6, y: 0, w: 6, h: 4 },
        },
        {
          id: 'regional_pivot_analysis',
          title: 'Regional Pivot Analysis',
          type: 'pivot',
          object: 'opportunity',
          categoryField: 'region',
          measures: [
            { valueField: 'amount', aggregate: 'sum', label: 'Revenue', format: '$0,0' },
            { valueField: 'amount', aggregate: 'avg', label: 'Avg Deal', format: '$0,0.00' },
            { valueField: 'amount', aggregate: 'count', label: 'Deals' },
          ],
          layout: { x: 0, y: 4, w: 12, h: 6 },
        },
      ],
    });

    expect(dashboard.widgets).toHaveLength(3);
    expect(dashboard.widgets[0].type).toBe('funnel');
    expect(dashboard.widgets[1].type).toBe('grouped-bar');
    expect(dashboard.widgets[2].type).toBe('pivot');
    expect(dashboard.widgets[2].measures).toHaveLength(3);
  });
});

// ============================================================================
// Negative / Inverse Validation Tests
// ============================================================================

describe('DashboardWidgetSchema - Negative Validation', () => {
  it('should reject widget without layout', () => {
    expect(() => DashboardWidgetSchema.parse({
      title: 'Bad Widget',
      type: 'metric',
    })).toThrow();
  });

  it('should reject widget with invalid type enum', () => {
    expect(() => DashboardWidgetSchema.parse({
      type: 'nonexistent_chart',
      layout: { x: 0, y: 0, w: 4, h: 2 },
    })).toThrow();
  });

  it('should reject widget with non-numeric layout values', () => {
    expect(() => DashboardWidgetSchema.parse({
      type: 'metric',
      layout: { x: 'a', y: 0, w: 4, h: 2 },
    })).toThrow();
  });

  it('should reject widget with incomplete layout', () => {
    expect(() => DashboardWidgetSchema.parse({
      type: 'metric',
      layout: { x: 0, y: 0 },
    })).toThrow();
  });

  it('should reject widget with invalid aggregate enum', () => {
    expect(() => DashboardWidgetSchema.parse({
      type: 'metric',
      aggregate: 'median',
      layout: { x: 0, y: 0, w: 4, h: 2 },
    })).toThrow();
  });
});

describe('DashboardSchema - Negative Validation', () => {
  it('should reject dashboard without name', () => {
    expect(() => DashboardSchema.parse({
      label: 'No Name Dashboard',
      widgets: [],
    })).toThrow();
  });

  it('should reject dashboard without label', () => {
    expect(() => DashboardSchema.parse({
      name: 'no_label',
      widgets: [],
    })).toThrow();
  });

  it('should reject dashboard without widgets', () => {
    expect(() => DashboardSchema.parse({
      name: 'no_widgets',
      label: 'Missing Widgets',
    })).toThrow();
  });

  it('should reject dashboard with camelCase name', () => {
    expect(() => DashboardSchema.parse({
      name: 'salesDashboard',
      label: 'Bad Name',
      widgets: [],
    })).toThrow();
  });
});

describe('GlobalFilterSchema - Negative Validation', () => {
  it('should reject filter without field', () => {
    expect(() => GlobalFilterSchema.parse({
      label: 'No Field',
    })).toThrow();
  });

  it('should reject filter with invalid type enum', () => {
    expect(() => GlobalFilterSchema.parse({
      field: 'status',
      type: 'invalid_type',
    })).toThrow();
  });
});

// ============================================================================
// Issue #2: DashboardWidget required `id` field
// ============================================================================
describe('DashboardWidgetSchema - required id field', () => {
  it('should reject widget without id', () => {
    expect(() => DashboardWidgetSchema.parse({
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    })).toThrow();
  });

  it('should enforce snake_case for widget id', () => {
    expect(() => DashboardWidgetSchema.parse({
      id: 'revenue_widget',
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    })).not.toThrow();

    expect(() => DashboardWidgetSchema.parse({
      id: 'revenueWidget',
      type: 'metric',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    })).toThrow();
  });

  it('should allow targetWidgets to reference widget ids', () => {
    const dashboard = DashboardSchema.parse({
      name: 'filter_ref_dash',
      label: 'Filter Reference Dashboard',
      widgets: [
        { id: 'revenue_chart', type: 'bar', layout: { x: 0, y: 0, w: 6, h: 4 } },
        { id: 'pipeline_table', type: 'table', layout: { x: 6, y: 0, w: 6, h: 4 } },
      ],
      globalFilters: [{
        field: 'region',
        scope: 'widget',
        targetWidgets: ['revenue_chart'],
      }],
    });
    expect(dashboard.widgets[0].id).toBe('revenue_chart');
    expect(dashboard.globalFilters![0].targetWidgets).toEqual(['revenue_chart']);
  });
});

// ============================================================================
// Issue #3: WidgetActionTypeSchema unified with ActionSchema.type
// ============================================================================
describe('WidgetActionTypeSchema - unified action types', () => {
  it('should accept all five action types matching ActionSchema.type', () => {
    const types = ['script', 'url', 'modal', 'flow', 'api'] as const;
    types.forEach(type => {
      expect(() => WidgetActionTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should accept widget with script action type', () => {
    expect(() => DashboardWidgetSchema.parse({
      id: 'script_widget',
      type: 'metric',
      actionType: 'script',
      actionUrl: 'refresh_data',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    })).not.toThrow();
  });

  it('should accept widget with api action type', () => {
    expect(() => DashboardWidgetSchema.parse({
      id: 'api_widget',
      type: 'metric',
      actionType: 'api',
      actionUrl: '/api/refresh',
      layout: { x: 0, y: 0, w: 3, h: 2 },
    })).not.toThrow();
  });
});

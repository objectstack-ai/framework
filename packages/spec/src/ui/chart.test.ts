import { describe, it, expect } from 'vitest';
import {
  ChartTypeSchema,
  ChartConfigSchema,
  type ChartType,
  type ChartConfig,
} from './chart.zod';

describe('ChartTypeSchema', () => {
  it('should accept all comparison chart types', () => {
    const types = ['bar', 'horizontal-bar', 'column', 'grouped-bar', 'stacked-bar'] as const;
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should accept all trend chart types', () => {
    const types = ['line', 'area', 'stacked-area', 'step-line'] as const;
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should accept all distribution chart types', () => {
    const types = ['pie', 'donut', 'funnel'] as const;
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should accept all relationship chart types', () => {
    const types = ['scatter', 'bubble'] as const;
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should accept all composition chart types', () => {
    const types = ['treemap', 'sunburst', 'sankey'] as const;
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should accept all performance chart types', () => {
    const types = ['gauge', 'metric', 'kpi'] as const;
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should accept all geo chart types', () => {
    const types = ['choropleth', 'bubble-map'] as const;
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should accept all advanced chart types', () => {
    const types = ['heatmap', 'radar', 'waterfall', 'box-plot', 'violin'] as const;
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should accept all tabular chart types', () => {
    const types = ['table', 'pivot'] as const;
    
    types.forEach(type => {
      expect(() => ChartTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid chart type', () => {
    expect(() => ChartTypeSchema.parse('invalid-chart')).toThrow();
  });
});

describe('ChartConfigSchema', () => {
  it('should accept minimal chart config', () => {
    const config: ChartConfig = {
      type: 'bar',
    };
    const result = ChartConfigSchema.parse(config);
    expect(result.type).toBe('bar');
    expect(result.showLegend).toBe(true);
    expect(result.showDataLabels).toBe(false);
  });

  it('should accept full chart config', () => {
    const config: ChartConfig = {
      type: 'line',
      title: 'Sales Trend',
      description: 'Monthly sales performance',
      showLegend: true,
      showDataLabels: true,
      colors: ['#FF6384', '#36A2EB', '#FFCE56'],
    };
    expect(() => ChartConfigSchema.parse(config)).not.toThrow();
  });

  it('should apply default values', () => {
    const config: ChartConfig = {
      type: 'pie',
      title: 'Revenue by Region',
    };
    const result = ChartConfigSchema.parse(config);
    expect(result.showLegend).toBe(true);
    expect(result.showDataLabels).toBe(false);
  });

  it('should allow custom colors', () => {
    const config: ChartConfig = {
      type: 'donut',
      colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
    };
    const result = ChartConfigSchema.parse(config);
    expect(result.colors).toHaveLength(4);
  });
});

describe('Real-World Chart Configuration Examples', () => {
  it('should accept bar chart for comparison', () => {
    const config: ChartConfig = {
      type: 'bar',
      title: 'Sales by Product Category',
      description: 'Comparison of sales across different product categories',
      showLegend: true,
      showDataLabels: true,
      colors: ['#4e79a7', '#f28e2c', '#e15759'],
    };
    expect(() => ChartConfigSchema.parse(config)).not.toThrow();
  });

  it('should accept line chart for trends', () => {
    const config: ChartConfig = {
      type: 'line',
      title: 'Revenue Trend',
      description: 'Monthly revenue over the past year',
      showLegend: true,
      showDataLabels: false,
    };
    expect(() => ChartConfigSchema.parse(config)).not.toThrow();
  });

  it('should accept pie chart for distribution', () => {
    const config: ChartConfig = {
      type: 'pie',
      title: 'Market Share',
      description: 'Market share by competitor',
      showLegend: true,
      showDataLabels: true,
    };
    expect(() => ChartConfigSchema.parse(config)).not.toThrow();
  });

  it('should accept gauge for performance metrics', () => {
    const config: ChartConfig = {
      type: 'gauge',
      title: 'Customer Satisfaction Score',
      description: 'Current satisfaction rating (0-100)',
      showLegend: false,
      colors: ['#22c55e', '#eab308', '#ef4444'],
    };
    expect(() => ChartConfigSchema.parse(config)).not.toThrow();
  });

  it('should accept heatmap for correlation analysis', () => {
    const config: ChartConfig = {
      type: 'heatmap',
      title: 'User Activity Heatmap',
      description: 'Hourly user activity by day of week',
      showLegend: true,
      showDataLabels: false,
      colors: ['#440154', '#31688e', '#35b779', '#fde724'],
    };
    expect(() => ChartConfigSchema.parse(config)).not.toThrow();
  });

  it('should accept funnel chart for conversion tracking', () => {
    const config: ChartConfig = {
      type: 'funnel',
      title: 'Sales Funnel',
      description: 'Conversion rates at each stage',
      showLegend: false,
      showDataLabels: true,
    };
    expect(() => ChartConfigSchema.parse(config)).not.toThrow();
  });

  it('should accept waterfall chart for financial analysis', () => {
    const config: ChartConfig = {
      type: 'waterfall',
      title: 'Profit & Loss Breakdown',
      description: 'Revenue, costs, and profit components',
      showLegend: false,
      showDataLabels: true,
      colors: ['#22c55e', '#ef4444', '#6366f1'],
    };
    expect(() => ChartConfigSchema.parse(config)).not.toThrow();
  });
});

describe('Chart I18n Integration', () => {
  it('should reject i18n object as chart title', () => {
    expect(() => ChartConfigSchema.parse({
      type: 'bar',
      title: { key: 'charts.sales', defaultValue: 'Sales Chart' },
    })).toThrow();
  });
  it('should reject i18n as chart subtitle and description', () => {
    expect(() => ChartConfigSchema.parse({
      type: 'line',
      title: 'Revenue',
      subtitle: { key: 'charts.subtitle', defaultValue: 'Monthly breakdown' },
      description: { key: 'charts.desc', defaultValue: 'Revenue over time' },
    })).toThrow();
  });
});

describe('Chart ARIA Integration', () => {
  it('should accept chart with ARIA attributes', () => {
    expect(() => ChartConfigSchema.parse({
      type: 'pie',
      title: 'Revenue by Region',
      aria: { ariaLabel: 'Pie chart showing revenue by region', role: 'img' },
    })).not.toThrow();
  });
});

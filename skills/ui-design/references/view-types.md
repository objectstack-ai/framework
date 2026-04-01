# UI Design — View Type Reference

> Auto-derived from `packages/spec/src/ui/view.zod.ts` and related schemas.
> This file is for quick reference only. The Zod source is the single source of truth.

## List View Types

| Type | Description |
|:-----|:------------|
| `grid` | Standard data table (default) |
| `kanban` | Board with status columns |
| `gallery` | Card/masonry layout |
| `calendar` | Date-based scheduling |
| `timeline` | Chronological stream |
| `gantt` | Project timeline with dependencies |
| `map` | Geospatial records |

## Form View Types

| Type | Description |
|:-----|:------------|
| `simple` | Single-page form |
| `tabbed` | Tabbed sections |
| `wizard` | Step-by-step flow |

## Data Providers

| Provider | Description |
|:---------|:------------|
| `object` | Auto-connect to ObjectStack object APIs |
| `api` | Custom HTTP API endpoint |
| `value` | Static inline data array |

## Column Summary Functions

| Function | Description |
|:---------|:------------|
| `count` | Count of records |
| `count_empty` | Count of empty values |
| `count_filled` | Count of non-empty values |
| `count_unique` | Count of distinct values |
| `percent_empty` | Percentage empty |
| `percent_filled` | Percentage filled |
| `sum` | Sum of values |
| `avg` | Average of values |
| `min` | Minimum value |
| `max` | Maximum value |

## Filter Operators

| Category | Operators |
|:---------|:----------|
| **Equality** | `equals`, `not_equals` |
| **Text** | `contains`, `not_contains`, `starts_with`, `ends_with` |
| **Comparison** | `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal` |
| **Presence** | `is_empty`, `is_not_empty` |
| **Set** | `in`, `not_in` |
| **Date** | `this_week`, `this_month`, `this_quarter`, `this_year`, `last_n_days` |

## Action Types

| Type | Description |
|:-----|:------------|
| `button` | Server-side operation |
| `url` | Navigate to URL |
| `flow` | Launch a screen flow |
| `api` | Call a custom API |

## Widget Types (Dashboards)

| Type | Description |
|:-----|:------------|
| `metric` | Single KPI number |
| `chart` | Bar, line, pie, donut, area |
| `list` | Embedded mini table |
| `calendar` | Embedded calendar |
| `custom` | Custom HTML/React component |

## Report Types

| Type | Description |
|:-----|:------------|
| `tabular` | Flat data table |
| `summary` | Grouped with subtotals |
| `matrix` | Cross-tab / pivot |
| `chart` | Visual chart |

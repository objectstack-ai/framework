---
name: objectstack-ui
description: >
  Design ObjectStack user interfaces (Views, Apps, Dashboards, Reports, Actions).
  Use when creating list views, form layouts, navigation structures, dashboard
  widgets, or configuring user-facing actions in an ObjectStack project.
license: Apache-2.0
compatibility: Requires @objectstack/spec Zod schemas (v4+)
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: ui
  tags: view, app, dashboard, report, action
---

# UI Design — ObjectStack UI Protocol

Expert instructions for designing user interfaces using the ObjectStack
specification. This skill covers Views (list, form, kanban, calendar, …),
App navigation, Dashboards, Reports, and Actions.

---

## When to Use This Skill

- You are creating a **list view** (grid, kanban, calendar, gantt, map, …).
- You are designing a **form layout** (simple, tabbed, wizard).
- You are building an **app** with structured navigation menus.
- You need a **dashboard** with widget grids.
- You are adding **reports** (tabular, summary, matrix, chart).
- You are configuring **actions** (buttons, URL jumps, screen flows).

---

## View Types

### List Views

| Type | When to Use |
|:-----|:------------|
| `grid` | Standard data table — default for most objects |
| `kanban` | Visual board with columns (status-driven workflows) |
| `gallery` | Card-based masonry layout (visual catalogues, contacts) |
| `calendar` | Date-based scheduling (events, tasks, bookings) |
| `timeline` | Chronological activity stream |
| `gantt` | Project management with dependency tracking |
| `map` | Geospatial records with `location` fields |

### Form Views

| Type | When to Use |
|:-----|:------------|
| `simple` | Single-page form — suitable for objects with ≤ 15 fields |
| `tabbed` | Tabbed sections — for complex objects with many field groups |
| `wizard` | Step-by-step flow — guided data entry (onboarding, applications) |

---

## Configuring a List View

### Data Source (`data`)

Every view connects to data via one of three providers:

```typescript
// Auto-connect to an ObjectStack object
data: { provider: 'object', object: 'support_case' }

// Custom API endpoint
data: { provider: 'api', read: { url: '/api/cases', method: 'GET' } }

// Static inline data
data: { provider: 'value', items: [...] }
```

> **Best practice:** Always use `provider: 'object'` when the data source is
> an ObjectStack-managed object. It enables automatic CRUD, real-time updates,
> filtering, and pagination.

### Columns

Columns can be defined as a simple string array or detailed config:

```typescript
// Simple — field names only
columns: ['subject', 'status', 'priority', 'assigned_to', 'due_date']

// Enhanced — full control
columns: [
  { field: 'subject', link: true, width: 300 },
  { field: 'status',  width: 120, align: 'center' },
  { field: 'priority' },
  { field: 'assigned_to', label: 'Owner' },
  {
    field: 'due_date',
    summary: { function: 'min' },
    sortable: true,
  },
]
```

### Column Features

| Property | Purpose |
|:---------|:--------|
| `field` | Field name (snake_case) — **required** |
| `label` | Display label override |
| `width` | Pixel width |
| `align` | `left` / `center` / `right` |
| `hidden` | Hide by default (user can show) |
| `pinned` | Freeze column: `left` / `right` |
| `sortable` | Allow sorting |
| `resizable` | Allow resizing |
| `link` | Make this the primary navigation link |
| `summary` | Footer aggregation: `count`, `sum`, `avg`, `min`, `max`, etc. |

### Filtering

```typescript
filter: [
  { field: 'status', operator: 'not_equals', value: 'closed' },
  { field: 'assigned_to', operator: 'equals', value: '$currentUser' },
]
```

Common operators: `equals`, `not_equals`, `contains`, `starts_with`,
`greater_than`, `less_than`, `is_empty`, `is_not_empty`, `in`, `not_in`,
`this_week`, `this_month`, `this_quarter`, `last_n_days`.

> **`$currentUser`** is a runtime variable — the logged-in user's ID.

### Quick Filters

One-click filter chips displayed above the list:

```typescript
quickFilters: [
  { field: 'status', operator: 'equals', value: 'open', label: 'Open' },
  { field: 'priority', operator: 'equals', value: 'urgent', label: '🔥 Urgent' },
  { field: 'assigned_to', operator: 'equals', value: '$currentUser', label: 'My Cases' },
]
```

### Sorting

```typescript
// Simple
sort: 'created_at desc'

// Multi-field
sort: [
  { field: 'priority', order: 'desc' },
  { field: 'created_at', order: 'asc' },
]
```

---

## Configuring Kanban Views

```typescript
{
  type: 'kanban',
  data: { provider: 'object', object: 'support_case' },
  columns: ['subject', 'priority', 'assigned_to'],
  groupBy: 'status',
  sort: 'priority desc',
}
```

> **Key rule:** The `groupBy` field should be a `select` type with well-defined
> options. Each option becomes a column on the board.

---

## App Navigation

An **App** groups objects, dashboards, and custom pages into a structured
navigation menu.

```typescript
{
  name: 'helpdesk_app',
  label: 'Help Desk',
  navigation: [
    { type: 'object', object: 'support_case', label: 'Cases', icon: 'ticket' },
    { type: 'object', object: 'knowledge_article', label: 'Knowledge Base' },
    { type: 'divider' },
    { type: 'dashboard', dashboard: 'support_metrics', label: 'Metrics' },
    { type: 'url', url: '/settings', label: 'Settings', icon: 'settings' },
  ],
  branding: {
    logo: '/assets/helpdesk-logo.svg',
    primaryColor: '#3b82f6',
  },
}
```

### Navigation Item Types

| Type | Properties | Purpose |
|:-----|:-----------|:--------|
| `object` | `object`, `label`, `icon` | Link to an object's list view |
| `dashboard` | `dashboard`, `label`, `icon` | Link to a dashboard |
| `url` | `url`, `label`, `icon` | External or custom URL |
| `divider` | — | Visual separator |

---

## Dashboard Design

Dashboards use a grid layout with configurable widgets:

```typescript
{
  name: 'support_metrics',
  label: 'Support Metrics',
  layout: {
    columns: 12,
    rowHeight: 80,
  },
  widgets: [
    {
      type: 'metric',
      title: 'Open Cases',
      position: { x: 0, y: 0, w: 3, h: 1 },
      config: {
        object: 'support_case',
        function: 'count',
        filter: [{ field: 'status', operator: 'not_equals', value: 'closed' }],
      },
    },
    {
      type: 'chart',
      title: 'Cases by Priority',
      position: { x: 3, y: 0, w: 5, h: 3 },
      config: {
        chartType: 'bar',
        object: 'support_case',
        groupBy: 'priority',
        function: 'count',
      },
    },
    {
      type: 'list',
      title: 'Recent Cases',
      position: { x: 8, y: 0, w: 4, h: 3 },
      config: {
        object: 'support_case',
        columns: ['subject', 'status', 'created_at'],
        sort: 'created_at desc',
        limit: 10,
      },
    },
  ],
}
```

### Widget Types

| Type | Purpose |
|:-----|:--------|
| `metric` | Single KPI number (count, sum, avg) |
| `chart` | Bar, line, pie, donut, area chart |
| `list` | Embedded list view (mini table) |
| `calendar` | Embedded calendar widget |
| `custom` | Custom component (HTML / React) |

---

## Report Types

| Type | When to Use |
|:-----|:------------|
| `tabular` | Flat data table with columns and filters |
| `summary` | Grouped data with subtotals (e.g., revenue by region) |
| `matrix` | Cross-tab / pivot table (two grouping dimensions) |
| `chart` | Visual chart report |

---

## Actions

Actions are user-triggered operations attached to objects or views.

### Action Types

| Type | When to Use |
|:-----|:------------|
| `button` | Trigger a server-side operation (e.g., "Close Case") |
| `url` | Navigate to a URL (internal or external) |
| `flow` | Launch a screen flow / wizard |
| `api` | Call a custom API endpoint |

### Action Configuration

```typescript
{
  name: 'escalate_case',
  label: 'Escalate',
  type: 'button',
  icon: 'alert-triangle',
  variant: 'destructive',
  confirmation: {
    title: 'Escalate Case?',
    message: 'This will notify the on-call manager.',
  },
  visibility: {
    condition: "status IN ('new', 'open')",
  },
}
```

> **Best practice:** Always add a `confirmation` dialog for destructive or
> irreversible actions. Use `visibility.condition` to show the button only when
> it is contextually relevant.

---

## Common Pitfalls

1. **Using `provider: 'api'` when `provider: 'object'` is available.**
   Object provider gives you free filtering, sorting, pagination, and
   real-time updates.

2. **Putting too many columns in a grid view.**
   Users rarely need more than 6–8 columns visible by default. Use `hidden`
   for secondary columns.

3. **Forgetting `link: true` on the primary column.**
   The first meaningful column (usually the name/subject) should be the
   navigation link to the record detail.

4. **Not setting quick filters.**
   Quick filters dramatically improve usability. Always add at least a
   "My Records" filter using `$currentUser`.

5. **Dashboard widgets without position.**
   Every widget needs `position: { x, y, w, h }` on the grid. Plan the
   layout on paper first.

---

## References

- [view.zod.ts](./references/ui/view.zod.ts) — Grid/kanban/calendar views, columns, filters
- [app.zod.ts](./references/ui/app.zod.ts) — App definition, navigation items
- [dashboard.zod.ts](./references/ui/dashboard.zod.ts) — Dashboard widgets, layout, data queries
- [chart.zod.ts](./references/ui/chart.zod.ts) — 25+ chart types, axis config, legends
- [action.zod.ts](./references/ui/action.zod.ts) — UI actions, parameters, confirmation
- [page.zod.ts](./references/ui/page.zod.ts) — Page layouts, SDUI, slot definitions
- [widget.zod.ts](./references/ui/widget.zod.ts) — Widget definitions, data bindings
- [component.zod.ts](./references/ui/component.zod.ts) — Component registry, props schema
- [report.zod.ts](./references/ui/report.zod.ts) — Report definitions, grouping, aggregations
- [theme.zod.ts](./references/ui/theme.zod.ts) — Design tokens, color modes, typography
- [Schema index](./references/_index.md) — All bundled schemas with dependency tree

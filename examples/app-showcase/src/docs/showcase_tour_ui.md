---
title: "Tour · UI"
description: Guided tour of the UI domain — apps, views, pages, dashboards, reports, datasets, actions, themes, and portals.
---

# Guided tour — UI

Everything in this domain lives under `src/ui/`.

## App & navigation

`src/ui/apps/index.ts` is the application shell — the navigation you are
clicking through, grouped to teach: Workspace / Data Model / Analytics work
like a real product; the **Authoring · \*** groups are the page-authoring
gallery.

## Views — every visualization, every form layout

- **All Views** (navigation → Authoring · Visualizations → All Views) shows
  the same Task object through every list-view type: grid, kanban, gallery,
  calendar, timeline, gantt, map, chart.
- `src/ui/views/task.view.ts` also declares every form-view layout:
  simple, tabbed, wizard, split, drawer.

## Pages — four authoring models

**Start Here** (navigation, second item) teaches the decision: structured
regions (full/slotted) → constrained-JSX `html` → real `react`, with the
canonical example of each linked from that page.

## Dashboards, reports, datasets, actions

- **Chart Gallery** — one widget per chart family; the coverage test
  introspects `ChartTypeSchema` so a new chart type fails CI until it
  appears here.
- Reports (summary / matrix / joined) live in the Analytics group;
  a flat "tabular report" is deliberately a ListView lens (ADR-0021).
- `src/ui/datasets/` — the dataset semantic layer feeding reports and
  dashboards; the cube in the data domain covers the service-side analytics
  surface.
- `src/ui/actions/` — the ActionType × location matrix (script / url /
  modal / flow / api / form), visible as buttons across Task screens.

## Themes & portals

`src/ui/themes/` ships light + dark; `src/ui/portals/` exposes the public
library portal that serves this very manual.

Continue with the [Automation tour](./showcase_tour_automation.md), or go
back to the [overview](./showcase_index.md).

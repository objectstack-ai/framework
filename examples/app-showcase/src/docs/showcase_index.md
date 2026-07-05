---
title: Showcase
description: Overview of the showcase package and the docs-as-metadata feature it demonstrates.
---

# Showcase

The living conformance fixture for the ObjectStack protocol: every field
type, view type, chart type, report type, and action location appears at
least once, and the coverage test fails when the platform gains a
feature this package does not yet demonstrate.

This manual itself demonstrates one of those features — **package docs
as metadata** (ADR-0046). Every Markdown file in the flat `src/docs/`
directory compiles into a `doc` metadata item at build time, ships
inside the package artifact, and renders in the console at
`/docs/<name>`.

For the authoring rules this page must itself obey, see the
[documentation guide](./showcase_docs_guide.md) — or jump straight to
its [cross-reference section](./showcase_docs_guide.md#cross-references).

## Guided tour

One walkthrough per protocol domain, mirroring the `src/` layout:

- [Data](./showcase_tour_data.md) — objects, fields, validations, hooks,
  seed, extensions, the analytics cube
- [UI](./showcase_tour_ui.md) — apps, views, pages, dashboards, reports,
  datasets, actions, themes, portals
- [Automation](./showcase_tour_automation.md) — flows & approvals, jobs,
  webhooks, connectors
- [System](./showcase_tour_system.md) — datasources & federation, i18n,
  email, docs-as-metadata, custom endpoints
- [Security](./showcase_tour_security.md) — roles, permission sets,
  profile, sharing, row-level security

**AI (agent / tool / skill)** is the sixth protocol domain and is
deliberately absent here: agents are platform-owned (ADR-0063) and the
open framework exposes AI via MCP only. The coverage manifest records the
waiver — see
[framework#2610](https://github.com/objectstack-ai/framework/issues/2610).

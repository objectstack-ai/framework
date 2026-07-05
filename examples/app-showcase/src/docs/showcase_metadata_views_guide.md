---
title: Live Metadata Views in Docs
description: How to embed live, read-only views of state machines, flows, and permissions directly in the prose.
---

# Live Metadata Views in Docs

Documentation is for the reader who can't — or shouldn't — open Studio: a
business analyst, a project manager, an auditor. For them a running screen only
ever shows *their own slice* of the system. It never shows the whole shape of a
process, the full set of legal state transitions, or who can do what across an
object.

A ` ```metadata ` fenced block embeds that **live, read-only view** straight
into the prose. Each view is **resolved at read time** from the current
metadata — change the underlying rule and the diagram changes with it. Nothing
is a screenshot (ADR-0051).

## The mechanism

A fence body is flat `key: value` data (not code):

```md
&#96;&#96;&#96;metadata
type: state_machine     # one of: state_machine · flow · permission
object: showcase_task   # state_machine only — the rule lives on an object
name: task_status_flow  # the metadata name; linted for liveness at build
detail: business        # flow only — fold technical nodes away
&#96;&#96;&#96;
```

Two guarantees keep embeds honest:

- **Build-time liveness lint** — a dead same-package reference (typo'd name,
  deleted rule) fails `os build`, exactly like a broken doc link.
- **Read-time resolution** — the rendered view is projected from the metadata
  the server is running *now*, never a stale copy.

Here is one live sample — the `task_status_flow` state machine on
`showcase_task`, the rule that governs which board moves are legal:

```metadata
type: state_machine
object: showcase_task
name: task_status_flow
```

## Where the embeds live now

The guided tour embeds each view type **in the context that explains it**:

- state machines (task and the project lifecycle with terminal states) — in
  the [Data tour](./showcase_tour_data.md)
- a flow at business altitude — in the
  [Automation tour](./showcase_tour_automation.md)
- a permission access-matrix — in the
  [Security tour](./showcase_tour_security.md)

Back to the [overview](./showcase_index.md).

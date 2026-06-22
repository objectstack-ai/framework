---
"@objectstack/spec": patch
---

fix(spec): make `GanttConfigSchema` forward-compatible via `.passthrough()`.

The gantt renderer (objectui plugin-gantt) keeps adding view-config knobs
(e.g. `lockField`, `defaultCollapsedDepth`) ahead of this schema. Without
passthrough, the console — which validates the view config against a bundled
copy of this schema before handing it to the renderer — strips any field not
declared here, so every new renderer knob needs a spec release + console
rebuild before it can take effect. Adding `.passthrough()` lets unknown fields
flow through to the renderer, decoupling renderer releases from spec releases.
Known fields keep their validation; the renderer still only reads what it
understands.

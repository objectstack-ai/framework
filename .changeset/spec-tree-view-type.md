---
"@objectstack/spec": minor
---

feat(spec): add a `tree` view type to the ListView schema

`'tree'` is now a valid `ListView.type` (and `VisualizationType`), backed by a
new `TreeConfigSchema` (`parentField` / `labelField` / `fields` /
`defaultExpandedDepth`, passthrough). This lets a self-referencing object be
served as a tree-grid; without it the runtime Zod-validates view metadata and
silently drops `type:'tree'`. Renderer ships in objectui `@object-ui/plugin-tree`.

---
'@objectstack/spec': minor
---

Dashboard-level filters spec pairing (framework#2501, objectui#2578) — land the
two properties the objectui runtime already ships (objectui#2576) so the
protocol and the renderer agree:

- **`GlobalFilterSchema.name`** (optional string) — stable filter name used as
  the dashboard-variable key (readable in widget expressions as `page.<name>`)
  and as the key widgets reference in `filterBindings`. Defaults to `field`;
  `"dateRange"` is reserved for the built-in dashboard date range.
- **`DashboardWidgetSchema.filterBindings`** (optional
  `Record<string, string | false>`) — per-widget binding from a dashboard
  filter name to one of THIS widget's fields: a string re-targets the filter to
  that field, `false` opts the widget out, absent falls back to the filter's
  own `field`.

Purely additive — existing dashboards parse unchanged. The metadata-admin
dashboard inspector (objectui `dashboard-schema.ts`) derives its form from this
schema via `z.toJSONSchema`, so both properties surface there automatically
once objectui picks up this spec version.

---
"@objectstack/console": minor
---

Console (objectui) refreshed to `e164196801bd`. Frontend changes in this range:

- fix(app-shell,plugin-detail): record History tab renders display values, not raw audit payloads (#2691)
- fix(plugin-gantt): mirror the row 「→」 slot in the task-list header (#2690)
- fix(plugin-detail): #2688 header Record-#id floor + raw audit user id in meta footer (#2689)
- feat(plugin-gantt)!: remove the mobile QR share (移动端二维码) context-menu feature (#2687)
- feat(plugin-gantt): dependencyTypes switch — hide the type switcher for id-only dependency stores (#2686)
- feat(approvals): decision attachments + progress display + deep link + designer sync (#2681)
- feat(studio): inline push-down expansion of loop/parallel/try_catch regions on the flow canvas (#2680)
- feat(plugin-gantt): ownership-aware reschedule + confirm-first auto-schedule, export fixes, business time zone (#2683)
- fix(app-shell): skip resultDialog fields whose path does not resolve (#2674)
- feat(studio): visualize loop/parallel/try_catch nested regions on the flow canvas (#2670) (#2675)
- feat(plugin-gantt): manual-scheduling summary bars, interaction switches, beforeTaskUpdate veto + tooltip/scrollbar/cursor fixes (#2677)
- fix(flow-designer): author the canonical config.schedule the runtime reads (#2671)
- feat(report): drill a date-bucket cell into its time range, not a superset (#1752) (#2672)
- feat(studio): filter editor for roll-up summary fields (framework#1868) (#2669)
- feat(flow-designer): first-class panel for the time-relative trigger (#1874) (#2668)
- feat(studio): nest per-iteration / per-region step logs in the flow Runs panel (#2667)
- fix(metadata-admin): dashboard label fallback + skill activation editors (#1878) (#2666)

objectui range: `2e7d7f0f7ee7...e164196801bd`

---
"@objectstack/console": minor
---

Console (objectui) refreshed to `a44e7b6b28c6`. Frontend changes in this range:

- fix(form): honor field widget hint on the section-layout path
- feat(plugin-gantt): 写后回读服务端重算字段 + 工具栏手动刷新按钮 (#2436 第 6/7 项) (#2442)
- fix(plugin-detail,plugin-gantt): 记录抽屉尊重行级锁定——能力由 handler 是否传入决定 (#2436 第 5 项) (#2441)
- feat(console-ai): ask→build handoff carries conversation context + live verification (ADR-0057 P4) (#2444)
- feat(console-ai): explicit "Open in Builder →" ask→build handoff (ADR-0057 P4) (#2439)
- feat(plugin-gantt): 逐任务预警描边 borderColorField(超期红/临期橙) (#2440)
- fix(plugin-gantt): 快速筛选树感知——命中任务保留全部祖先链 (#2438)
- feat(plugin-gantt): 连线校验——锁定行/分组行落点拒绝、全量成环检测、onBeforeDependencyCreate 否决钩子 (#2437)
- feat(plugin-gantt): api 数据源支持读取 + 全部回写（改期/依赖/删除/内联编辑） (#2423)
- fix(console-ai): preserve ?package= across the /ai URL mirror (ADR-0057 P1 hardening) (#2422)

objectui range: `6a741605b1e0...a44e7b6b28c6`

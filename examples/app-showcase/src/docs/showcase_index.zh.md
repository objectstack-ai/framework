---
title: Showcase 示例
description: showcase 包概览,以及它演示的"文档即元数据"特性。
---

# Showcase 示例

ObjectStack 协议的活体一致性夹具:每种字段类型、视图类型、图表类型、报表类型和
动作位置都至少出现一次;当平台新增了本包尚未演示的特性时,覆盖率测试就会失败。

这份手册本身就演示了其中一个特性——**包文档即元数据**(ADR-0046)。扁平
`src/docs/` 目录里的每个 Markdown 文件都会在构建期编译成一条 `doc` 元数据、随包
产物一起发布,并在控制台 `/docs/<name>` 渲染。

本页自己必须遵守的撰写规则,见
[文档撰写指南](./showcase_docs_guide.md)。

## 分域导览

每个协议域一篇走查,与 `src/` 目录结构一一对应:

- [数据](./showcase_tour_data.md) — 对象、字段、校验规则、钩子、种子数据、
  对象扩展、分析 cube
- [界面](./showcase_tour_ui.md) — 应用、视图、页面、仪表盘、报表、数据集、
  动作、主题、门户
- [自动化](./showcase_tour_automation.md) — 流程与审批、定时任务、Webhook、
  连接器
- [系统](./showcase_tour_system.md) — 数据源与联邦、国际化、邮件、
  文档即元数据、自定义端点
- [安全](./showcase_tour_security.md) — 角色、权限集、Profile、共享规则、
  行级安全

**AI(agent / tool / skill)**是第六个协议域,这里刻意没有演示:agent 由平台
自有(ADR-0063),开源框架只经 MCP 暴露 AI 能力。覆盖清单以豁免条目如实记账——
见 [framework#2610](https://github.com/objectstack-ai/framework/issues/2610)。

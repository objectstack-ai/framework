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

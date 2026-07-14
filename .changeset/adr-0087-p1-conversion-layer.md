---
'@objectstack/spec': minor
'@objectstack/service-automation': patch
---

ADR-0087 P1:元数据转换层(conversion layer,D2)——大多数破坏性变更对使用方零操作。

`@objectstack/spec` 新增 `conversions/` 模块:一张按协议大版本组织、声明式、无损的转换表,在**加载时**(`normalizeStackInput` —— `defineStack` / `objectstack validate` / `lint` / `info` / `doctor` 共用的同一入口)把旧(N−1)形态的元数据改写为规范的 N 形态,并对每处改写发出结构化弃用通知(`OS_METADATA_CONVERTED`)。使用方仍按旧形态编写也能零操作加载,运行时只会看到规范形态。这是把 Kubernetes storage-version/conversion 模型套用到元数据上;它与 Prime Directive #12 禁止的“使用方侧方言兜底”在每个维度上都相反:一张集中、随 spec 版本化、声明化、显式(每次应用都发通知)、带测试(每条附 old→new fixture)、会过期(仅在一个大版本内加载期生效,之后退役并沉淀进 P2 迁移链)的表,而非散落的 `cfg.a ?? cfg.b`。

首批以已发布的 protocol 11 重命名回填播种:

- `flow-node-http-callout-rename`:流程回调节点 `http_request` / `http_call` / `webhook` → `http`。
- `page-kind-jsx-to-html`:页面 `kind: 'jsx'` → `'html'`(ADR-0080 规范拼写)。
- `flow-node-crud-filter-alias`:CRUD 流程节点 `config.filters` → `config.filter`。

并落实 PD #12 退役路径示范:`filters` → `filter` 别名从 `service-automation` 执行器的 `readAliasedConfig` 兜底中删除,提升为上面这条声明式转换条目;执行器改为直接读取规范键 `cfg.filter`。

新增导出(纯增量,无破坏):`applyConversions`、`collectConversionNotices`、`ALL_CONVERSIONS`、`CONVERSIONS_BY_MAJOR`、`CONVERSION_NOTICE_CODE`,以及类型 `MetadataConversion`、`ConversionNotice`、`ConversionApplication`、`ConversionFixture`、`ApplyConversionsOptions`、`NormalizeStackInputOptions`。`normalizeStackInput` 现接受可选第二参 `{ onConversionNotice }`(向后兼容)。

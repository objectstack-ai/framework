# framework × objectui 近两天改动主题梳理(2026-07-03 ~ 07-05)

> 覆盖 `framework`(spec/runtime/security/automation/showcase)与 `objectui`
> (console SPA:app-shell/studio/plugin-*)两仓两天内的全部改动,按**主题**而非
> 时间线组织,并给出跨仓 PR 对照。文末含本次在 showcase 新增的 `ObjectNavItem.filters`
> 演示元数据与浏览器实测结论。
>
> - framework 窗口内提交:**72**;objectui:**49**。
> - 数据来源:两仓 `git log --since=2026-07-03 --until=2026-07-06`。
> - PR 号:`(#NNNN)` 为对应仓的 PR;跨仓联动处标注 `framework#NNNN` / `objectui#NNNN`。

---

## 目录

1. [安全 / 授权(两扇门 + 反过滤预言机)](#1-安全--授权)
2. [协议契约演进(spec / lint)](#2-协议契约演进speclint)
3. [声明式导航切面:`ObjectNavItem.filters`(旗舰特性)](#3-声明式导航切面objectnavitemfilters)
4. [自适应记录呈现 + 关联列表主标签](#4-自适应记录呈现--关联列表主标签)
5. [声明式集成:apis / mappings / cube / objectExtension](#5-声明式集成apis--mappings--cube--objectextension)
6. [自动化 / Flow 运行可观测性](#6-自动化--flow-运行可观测性)
7. [Studio 编辑闭环:审阅后发布 + 只读包门禁 + 数据失效总线](#7-studio-编辑闭环)
8. [Showcase 重构:六域布局 + 能力地图 + 覆盖率守卫](#8-showcase-重构)
9. [协议元数据种类精简(ADR-0088)](#9-协议元数据种类精简adr-0088)
10. [本次新增演示元数据与实测结论](#10-本次新增演示元数据与实测结论)

---

## 1. 安全 / 授权

两天内最重的一条主线,落地 **ADR-0086 两扇门(two-doors)权限分离** 与
**secure-by-default** 翻转,并堵住一个"字段权限过滤预言机"侧信道。

| 主题 | framework | 说明 |
| --- | --- | --- |
| **Secure-by-default 翻转** | `#2562`(#2561 P0) | `requireAuth` 默认改为**必须鉴权**;`transfer/restore/purge` 加 RBAC 门禁。破坏性变更(`feat!`),旧代码若依赖匿名可写会被拒。 |
| **两扇门分离 P1/P2** | `#2566` `#2573` | 权限集(permission set)区分"元数据门"与"配置门":声明式来源带包 provenance(`bootstrapDeclaredPermissions`),运行期配置门独立。 |
| **鉴权架构文档** | `#2569` `#2559` `#2580` | ADR-0086 边界(元数据↔配置)+ 跨包组合;两扇门明确为"已落地"而非路线图。 |
| **字段权限反预言机** | `#2630` | 字段级权限**谓词守卫**:防止用户借"可筛选但不可见"字段的过滤结果反推隐藏字段值(filter-oracle)。同 PR 还加了导航落地互斥(见 §3)。 |
| **共享限流 / 会话** | `#2572`(ADR-0069 D2)`#2570` | 跨节点限流 + 会话存储走 cache service;补齐 last-login 审计字段。 |
| **失败暴露** | `#2568` `#2565` | 权限集解析失败不再被吞,显式上报。 |

objectui 侧对应把 Studio 的 **Access(访问)支柱**按包作用域收口:

| objectui | 说明 |
| --- | --- |
| `#2229` | Access rail 服务端按 `packageId` 作用域(ADR-0086 P1 跟进)。 |
| `#2225` | 包 Access 门是 draft/published 两态,而非直接 live(P2 · D6/D7)。 |
| `#2222` | Access 矩阵按 `{ packageId }` 作用域 + 保存时切片合并。 |

**要点**:secure-by-default 翻转是升级时最需要注意的破坏性项——本地/示例若跑
匿名写会 401/403,需要显式 `requireAuth:false` 或补 permission set。

---

## 2. 协议契约演进(spec/lint)

`packages/spec` 是元数据生产者↔消费者的 Zod 契约。两天内它既加特性也**收紧
lint**,把"构建期就该报的错"从运行期前移。

| framework | 类型 | 说明 |
| --- | --- | --- |
| `#2583` | lint(ADR-0053 phase 4) | **拒绝**对象列表视图上写 `userFilters`(快捷筛选只允许放 interface page,见记忆 `userfilters-only-in-page-mode`)。 |
| `#2586`(#2554) | build-lint | 视图引用检查:命名冲突**告警**,表单目标非法**报错**。 |
| `#2556` | lint | `expandViewContainer` 视图 key 冲突大声告警。 |
| `#2558` | metadata-protocol | 视图身份(identity)继承到运行期 overlay。 |
| `#2589` | runtime | metadata save/publish 错误携带 spec 校验 issue + 422 状态码贯通。 |
| `#2590` `#2582` | docs/adr | 补齐 10.0.0–11.10.0 协议 changelog;ADR-0087 面向 AI 消费者的协议升级(转换优先于通知 + 可重放迁移链)。 |

objectui 侧把 spec 校验失败**下沉到字段**:

| objectui | 说明 |
| --- | --- |
| `#2234` | Studio 保存/发布时,把 spec 校验失败显示在**出错字段**上。 |
| `#2218` | `/view/<name>` 路由解析短视图名。 |
| `#2214` | 视图级 `FormField.visibleOn` 用规范 CEL 引擎求值(与对象级一致)。 |

---

## 3. 声明式导航切面:`ObjectNavItem.filters`

**本窗口最完整的一条 framework ↔ objectui 端到端特性**,也是本次 showcase
新增演示的对象。

**契约端(framework `#2626`)** — `spec` 给 `ObjectNavItem` 加
`filters: z.record(z.string(), z.string())`:一个导航项可以直接对准对象的
**裸数据面**(`/:objectName/data`),预置 `filter[<field>]=<value>` 条件,
而不必先建一个具名视图。支持模板变量 `{current_user_id}` / `{current_org_id}`
做"我的/本组织"切面。

**互斥守卫(framework `#2630`)** — `app.zod` 的 `superRefine` 拒绝把 `filters`
与 `recordId` / `viewName` 混用。落地优先级 **`recordId` → `filters` → `viewName`**;
混用是作者态歧义(残留的 `recordId` 会悄悄劫持切面),故构建期直接拒。

**消费端(objectui `#2255`,内含 `#2251`)** — app-shell 新增
`/:objectName/data` 参数化裸数据面;`packages/layout/src/NavigationRenderer.tsx`
的 `resolveHref` 把 `item.filters` 编译成 `${objectPath}/data?filter[field]=value`,
并配套 active-state **逆向解析**(`#2272`/`objectui#2273`),让带
`?filter[...]` 的切面项也能正确高亮(否则精确 pathname 匹配永不命中)。
`AppNavInspector` 同步做了**四落地模式**改造(default / view / record / filters,
`objectui#2245`/`#2273`),Inspector 里可视化编辑这些 URL 过滤条件。

| 端 | PR | 交付物 |
| --- | --- | --- |
| 契约 | framework `#2626` | `ObjectNavItem.filters` schema |
| 守卫 | framework `#2630` | 落地互斥 superRefine + 优先级 |
| 裸数据面 | objectui `#2255`/`#2251` | `/:objectName/data` + `resolveHref` 切面路由 |
| 高亮 | objectui `#2272`/`#2273` | active-state 逆向解析器 |
| Inspector | objectui `#2245`/`#2273` | 四落地模式编辑器 + i18n |
| 技能文档 | objectui `#2265`/`#2247` | app-composition 决策指南(nav vs views vs pages)+ filters-slice eval |

---

## 4. 自适应记录呈现 + 关联列表主标签

一组"记录详情页更聪明"的协同改动。

| 主题 | framework | objectui | 说明 |
| --- | --- | --- | --- |
| **自适应记录面** | `#2595`(#2578) | `#2237`(#2515) | `FormField.span` 语义跨列 + `navigation.size` + 响应式列;表单按视口自适应布局。 |
| **关联列表主标签** | `#2594`(#2579) | `#2235` | `relatedList: 'primary'` 让详情页把某个关联列表提升为**主标签页**;支持多 FK、自引用、统一 picker 列。 |
| **URL 驱动详情标签** | — | `#2267`(#2257) | `?tab=` 记录详情标签**在 remount 后仍存活**。 |
| **flow 感知记录面** | `#2622`(#2604 Step 1)`#2604 Step 2` | `#2256` | `deriveRecordFlowSurface`:把记录相关的 task flow 派生成 overlay 呈现在记录面上,带返回不变量。 |
| **默认关联列表 CRUD** | — | `#2227` | 默认关联列表支持增删改、打开详情、子级 action。 |
| **名称字段统一解析** | — | `#2236`(ADR-0079) | `page:header` 记录标题按 nameField 走统一解析器。 |
| 文档 | `#2599`/`#2600` | `#2239` | 技能与指南同步 adaptive + related-list 'primary'。 |

---

## 5. 声明式集成:apis / mappings / cube / objectExtension

把过去要写 handler 代码的东西**元数据化**。

| 主题 | framework | objectui | 说明 |
| --- | --- | --- | --- |
| **声明式 API 端点** | `#2611`(showcase 落地 `680804970`) | — | `apis:` 里声明 `ApiEndpoint`,运行期按 path+method 派发到 `object_operation`(数据读)或 `flow`(跑流程),**零 handler 代码**。 |
| **具名导入映射** | `#2611`/`#2629` | `#2277`(#2611) | `defineMapping` 接入导入链路;plugin-grid 导入向导用已注册映射。 |
| **数据立方 / 对象扩展** | `25f7035d7` | — | `defineCube`(服务端分析面)+ `defineObjectExtension`(对已有对象叠加字段/视图)在 showcase 骨干上演示。 |
| **Studio 授权动作接线** | `#2608`(#2605/#2591/#2592) | `#2244` | Studio 里挑连接器动作(不再手打 action id),运行期接线 objectql/sharing/i18n。 |

---

## 6. 自动化 / Flow 运行可观测性

| framework | 说明 |
| --- | --- |
| `#2581` | **持久化运行历史**,带失败原因(run observability)。 |
| `#2603`(#2585) | 运行历史保留策略 + 单次运行详情持久化。 |
| `#2596`(#2588) | 执行 **Studio 作者编写的 hook body**:接默认 bodyRunner + live 重绑定。 |
| `#2576` `#2560` | 服务运行中发布的 flow 无需重启即绑定;冷启动即绑触发器(不只 HMR 后)。 |
| `497bda853` | 按 flow status 做启用/禁用 + 暴露运行期 enable/bound 状态。 |

objectui 侧:`#2240`(自动化启停开关 + Automations rail 实时状态)、`#2246`
(草稿 flow 也显示在 rail)、`#2230`(失败运行原因显示在 Runs 面板)。

---

## 7. Studio 编辑闭环

objectui 这两天把 Studio 从"能改"推进到"改得**安全、可审阅、不白刷 UI**"。

| objectui | 说明 |
| --- | --- |
| `#2271` | **审阅后发布**:发布前确认 + 变更面板里字段级 diff。 |
| `#2270` | Studio dogfood 跟进:API 名派生、**只读包门禁**、发布确认、导航脚手架、i18n 清扫。 |
| `#2263` | 只读包上禁用编辑可供性 + 字段 API 名 live 同步。 |
| `#2274` | **数据失效总线**:刷新数据而非重建 UI(react/app-shell/plugin-detail/components 协同)。 |
| `#2280`(#2269) | refresh-in-place 的 CI 回归守卫。 |
| `#2275` | package-id 向导反馈 + P3 dogfood 打磨。 |
| `#2241`(ADR-0080) | app → Studio 顶栏反向桥。 |
| `#2233` | 表单提交剥离计算字段(computed)。 |

framework 侧对应 `#2625`/`#2618`:只读包被拒时给**用户可读文案**,不泄露内部 ADR 路径。

---

## 8. Showcase 重构

`examples/app-showcase` 被系统性重组为"每种能力演示一次并索引"的样板库。

| framework | 说明 |
| --- | --- |
| `e03d2fc79` | 按**六大协议域**重组 `src/`。 |
| `7768a7593` + `1aab20937` | **注册表驱动的 kind 覆盖率**:每种元数据种类要么被演示(带证明文件),要么被显式豁免(带理由+issue)。`pnpm verify` 守住这张地图(`src/coverage.ts`)。 |
| `aa8f8dc47` | 能力地图(capability map)落地页 + 逐域向导游览。 |
| `#2621`(#2616)`576ef3201` | 跟上协议升级:REST 字段崩溃、AI 404 刷屏、死胡同向导、Mark Done 未绑定、KPI 卡片卡住、离线种子图;校验强制翻转 / span / 派生抽屉宽度。 |
| `#2631` `#2632` | Command Center flex 子项撑满;CRM Workbench KPI 卡读 `adapter.find().data`(非 `.records`,见记忆 `objectstack-multiselect-gotcha` 同源坑)。 |
| `205d15be8`(#2550) | console 列表/表单能力全量实测报告(35 项问题),见同目录 `console-list-form-capability-report-2026-07.md`。 |

---

## 9. 协议元数据种类精简(ADR-0088)

`da807f716`(`#2628`)落地 **ADR-0088 元数据种类准入测试**:退役
`trigger` / `router` / `function` / `service` 四种旧元数据种类。配合早前退役
`compactLayout` 别名的清理,协议表面在收敛。升级消费者需注意:这些 kind 不再被
注册表接纳,应迁移到 flow / apis / hook。

---

## 10. 本次新增演示元数据与实测结论

### 10.1 新增内容

选取 §3 的旗舰特性 `ObjectNavItem.filters` 作为端到端演示,在 showcase 落地:

- **`examples/app-showcase/src/ui/apps/index.ts`** — 新增导航组
  **`grp_slices`「Data Slices (filters)」**,插在 `grp_data` 与 `grp_analytics`
  之间。三个子项都对准同一个 `showcase_task` 对象,但各自预置不同切面:
  - `nav_slice_in_progress` → `filters: { status: 'in_progress' }`
  - `nav_slice_urgent` → `filters: { priority: 'urgent' }`
  - `nav_slice_review` → `filters: { status: 'in_review' }`
- **`examples/app-showcase/src/docs/showcase_tour_ui.md`** — 新增
  "Data Slices — declarative `filters` on the bare data surface" 段,解释切面、
  互斥守卫(#2630)与模板变量。

### 10.2 验证矩阵

| 层 | 手段 | 结果 |
| --- | --- | --- |
| 元数据构建 | `pnpm build`(turbo 70 任务) | ✅ 通过,dist 产物含 `grp_slices` + 3 个 filters |
| 协议校验 | `pnpm validate` | ✅ 通过 |
| 契约守卫 | `app.zod` superRefine(#2630) | ✅ filters 与 recordId/viewName 混用会被拒(未触发,三项纯 filter) |
| 单测 | `vitest`(55 例) | ✅ 全绿 |
| 后端语义 | REST `/api/v1/data/showcase_task?filter[...]` | ✅ in_progress=2、urgent=2、in_review=2、不带过滤=10 |
| 前端渲染(侧栏) | 内置浏览器 preview(:3777 `/_console`) | ✅ 「Data Slices (filters)」组渲染,展开出 3 个子项,显示自定义 label(旧 dist 只显示「任务」)|
| 前端渲染(URL 切面链路) | 点击切面项 → 跳 `/showcase_task/data?filter[...]` | ✅ **重建 dist 后跑通**(见 §10.3)|
| 前端渲染(裸数据面+chip) | 落地面渲染过滤结果 + 可移除 chip | ✅ 「状态 = in_progress ×」可移除 chip + **2 行**记录,与后端一致 |

### 10.3 曾经的阻塞与其排查:vendored dist 陈旧 → 重建后跑通(无需改代码)

**首测现象**:点击切面项时 URL 停在标准对象面
`/_console/apps/com.example.showcase/showcase_task`,**没带** `/data?filter[...]`。

**排查(确认非代码缺陷)**:

- `.objectui-sha` 钉在 **`6c1ad9e`(2026-07-05 14:34)**,其源码**已含**切面路由
  `resolveHref`(objectui `#2255`/`b8f158c64`,经 `git merge-base` 确认是 6c1ad9e
  的祖先)。→ 契约与消费端源码都在,逻辑上无需改任何代码。
- 但**首测时** `packages/console/dist`(gitignore 产物)的 assets 时间戳是
  **2026-07-02 20:29**,**早于** `#2255` 落地(07-05);bundle 里搜不到切面路由的
  运行期 token。即 vendored bundle 落后于所钉的 objectui 源(framework main 当时
  尚未 `pnpm objectui:refresh`)。

**处置(不改代码,只重建产物)**:用官方脚本 `scripts/build-console.sh`
(经 `OBJECTUI_ROOT` 指向本地 objectui,脚本内部对该 SHA **建独立 git worktree**
于 `.cache/objectui-6c1ad9e20624`,**不改动**共享检出的 HEAD/工作树)重建 console
dist:
- 产物打上 provenance `packages/console/dist/.objectui-sha=6c1ad9e2062…`;
- bundle canary `import/jobs` 通过;
- layout chunk(`ui-layout-*.js`)现同时含 `}/data` 与 `filter[` 运行期字面量。

**重建后复测(全绿)**:重启 dev server 加载新 dist,三个切面项的 href 变为
`…/showcase_task/data?filter[status]=in_progress`(以及 `priority=urgent`、
`status=in_review`);点击落地到裸数据面,标题「由 URL 定义的数据切面——不绑定任何
已保存视图」,带**可移除过滤 chip**「状态 = in_progress ×」,渲染 **2 行**
(Build homepage / Ingest pipeline),侧栏该项高亮(active-state 逆向解析 #2272)。

**结论**:切面特性本身完全正确,**首测未跑通纯属仓库构建产物陈旧,不需要改任何
代码**。framework main 侧后续只需在 objectui bump 后跑一次 `pnpm objectui:refresh`
让 vendored dist 追上 `.objectui-sha` 即可(该刷新本就是发布管线职责)。

### 10.4 测试环境

| 项 | 值 |
| --- | --- |
| 分支 | `claude/wizardly-dubinsky-e30281`(worktree) |
| 启动 | `objectstack dev --ui --seed-admin -p 3777 -d file:/tmp/showcase-dogfood-3777/data.db` |
| Console | vendored objectui,`.objectui-sha=6c1ad9e`;首测吃 07-02 旧 dist,经 `build-console.sh` 重建到 6c1ad9e 后复测(见 §10.3) |
| 端口纪律 | 用隔离端口 3777 + 独立 tempdir DB;**未触碰**其他 agent 占用的 3000/5180 |
| 日期 | 2026-07-05 |

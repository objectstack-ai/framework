# Showcase 对象列表 / 表单能力完整实测报告(2026-07)

> 内置浏览器(preview MCP)对 `examples/app-showcase` 逐项真实操作测试,全程截图留痕。
> 本文为问题权威记录;Word 版(文字+截图)见同目录
> `showcase-console-capability-test-report.docx`。

## 测试环境

| 项 | 值 |
| --- | --- |
| 分支 / 提交 | `claude/nifty-neumann-ed7c3e` @ `9d121934e` |
| 启动方式 | `objectstack dev --ui --seed-admin -p 3777 -d file:/tmp/showcase-dogfood-3777/data.db` |
| Console | `/_console`(vendored objectui,钉在 `.objectui-sha` = `2cfa36e96`) |
| 账号 / 语言 | `admin@objectos.ai`,浏览器 zh-CN 会话 |
| 测试日期 | 2026-07-02 ~ 2026-07-04 |
| 截图 | `./screenshots/`(01–38,29 号因外链图片慢加载误判已删除) |

## 测试范围(用户要求"不要有遗漏")

行按钮(行菜单/详情页 action 各 location)、行内编辑、列表选中批量按钮、批量修改
(4 种参数形态)、对象表单分组、字段显示隐藏(对象级 visibleWhen/requiredWhen/
readonlyWhen 与视图级 FormField.visibleOn)、lookup 级联选择(dependsOn +
lookupFilters)、命名视图与视图路由、userFilters、筛选/分组/排序/搜索、6 种可视化、
分页/每页行数、主子表(发票明细)、related list 行内编辑、flow action(toolbar 与行级)、
新建/编辑表单、必填校验、select 默认值、国际化与 UI 异常。

---

## 一、缺陷清单(35 项)

严重度:**P0** 功能不可用/数据错误;**P1** 功能明显受损或严重误导;**P2** 体验/一致性/国际化。

### 行内编辑 / 行按钮 / action

| # | 严重度 | 问题 | 证据 |
| --- | --- | --- | --- |
| 10 | **P0** | **行内编辑完全不可用**:视图 meta `inlineEdit:true`、工具栏"行内编辑"按钮可切换高亮,但点击单元格(含真实点击)永不进入编辑态,反而触发行导航打开记录预览。源码链路完整,定性为 vendored console 运行时缺陷 | 截图 11、12 |
| 5 | P1 | 视图级 `inlineEdit` 开关失义:未配置 inlineEdit 的视图工具栏同样显示"行内编辑"按钮,开关不改变行为 | — |
| 6 | P1 | **modal 类型 action 不弹窗**:Quick View 点击后无任何弹窗,仅英文 toast "Action completed successfully"(既没执行也误报成功) | 截图 04 |
| 7 | P1 | 行级 action 的 `visible` 表达式(`!record.done`)在**列表行菜单不生效**:done=true 刷新后行菜单仍显示 Mark Done;详情页同一表达式正确生效(对照) | 截图 07 vs 08/09 |
| 8 | **P0** | **form 类型 action 崩坏**:Log Time 整页跳 `/_console/forms/showcase_task.default`,渲染黑屏 + 错误标题(取了 list 视图名"All Tasks")+ 零字段 + 裸 Submit;提交后还误报成功 toast | 截图 10 |
| 20 | **P0** | `/_console/forms/*` 路由渲染器对所有 form 视图全坏:`tabbed` 同样黑屏 + 原始名标题 + 零字段 + 裸 Submit → tabbed/wizard 表单**无任何可用 UI 入口** | 截图 24 |
| 19 | **P0** | **form 视图与 list 视图同名 `default` 时被静默改名 `default_2`**(`/api/v1/meta/view` 可见 showcase_task.default_2/tabbed/wizard/split/quick 均 viewKind:form),`showcase_task.default` 解析到 list 视图 —— form action target 失配的根因之一;冲突静默发生,无 build 告警 | API meta |
| 23 | P1 | `record_more` 与 `record_section` 两个 action location 在任务详情页**完全不渲染**(Open Docs / Recalculate Estimate 无处可见);项目详情页却有"…"按钮 —— 行为不一致 | — |
| 27 | **P0** | **flow action(list_toolbar)无记录上下文即崩**:Reassign… 从工具栏启动,提交后错误 toast 裸露英文技术信息 "Node 'apply' failed: update_record(showcase_task) failed: Update requires an ID or options.multi=true";flow screen 的 new_assignee 渲染为裸文本输入而非用户选择器,按钮 Cancel/Submit 英文 | — |
| 35 | **P0** | **flow action(行级 list_item)成功与失败信号并存**:从行菜单启动 Reassign…,记录实际更新成功(API 核实 assignee sam→nora),但界面同时弹出红色错误 toast(同 #27 文案)与绿色 "Done" toast —— 用户无法判断成败;且成功路径也复用了失败分支 | 截图 34,API 核验 |
| 17 | P2 | 自定义 action 标签(Mark Done / Reassign… / Quick View / Log Time)全英文,与系统项(编辑/删除)中文混排 | 截图 03 |

### 批量操作

| # | 严重度 | 问题 | 证据 |
| --- | --- | --- | --- |
| 12 | **P0** | **批量编辑多选 select 被单选化**:字段定义 `type:'multiselect'+multiple:true` 正确,但 UI 下拉即选即关、选新值替换旧值,落库为标量 `'qa'` 而非数组 —— 数据被写坏 | 截图 15,API 核验 |
| 13 | P1 | 批量编辑 lookup 参数确认页显示裸 ID(`94vGlm…` 而非 Dev Admin) | 截图 16 |
| 14 | P2 | 批量编辑 lookup 参数无搜索框(单选 8 个选项、多选皆无,数据多时不可用) | — |
| 15 | P1 | 批量编辑 date 参数无日期选择器:裸 text input,点击不弹日历;手输 `2026-08-01` 才可被接受 | 截图 17 |
| 11 | P2 | 批量栏/批量弹窗按钮英文混排(Delete/Cancel/Next/Back/Run/Close/Done/Undo) | 截图 13–17 |

### 表单 / 字段显隐 / 级联

| # | 严重度 | 问题 | 证据 |
| --- | --- | --- | --- |
| 16 | **P0** | **表单视图级 `FormField.visibleOn` 完全不生效**:meta 正常下发 CEL(`dialect:'cel'`),但 priority=Low 时 notes 字段仍显示。对照:对象字段级 visibleWhen/requiredWhen/readonlyWhen 全部生效(见"正常项") | 截图 18、19 vs 23 |
| 21 | **P0** | **级联 lookup(dependsOn)双缺陷**:① 选完 account 后 contact 主输入仍禁用,占位文案"请先选择account"中英混排字段名;编辑已有记录时也锁死;② 旁路"表格选择器"完全**不应用级联过滤**,列出全部联系人 —— 级联约束可被绕过 | 截图 21 |
| 22 | P1 | 明细行 `readonlyWhen`(parent.status=='paid')冻结可被**旁路表格选择器图标绕过**:Paid 状态下仍能打开产品选择弹窗(弹窗标题还是省略号"选择…") | — |
| 33 | P1 | **select 默认值全链路不生效**:contact.stage 定义 `default:true` 的 New 选项,新建表单不预选(显示"请选择"),仅填必填项提交后落库 `stage=null` —— 表单端与服务端都没应用默认值 | API 核验 |
| 18 | P2 | 必填校验消息中英混排:"标题 is required" | 截图 20 |

### 视图 / 列表 / 筛选 / 分页

| # | 严重度 | 问题 | 证据 |
| --- | --- | --- | --- |
| 29 | **P0** | **导航项 viewName 生成短名路由,视图解析静默失败回退默认视图**:Analytics→Task List 生成 `/view/tabular`,页面面包屑显示 "Tabular"、侧边栏高亮,但渲染的列/筛选/选中 tab 全是默认视图的;页内视图切换用全限定名 `/view/showcase_task.tabular` 则一切正常 —— 同一视图两个入口两种结果,且失败无任何提示 | 截图 35 vs 36 |
| 30 | **P0** | **视图 `userFilters` 配置完全不渲染**:tabular 视图 meta 定义了 dropdown 快捷筛选(status / priority(showCount) / done(boolean) / project),页面上既无独立下拉,也不出现在"筛选"面板 | 截图 36 |
| 25 | P1 | 筛选/排序面板新增行**默认字段为系统字段 Organization**(英文);字段列表暴露 Sync Status / Sync Error 等内部字段,且系统字段全英文 | 截图 26 |
| 26 | P2 | 分组点"添加分组字段"立即按默认字段"标题"分组(每组 1 条,无意义);组头显示英文选项标签(Done/In Progress) | 截图 27 |
| 31 | P1 | **列表页脚记录数显示的是当前页行数而非总数**:120 条数据、每页 100 时页脚显示 "100 条记录",翻到第 2 页变 "20 条记录" —— 用户看不到真实总量(分页条本身的"第 X 页,共 Y 页"是对的) | 截图 37、38 |
| 32 | P1 | 列表工具栏**无导出按钮**(只有导入),也**无列显示/隐藏设置**入口(工具栏仅 行内编辑/筛选/分组/排序/密度/搜索) | 截图 36 |
| — | P2 | (观察项)虚拟滚动懒加载中,lookup 列(Owner)单元格短暂渲染字面量 `[object Object]`,最终渲染正常;快速滚动时用户可见 | DOM 抓取 |

### 服务端 / DX

| # | 严重度 | 问题 | 证据 |
| --- | --- | --- | --- |
| 9 | P1 | **持久 DB 缓存包元数据**:源码改动后重启 dev 不同步(须删 `.objectstack`/数据库文件)—— 开发体验陷阱,极易误判"改了没生效" | — |
| 34 | P1 | **API 无效查询参数被静默忽略**:`GET /api/v1/data/showcase_contact?filter=email eq '…'`(错误参数名/语法)不报错,直接返回**全量**数据;正确参数是 `filters=[["email","=","…"]]` 三元组 —— 静默忽略易造成调用方误取全量 | API 核验 |

### 国际化 / UI 一致性

| # | 严重度 | 问题 | 证据 |
| --- | --- | --- | --- |
| 1 | P2 | zh-CN 下视图页签/视图名英文(All Tasks/In Progress/Urgent/Done)+"还有 9 个"混排;"管理所有视图…"中文与英文视图名混排 | 截图 01、06 |
| 2 | P2 | 日期列默认相对格式为英文(Tomorrow / In 2 days / Overdue 7d)与中文绝对日期(6月15日)同列混排;详情页同样出现 | 截图 01 |
| 3 | P2 | select 选项标签英文(Done/In Progress/High/Medium/Urgent 等)—— 选项级翻译缺失或平台不支持 | 截图 01、27 |
| 4 | P2 | console 首页中英混排(Your apps / Needs your attention / Items you open will show up here.) | — |
| 24 | P2 | 详情页 related list 可编辑网格标题 "Tasks" 及表头全英文 —— 翻译 bundle 里有中文但网格不读 | 截图 25 |
| 28 | P2 | 发票创建 toast 双条中英混出("发票创建成功"+"Created");发票表单按钮英文 Cancel 而任务/联系人表单是中文"取消"(同产品不一致);对象描述英文;"Owner"列头英文;数值列排序方向标注 "A → Z" | 截图 22 |

## 二、验证正常的能力(不要遗漏"好消息")

- 命名视图切换与过滤(In Progress → 2 行正确)— 截图 02
- 行操作菜单齐全(编辑/删除/自定义 action)— 截图 03
- script action 执行 + `refreshAfter` 写库(Mark Done → done/progress 落库)— 截图 05
- action `visible` 表达式在**详情页**正确生效 — 截图 08/09
- 批量操作主链路:选中出批量栏、内置删除、4 种自定义批量定义齐全、确认页
  (confirmText + 受影响记录 + 参数预览)、执行 Succeeded 2/2、**Undo 回滚**(API 核实)— 截图 13/14/16
- 对象字段级三种条件规则全部生效:Paid → 付款日期出现且必填、税率只读、开具日期必填 — 截图 23
- `lookupFilters` 生效(churned 客户被排除,13→11)
- 发票主子表:明细行内编辑、金额/汇总实时计算并正确落库 — 截图 22
- 明细行 `readonlyWhen` 冻结(定义内路径)生效
- related list 网格行内编辑保存落库(estimate 16→18)— 截图 25
- 筛选(状态=Done → 2 条)、按状态分组、排序(预计工时降序)、列表搜索(homepage → 1 条)— 截图 26/27
- 6 种可视化全部渲染:Grid/Kanban/Gallery/Calendar/Timeline/Gantt — 截图 28、30–33
- 记录详情:状态机 stepper、评论区、related 页签中文
- 表单必填校验拦截(空必填不能提交)— 截图 20
- 新建表单正确排除 readonly 字段(contact.lead_score 不出现在创建表单)
- 分页:>100 条出现分页条,翻页正确(行号连续)、每页行数 5/10/20/50/100 可切换
  ("第 1 页,共 6 页" 正确)— 截图 37/38

## 三、测试数据变更(dev 库 /tmp,不入库)

- 新建发票 INV-TEST-01(Draft/Nora West/1 行 ¥50)
- 任务 "SEO migration plan" estimate_hours 16→18;"Build homepage" assignee sam→nora(flow 测试)
- 批量造 115 个"分页测试联系人" + 1 个"默认值测试联系人"(分页/默认值测试)

## 四、修复建议优先级

1. **P0 数据/功能级**:#12 批量多选写坏数据、#10 行内编辑不可用、#8/#19/#20 form
   action 与 forms 路由全链、#27/#35 flow action、#16 visibleOn、#21 级联 lookup、
   #29 视图路由静默回退、#30 userFilters
2. **P1 误导/受损**:#31 页脚计数、#25 筛选默认系统字段、#33 select 默认值、#34 API
   静默忽略参数、#9 DB 元数据缓存、#13/#15 批量参数控件、#22 只读旁路、#23 action 位置
3. **P2 国际化一致性**:集中治理 console 内置 UI 文案与元数据标签的 zh-CN 覆盖
   (#1–4、#11、#17、#18、#24、#26、#28)

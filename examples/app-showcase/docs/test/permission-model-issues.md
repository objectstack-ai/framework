# 权限模型问题总清单(第三轮全量复测,2026-07-14)

> 复测性质:**只测试、不修改代码**。本文记录第三轮复测(fresh DB → REST 49 断言 → Playwright 25 条)中发现的全部问题,每条附截图或响应原文证据。
> 主报告:[permission-model-test-report.md](./permission-model-test-report.md) · 测试清单:[permission-model-test-checklist.md](./permission-model-test-checklist.md)
> 复测结论:修复测试环境(补岗位绑定、造 announcement 数据、物化共享)后 **REST 49/49、Playwright 25/25 全部通过**;下列问题均为复测过程中暴露、**未做任何代码修改**的记录。
> **复核批注(同日二次核验)**:本文全部断言已逐条用一手证据重新验证(在线 REST 重放、SQLite 物理表直查、fresh DB 副本引导、源码/规格对照、截图目验);①②③ 的初版表述有误已修正,并新增 ⑩。修正处以「**复核修正**」标注。

## 分级速览

| # | 问题 | 级别 |
|---|---|---|
| ① | 锚点岗位(everyone)可被数据 API 物理删除;重启只补锚点**不补绑定** | 🔴 重大缺陷 |
| ② | fresh 部署绑定为 **0**(everyone 也空壳)静默降级;isDefault 自动绑定路径存在但不可靠 | 🔴 重大缺陷(DX) |
| ③ | 启动期种子数据不物化共享规则 | 🟡 未修问题 |
| ④ | 无 cookie 时 console FLS 渲染 fail-open | 🟡 未修问题 |
| ⑤ | showcase_announcement 无 name 字段、无种子 | 🟡 未修问题 |
| ⑥ | dev 服务器反复被外部 SIGKILL | 🔵 环境观察 |
| ⑦ | 拒绝语义分层不一致(400 vs 403) | 🟡 未修问题 |
| ⑧ | lookup 列显示 API name 而非中文 label | 🔵 既知观察 |
| ⑨ | 复跑脚本 perm-setup.sh 不自足 | 🟡 未修问题(交付物缺口) |
| ⑩ | REST list 静默忽略不支持的 `$filter` 参数 | 🟡 未修问题 |

---

## 🔴 重大缺陷

### ① 锚点岗位(everyone)可被数据 API 物理删除;重启只补锚点不补绑定

`managed_by: system` 的内置锚点岗位没有数据门层面的删除保护。第二轮 N6 测试的"删除被拒"是 **FK 引用完整性的假象**(绑定行引用它才被拒),不是锚点保护。二次核验全链路重放(每步均为实采原文):

1. 带绑定直接删(**复核修正**:精确语义是 `HTTP 409 + code:DELETE_RESTRICTED`,初版笼统写 4xx):

```
DELETE /api/v1/data/sys_position/<everyone-id>  (admin)
→ HTTP 409  {"error":"Cannot delete sys_position (position_mrkwb1pci9xawitn): 1 dependent
    sys_position_permission_set record(s) reference it via position_id ...","code":"DELETE_RESTRICTED",
    "dependentObject":"sys_position_permission_set","dependentCount":1,"object":"sys_position"}
```

2. 先删 everyone→showcase_member_default 绑定行(200),再删 everyone 岗位:

```
DELETE /api/v1/data/sys_position/<everyone-id>  (admin)
→ HTTP 200  {"object":"sys_position","id":"position_mrkwb1pci9xawitn","success":true}
随后 GET 同 id → HTTP 404 RECORD_NOT_FOUND
```

**everyone 锚点被真删掉。** 全局基线权限锚点消失意味着所有用户的 everyone 基线授权悬空。

3. **复核修正(比初版更严重)**:初版称"重启幂等种子会补回锚点及绑定"——二次核验实测,重启后 `bootstrapDeclaredPositions` 只补回 everyone **锚点本身**(新 id,`managed_by:system`),**绑定不补回**:重启后绑定表仍 7 条、everyone 名下为空。即误删 + 重启后 everyone 是**无任何权限集的空壳**,基线授权仍然丢失且无告警。另注意锚点 id 会因删除/重建而漂移。

- 期望:锚点岗位(everyone/guest)应与"VAMA 集绑 everyone 被拦"(H 节已有的锚点门)同级,在数据门层面拒绝 DELETE(≥400)。
- 影响面:仅 admin 可触发(非提权),但属于"系统自我保护缺失",误操作即打穿基线且重启也无法完整自愈。

### ② fresh 部署绑定为 0(everyone 也空壳),静默降级;isDefault 自动绑定路径存在但不可靠

岗位↔权限集绑定**纯靠运行时数据行**(sys_position_permission_set),包/规格层没有任何声明式绑定机制:

- 规格佐证:`packages/spec/src/security/permission.zod.ts` L187 —— PermissionSetSchema 无 positions/绑定键;`isDefault` describe 原文 *"[ADR-0090 D5] Install-time suggestion to bind this set to the everyone position (admin confirms; **never auto-bound**)"*(二次核验逐字确认)。
- **复核修正(比初版更严重)**:初版称 fresh DB 有 1 条 boot 自动绑的 everyone 绑定;二次核验用**全新 DB 副本引导 + SQLite 物理表直查**(`SELECT COUNT(*) FROM sys_position_permission_set` → **0**),fresh boot 实际 **0 条绑定**——13 个岗位(含 7 个 showcase 岗位 contributor/manager/exec/auditor/ops/field_ops_delegate/client_portal_user,初版误把 bu_* 计入,bu_* 是业务单元非岗位)与 everyone/guest 锚点**全部空壳**,连 everyone 基线授权都没有。此状态下种子红色项目、new 询价俱在,REST 首跑 **20/49 失败**,所有 persona 静默降级,**无任何警告或报错**。
- **自动绑定路径存在但不触发**:引擎里确有 boot 自动绑定实现——`packages/plugins/plugin-security/src/security-plugin.ts` L1114-1152(ADR-0090 D5 注释块):kernel:ready 时把 `fallbackPermissionSet`(CLI 从 app 的 isDefault 集解析,`serve.js` L1421)幂等绑到 everyone,生成 `pps_<ts36><rand6>` 格式 id。本轮 r3 测试库中确实出现过一条该格式的 everyone→showcase_member_default 绑定(`pps_mrkwddl1bxoc8z`,id 时间戳紧跟某次重启),证明该路径**执行成功过一次**;但二次核验的两次 fresh boot 与一次重启均**未产生**该绑定(物理表 0 行,异常被 catch 静默为 warn 且默认日志级别不可见)。即:代码想自动绑,实际大概率没绑上,且失败无诊断信号。
- **规格与实现矛盾依旧成立,方向修正**:规格说 "never auto-bound",实现却存在自动绑定代码路径(且至少成功过一次)——两者必有一处不符设计;叠加"该路径通常不触发",行为完全不可预期。
- 手工经 REST 建 7 条 showcase 绑定后 45/49;另需 everyone→member_default 基线绑定。

影响:任何按文档 fresh 部署 app-showcase 的人拿到的都是"权限模型看似全坏"的静默降级状态,极难排查(没有"岗位无绑定"的诊断信号)。

## 🟡 未修问题

### ③ 启动期种子数据不物化共享规则

共享规则是**写时物化**(写入时生成 sys_record_share 行),但 **SeedLoader 在启动期写入的种子行不触发物化**:

- E3 场景:wes(bu_west_coast)按共享规则应看到 priya 的询价,fresh DB 首测**看不到**(sys_record_share 无行)。
- admin 对该记录做一次空触碰 `PATCH {"status":"new"}`(值不变)→ 共享立即物化,wes 立即可见。
- 运行时写入的记录(如 guest 公共表单提交)物化正常,问题仅限启动期种子通道。
- **二次核验硬证据**:全新 DB 副本引导完成后直查——种子中存在命中共享规则的记录(health=red 项目 1 条、status=new 询价 1 条,规则定义见 `src/security/sharing-rules.ts`:red→exec、red+budget>10 万→manager、new 询价→Field Ops BU 子树),而 `sys_record_share` 为 **0 行**;对照 r3 测试库,运行时 guest 表单产生的 5 条询价均有对应 share 行,被空触碰过的 priya 记录也有——与"种子不物化、运行时写物化"完全一致。

影响:凡依赖共享规则的种子演示数据,开箱即坏,须运行时"摸一下"才生效。

### ④ 无 cookie 时 console FLS 渲染 fail-open

console 的 FLS 渲染(字段禁用/锁定)依赖 better-auth **cookie** 会话;仅有 localStorage `auth-session-token` 时,UI 判定不了权限,**fail-open 成全字段可编辑**:

| 证据 | 状态 |
|---|---|
| [R3-I2a-token-only-budget-editable.png](./screenshots/R3-I2a-token-only-budget-editable.png) | ada(contributor)仅 token 无 cookie:Edit Project 弹窗中 budget=150000 / spent=60000 **白底可编辑** |
| [R3-I2b-cookie-budget-locked.png](./screenshots/R3-I2b-cookie-budget-locked.png) | 同一 ada 带 cookie:同弹窗同字段 **灰显禁用**(正确) |

数据面(REST PATCH)仍强制剥离受限字段,所以**不构成越权写入**,但 UI 允许用户填写必被丢弃的值,fail-open 方向错误(权限未知时应 fail-closed 为只读)。归属 objectui console 前端。

### ⑤ showcase_announcement 无 name 字段、无种子、创建权极窄

- 该对象**没有 name 字段**:admin 创建带 `name` 报 `HTTP 400` `{"error":"Unknown field 'name' on object 'showcase_announcement'","code":"INVALID_FIELD","field":"name"}`(二次核验重放确认)。违反本仓已知约定"所有对象都需 name 字段"(displayNameField 有缺陷)。
- `dist/objectstack.json` 的 15 个种子对象里**无 showcase_announcement**(也无 showcase_private_note)→ C3/C4/F3 断言在 fresh DB 上因 0 条数据空转。
- 创建权仅 `showcase_ops` 集(`src/security/permission-sets.ts` L186:allowRead+allowCreate+allowEdit+modifyAllRecords);member_default 与另一集仅 allowRead(L215/L243)。mia(manager)创建被 403 **是设计使然**,但意味着复跑时须以 oskar/admin 手工造数据(见 ⑨)。

### ⑦ 拒绝语义分层不一致(400 vs 403)

同一用户(mia)、同为权限拒绝,两层返回的状态码与结构不一致(本轮补采原文):

**记录范围层**(writeScope:own,改他人记录)→ **HTTP 400**,裸 error 字符串、无 code 字段:

```
PATCH /api/v1/data/showcase_inquiry/Ue3qA9_usBdCXyOY  (mia)
→ HTTP 400  {"error":"FORBIDDEN: insufficient privileges to update showcase_inquiry Ue3qA9_usBdCXyOY"}
```

**能力门层**(对象无 create 权)→ **HTTP 403**,结构化 code:

```
POST /api/v1/data/showcase_announcement  (mia)
→ HTTP 403  {"error":"[Security] Access denied: operation 'insert' on object 'showcase_announcement'
    is not permitted for positions [org_member, manager, everyone]","code":"PERMISSION_DENIED",
    "object":"showcase_announcement"}
```

问题:① 语义上两者都是授权拒绝,记录范围层用 400(Bad Request)不符 HTTP 语义,应为 403;② 一层有 `code` 机器可读字段、另一层没有,客户端无法统一分支;③ "FORBIDDEN" 只出现在 error 字符串内部而非 code 字段。

### ⑨ 复跑脚本 perm-setup.sh 不自足(交付物缺口)

[perm-setup.sh](./scripts/perm-setup.sh) 在 fresh DB 上跑完后直接执行 perm-test.sh 只有 **29/49** 通过,缺三步(本轮均手工补齐后 49/49):

1. **不创建任何岗位↔权限集绑定**(问题②的直接体现;7 条 showcase 岗位绑定 + everyone→member_default 基线绑定都要)——须 REST 循环补建;
2. **不创建 showcase_announcement 测试数据**(问题⑤)——须以 admin/oskar 造,且**不能带 name 字段**;
3. **不做共享物化触碰**(问题③)——须 admin 对 priya 询价空触碰一次。

注:zsh 下补绑定不能用 `declare -A`(bad substitution),用 `pair%%:*` 字符串切分。这是我方测试交付物的缺口,按"只测试不改代码"指令仅记录,未修。

### ⑩ REST list 静默忽略不支持的 `$filter` 参数(二次核验新增)

数据 API 不支持 OData `$filter` 语法,但**不报错也不提示**,直接返回未过滤的全量/分页结果:

```
GET /api/v1/data/sys_position?$filter=name eq 'everyone'   → 返回全部 13 个岗位
GET /api/v1/data/showcase_task?$filter=name eq 'zzz_nonexistent' → 返回 10 条(分页首页)
```

危险性:调用方以为拿到的是过滤后的结果集(尤其在权限/安全脚本里按名取 id 时,取到的其实是"第一条记录"),极易造成误操作——本次核验中就因此差点把 DELETE 打到 contributor 岗位上。期望:不支持的查询参数应报 4xx 或至少在响应中回显生效的过滤条件。(服务端实际支持的过滤格式是三元组 filters,见仓库既知条目。)

## 🔵 环境 / 既知观察

### ⑥ dev 服务器反复被外部 SIGKILL

本轮 `objectstack serve --dev`(:3777)被杀 **5 次**。判据:受控后台监控(`node ... serve; echo "SERVER EXITED code=$?"`)中**尾标 echo 未执行**、整个 shell 一并消失 → 是外部 SIGKILL,非进程内部崩溃;应用日志无任何崩溃痕迹,DiagnosticReports 无对应 jetsam 报告。存活窗口内服务完整跑完 25 条 Playwright(约 25 分钟)与全部 REST 断言,**与权限模型代码无关**,属本机环境问题(疑似其它会话/看门狗清理 node serve 进程)。

### ⑧ lookup 列显示 API name 而非中文 label

既知问题(见主报告 §5 与仓库既知缺陷"网格 lookup 只认 name 字段"),本轮复现依旧:引用列显示目标记录 name 原值,displayNameField/titleFormat 不生效。不再展开。

---

## 证据索引

- 截图:[screenshots/](./screenshots/) — 本轮新增 R3-I2a/R3-I2b(问题④);L*/N*/O* 系列为复测重跑覆盖。
- 响应原文:①②③⑤⑦⑨⑩ 的 HTTP 状态码与 body 已逐条内嵌于上文,均为本轮实采;①③⑤⑦⑩ 另经同日二次核验在线重放逐字比对,②③ 附全新 DB 副本 SQLite 物理表直查结果。
- 复跑:`bash docs/test/scripts/perm-setup.sh` → 手工补 ⑨ 三步 → `bash docs/test/scripts/perm-test.sh`(49 断言)→ `PERM_BASE_URL=http://localhost:3777 pnpm exec playwright test --config playwright.permission.config.ts`(25 条)。

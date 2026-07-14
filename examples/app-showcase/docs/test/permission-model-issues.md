# 权限模型问题总清单(第三轮全量复测,2026-07-14)

> 复测性质:**只测试、不修改代码**。本文记录第三轮复测(fresh DB → REST 49 断言 → Playwright 25 条)中发现的全部问题,每条附截图或响应原文证据。
> 主报告:[permission-model-test-report.md](./permission-model-test-report.md) · 测试清单:[permission-model-test-checklist.md](./permission-model-test-checklist.md)
> 复测结论:修复测试环境(补岗位绑定、造 announcement 数据、物化共享)后 **REST 49/49、Playwright 25/25 全部通过**;下列问题均为复测过程中暴露、**未做任何代码修改**的记录。

## 分级速览

| # | 问题 | 级别 |
|---|---|---|
| ① | 锚点岗位(everyone)可被数据 API 物理删除 | 🔴 重大缺陷 |
| ② | 无声明式岗位↔权限集绑定,fresh 部署静默降级 | 🔴 重大缺陷(DX) |
| ③ | 启动期种子数据不物化共享规则 | 🟡 未修问题 |
| ④ | 无 cookie 时 console FLS 渲染 fail-open | 🟡 未修问题 |
| ⑤ | showcase_announcement 无 name 字段、无种子 | 🟡 未修问题 |
| ⑥ | dev 服务器反复被外部 SIGKILL | 🔵 环境观察 |
| ⑦ | 拒绝语义分层不一致(400 vs 403) | 🟡 未修问题 |
| ⑧ | lookup 列显示 API name 而非中文 label | 🔵 既知观察 |
| ⑨ | 复跑脚本 perm-setup.sh 不自足 | 🟡 未修问题(交付物缺口) |

---

## 🔴 重大缺陷

### ① 锚点岗位(everyone)可被数据 API 物理删除

`managed_by: system` 的内置锚点岗位没有数据门层面的删除保护。第二轮 N6 测试的"删除被拒"是 **FK 引用完整性的假象**(绑定行引用它才被拒),不是锚点保护:

1. `DELETE /api/v1/data/sys_position/<everyone-id>` → 4xx,报错原文含 `dependent record(s) reference it`(sys_position_permission_set 绑定行引用)。
2. 先 `DELETE` 掉 everyone→showcase_member_default 绑定行(成功),再删 everyone 岗位:

```
DELETE /api/v1/data/sys_position/<everyone-id>  (admin token)
→ HTTP 200  {"object":"sys_position","id":"<everyone-id>","success":true}
```

**everyone 锚点被真删掉。** 全局基线权限锚点消失意味着所有用户的 everyone 基线授权悬空。重启后 `bootstrapDeclaredPositions` 幂等种子会补回锚点及绑定,但运行中的实例在重启前处于锚点缺失状态。

- 期望:锚点岗位(everyone/guest)应与"VAMA 集绑 everyone 被拦"(H 节已有的锚点门)同级,在数据门层面拒绝 DELETE(≥400)。
- 影响面:仅 admin 可触发(非提权),但属于"系统自我保护缺失",误操作即打穿基线。

### ② 无声明式岗位↔权限集绑定,fresh 部署静默降级

岗位↔权限集绑定**纯靠运行时数据行**(sys_position_permission_set),包/规格层没有任何声明式绑定机制:

- 规格佐证:`packages/spec/src/security/permission.zod.ts` PermissionSetSchema 无 positions/绑定键;`isDefault` 注释为 *"[ADR-0090 D5] Install-time suggestion to bind this set to the everyone position (admin confirms; **never auto-bound**)"*。
- fresh DB 实测:7 个 showcase 岗位(contributor/manager/exec/auditor/ops/field_ops_delegate/bu_*)全部**零绑定空壳**,首跑 REST 套件 **20/49 失败**——所有 persona 静默降级到 everyone 基线,**无任何警告或报错**。
- 手工经 REST 建 7 条绑定行后恢复 45/49。
- **规格与实测矛盾**:isDefault 声称 "never auto-bound",但 boot 实测**自动**建了 everyone→showcase_member_default 绑定行(fresh DB 唯一的绑定,共 8 条中的第 8 条)。二者必有一处不符设计。

影响:任何按文档 fresh 部署 app-showcase 的人拿到的都是"权限模型看似全坏"的静默降级状态,极难排查(没有"岗位无绑定"的诊断信号)。

## 🟡 未修问题

### ③ 启动期种子数据不物化共享规则

共享规则是**写时物化**(写入时生成 sys_record_share 行),但 **SeedLoader 在启动期写入的种子行不触发物化**:

- E3 场景:wes(bu_west_coast)按共享规则应看到 priya 的询价,fresh DB 首测**看不到**(sys_record_share 无行)。
- admin 对该记录做一次空触碰 `PATCH {"status":"new"}`(值不变)→ 共享立即物化,wes 立即可见。
- 运行时写入的记录(如 guest 公共表单提交)物化正常,问题仅限启动期种子通道。

影响:凡依赖共享规则的种子演示数据,开箱即坏,须运行时"摸一下"才生效。

### ④ 无 cookie 时 console FLS 渲染 fail-open

console 的 FLS 渲染(字段禁用/锁定)依赖 better-auth **cookie** 会话;仅有 localStorage `auth-session-token` 时,UI 判定不了权限,**fail-open 成全字段可编辑**:

| 证据 | 状态 |
|---|---|
| [R3-I2a-token-only-budget-editable.png](./screenshots/R3-I2a-token-only-budget-editable.png) | ada(contributor)仅 token 无 cookie:Edit Project 弹窗中 budget=150000 / spent=60000 **白底可编辑** |
| [R3-I2b-cookie-budget-locked.png](./screenshots/R3-I2b-cookie-budget-locked.png) | 同一 ada 带 cookie:同弹窗同字段 **灰显禁用**(正确) |

数据面(REST PATCH)仍强制剥离受限字段,所以**不构成越权写入**,但 UI 允许用户填写必被丢弃的值,fail-open 方向错误(权限未知时应 fail-closed 为只读)。归属 objectui console 前端。

### ⑤ showcase_announcement 无 name 字段、无种子、创建权极窄

- 该对象**没有 name 字段**:admin 创建带 `name` 报 `HTTP 400 INVALID_FIELD: Unknown field 'name'`。违反本仓已知约定"所有对象都需 name 字段"(displayNameField 有缺陷)。
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

1. **不创建 7 条岗位↔权限集绑定**(问题②的直接体现)——须 REST 循环补建;
2. **不创建 showcase_announcement 测试数据**(问题⑤)——须以 admin/oskar 造,且**不能带 name 字段**;
3. **不做共享物化触碰**(问题③)——须 admin 对 priya 询价空触碰一次。

注:zsh 下补绑定不能用 `declare -A`(bad substitution),用 `pair%%:*` 字符串切分。这是我方测试交付物的缺口,按"只测试不改代码"指令仅记录,未修。

## 🔵 环境 / 既知观察

### ⑥ dev 服务器反复被外部 SIGKILL

本轮 `objectstack serve --dev`(:3777)被杀 **5 次**。判据:受控后台监控(`node ... serve; echo "SERVER EXITED code=$?"`)中**尾标 echo 未执行**、整个 shell 一并消失 → 是外部 SIGKILL,非进程内部崩溃;应用日志无任何崩溃痕迹,DiagnosticReports 无对应 jetsam 报告。存活窗口内服务完整跑完 25 条 Playwright(约 25 分钟)与全部 REST 断言,**与权限模型代码无关**,属本机环境问题(疑似其它会话/看门狗清理 node serve 进程)。

### ⑧ lookup 列显示 API name 而非中文 label

既知问题(见主报告 §5 与仓库既知缺陷"网格 lookup 只认 name 字段"),本轮复现依旧:引用列显示目标记录 name 原值,displayNameField/titleFormat 不生效。不再展开。

---

## 证据索引

- 截图:[screenshots/](./screenshots/) — 本轮新增 R3-I2a/R3-I2b(问题④);L*/N*/O* 系列为复测重跑覆盖。
- 响应原文:①②③⑤⑦⑨ 的 HTTP 状态码与 body 已逐条内嵌于上文,均为本轮实采。
- 复跑:`bash docs/test/scripts/perm-setup.sh` → 手工补 ⑨ 三步 → `bash docs/test/scripts/perm-test.sh`(49 断言)→ `PERM_BASE_URL=http://localhost:3777 pnpm exec playwright test --config playwright.permission.config.ts`(25 条)。

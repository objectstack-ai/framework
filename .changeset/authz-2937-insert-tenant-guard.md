---
'@objectstack/plugin-security': minor
---

fix(plugin-security): #2937 — Layer 0 insert post-image 租户检查（伪造 organization_id 的用户 insert 现被拒）

**安全修复 + 行为变更（release-notes callout）。** 多组织模式(`tenancy.mode='multi'` +
`@objectstack/organizations`)下，一个普通用户此前可以 `insert` 一条**伪造 `organization_id`**
(指向别的租户)的业务记录并使其落进受害租户 —— Layer 0 的租户墙 AND-composed 到读 +
update/delete 的 pre-image，但 insert 没有 pre-image、也不带 AST，从未被门控(ADR-0095 D1
读侧 W1 的写侧未竟部分)。

新增 SecurityPlugin 中间件步骤 3.7:对 insert 的 **post-image** 复用读侧同一套 Layer 0 决策
(`computeInsertTenantCheckFilter` → `computeLayeredRlsFilter` 的 `layer0`)做校验 ——
一个**显式提供**的 `organization_id` 必须等于调用者的活动组织,否则 fail-closed 拒绝。规则与
读侧完全一致:单组织/隔离未激活、非租户对象(无 `organization_id` 列或 `tenancy.enabled:false`)、
platform-admin 姿态豁免的对象均不适用;无活动组织的用户提供任意 org_id → 拒(deny sentinel)。

**行为 delta(需注意):** 此前能成功的「带跨租户 `organization_id` 的用户级 insert」现被拒绝。
**缺省(不提供 `organization_id`)的 insert 不受影响** —— 补全仍由 `@objectstack/organizations`
的 auto-stamp 负责(职责分离,因此本检查与 auto-stamp 中间件的注册顺序无关)。系统上下文
(`isSystem`,含 import 引擎 / 迁移 / 每-org seed replay·clone·orphan-claim 的 `SYSTEM_CTX`)
在中间件入口即短路,合法的「代客设置 org_id」写路径**完全不受影响**。

矩阵门:`authz-matrix-gate.test.ts` 新增 `[#2937] Layer 0 insert post-image tenant guard`
八格(伪造异租户→拒、同租户→通过、缺省→放行、无活动组织→拒、platform-admin 私有对象豁免、
public 业务对象不豁免、tenancy-disabled 对象不适用、单组织模式不检查)。授权一致性 ledger
新增 `multi-tenant-insert-postimage` 行。配套 cloud `@objectstack/organizations` 的 auto-stamp
权威覆盖(纵深防御)。Closes objectstack-ai/framework#2937。

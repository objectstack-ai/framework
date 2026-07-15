---
'@objectstack/plugin-security': patch
---

fix(plugin-security): explain posture 证据对齐 enforcement 派生（消除标签漂移）

Security review 低危项。explain-engine 的 `derivePosture(context)` 之前用**松名字匹配**作
posture 证据——`permissions.includes(ADMIN_FULL_ACCESS)`（不校验非作用域）+ `positions.includes(
'org_owner'/'org_admin')`（读 better-auth 角色），比 enforcement（`resolve-authz-context.ts` 的
`hasPlatformAdminGrant`：要求**非作用域 admin_full_access user grant**；TENANT_ADMIN 用
`organization_admin` **能力**而非角色）更松，可能让 explain 面板给运维显示**偏高**的 posture 标签
（作用域 org-admin grant 被误标 PLATFORM/TENANT_ADMIN）。

修法——让 explain 的 posture 走 enforcement 已用的同一份证据：

- **优先直接消费 `ctx.posture`**：principal 经完整 `resolveAuthzContext` 时已带 enforcement 派生的
  rung，逐字返回 → 结构上不可能漂移。
- **回退（explain 用 `buildContextForUser` 自建 context，不经完整 resolveAuthzContext）**：复制
  enforcement 的非作用域 grant 判定——`buildContextForUser` 现按与 `hasPlatformAdminGrant` 逐字节
  一致的规则（`admin_full_access` 且 `organization_id == null` 的 active user grant）计算并挂出
  `hasPlatformAdminGrant`；`derivePosture` 以此 + 投影出的 `platform_admin` 内建岗位判 PLATFORM_ADMIN，
  以 `organization_admin` **能力**判 TENANT_ADMIN，**不再**读 `org_owner`/`org_admin` 角色岗位
  （ADR-0095 D3：角色只是 provisioning 来源，非裁决输入 — explain 侧同样闭合 #2836 dual-track）。
- 保留 explain 特有的 **guest → EXTERNAL** 底（enforcement floor 是 MEMBER），且置于最前。

只改 explain 的 **posture 标签**证据，不改 explain 的 allow/deny verdict（来自复用的 enforcement
filter），不改 enforcement。#2947 跟踪的「posture 未 plumb 进 enforcement context」更广缺口不在本
任务范围。关联 #2920。

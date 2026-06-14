// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Doc } from '@objectstack/spec/system';

/**
 * Setup app overview doc (ADR-0046), registered in this package's manifest so
 * it groups under "Setup" in the `/_console/docs` index.
 *
 * Authored inline rather than as a flat `src/docs/*.md` file because this is a
 * TS-first code package built by tsup, not a user app built by `os build` —
 * `defineStack({ docs })` / manifest `docs[]` is the supported path for those
 * (see `DocSchema` in `@objectstack/spec/system`). The `content` below is plain
 * CommonMark + GFM with no images/MDX, per ADR-0046 §3.4.
 *
 * Principle (from the HotCRM reference docs): document the *invisible* concepts,
 * not what the Setup UI already shows on screen.
 *
 * `translations` carries per-locale variants (ADR-0046 i18n); the REST layer
 * collapses the doc to the request's `Accept-Language` and serves one body.
 */
export const SETUP_OVERVIEW_DOC: Doc = {
  name: 'setup_overview',
  label: 'Setup overview',
  description: 'Orientation for administrators: users, roles & permissions, and record visibility.',
  content: `# Setup overview

Setup is the administrator app for the platform. Its screens are mostly
self-explanatory — this page covers the concepts behind them that the UI does
not make obvious. For the full reference, see <https://docs.objectstack.ai>.

## Users & authentication

Every person who signs in is a \`sys_user\` record. Authentication (passwords,
SSO, API keys, sessions) is handled by the platform's auth layer, so creating a
user here grants *identity*, not access — what they can do is decided entirely
by the roles and permissions assigned to them. Deactivating a user revokes
sign-in without deleting their records, preserving ownership and history.

## Roles & permissions

Permission sets define *what* a user can do (which objects and fields they can
read or write, which apps they can open); roles place a user in the
organization hierarchy and drive *which records* they can reach. A user's
effective access is the union of all permission sets granted to them — access is
additive, so you grant capability rather than taking it away.

## Record visibility (sharing)

Object-level permissions decide whether a user can touch a *kind* of record;
sharing decides *which* rows of that kind they actually see. Visibility starts
from an org-wide default (private or public) and is then widened by the role
hierarchy and explicit sharing rules — it is never silently narrowed. When a
user "can't see a record they should," the cause is almost always sharing, not
object permissions.

See <https://docs.objectstack.ai> for the full security model.
`,
  translations: {
    zh: {
      label: 'Setup 概览',
      description: '管理员入门:用户、角色与权限、记录可见性。',
      content: `# Setup 概览

Setup 是平台的管理员应用。它的界面大多一目了然——本页讲的是界面背后、UI 没有
明说的概念。完整参考见 <https://docs.objectstack.ai>。

## 用户与认证

每个登录的人都是一条 \`sys_user\` 记录。认证(密码、SSO、API Key、会话)由平台
的认证层负责,所以在这里创建用户给的是*身份*,不是权限——他能做什么,完全由分配
给他的角色和权限决定。停用用户会收回登录权,但不删除其记录,从而保留归属与历史。

## 角色与权限

权限集定义用户*能做什么*(可读写哪些对象和字段、能打开哪些应用);角色把用户放进
组织层级,决定他*能触及哪些记录*。用户的最终访问权是其所有权限集的并集——权限是
叠加的,你是在授予能力,而不是在收回能力。

## 记录可见性(共享)

对象级权限决定用户能否操作某*类*记录;共享决定他实际能看到该类记录中的*哪些行*。
可见性从组织级默认(私有或公开)出发,再由角色层级和显式共享规则*放宽*——绝不会被
悄悄收窄。当用户"看不到本该看到的记录"时,原因几乎总是共享,而不是对象权限。

完整安全模型见 <https://docs.objectstack.ai>。
`,
    },
  },
};

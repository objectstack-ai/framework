# Metadata Versioning — Issue Proposals

> **Created:** 2026-04-02
> Three issues covering the metadata versioning roadmap (Phase 2 → Phase 4a → Phase 4b).

---

## Issue 1: Metadata Overlay 持久化 & UI Metadata API 支持 (Phase 2)

### 背景

当前的 Overlay 系统已在内存中实现（`MetadataManager` 内存层），支持三层 Delta 模型（System → Platform → User），但 **overlay 未持久化到数据库**，重启后丢失。要支持 Studio UI 进行 admin/user 级别的元数据定制，必须完成 overlay 的数据库持久化和配套的 REST API。

### 现状分析

**✅ 已实现：**
- `MetadataOverlaySchema` — 完整的 overlay 数据结构（`metadata-customization.zod.ts`）
- `FieldChangeSchema` — 字段级变更追踪（path, originalValue, currentValue）
- JSON Merge Patch (RFC 7396) — `patch` 字段存储增量变更
- 内存中的 `getOverlay()`, `saveOverlay()`, `removeOverlay()`, `getEffective()` 方法
- `MetadataRecordSchema` — 已包含 `scope`, `extends`, `strategy`, `managedBy` 字段
- `DatabaseLoader` — Phase 1 已实现，支持 `sys_metadata` 表的 CRUD

**❌ 待实现：**
- Overlay 写入数据库（利用 `MetadataRecord.extends` + `scope: platform/user`）
- 数据库驱动的 `getEffective()` 三层合并
- REST API 全套 CRUD 端点
- 权限集成（system 只读, platform 需 admin, user 需 owner 校验）
- 数据库变更的 Watch/Events 机制

---

### 任务分解

#### 1. Overlay 数据库持久化

- [ ] **Overlay → MetadataRecord 映射**
  - 将 overlay 存储为 `MetadataRecord`，`scope: 'platform'` 或 `scope: 'user'`
  - 使用 `extends` 字段引用被定制的 system 层元数据
  - 使用 `strategy` 字段（'merge' | 'replace'）控制 overlay 应用方式
  - 追踪 `managedBy`（'package' | 'platform' | 'user'）

- [ ] **DatabaseLoader 扩展**
  - 支持按 `scope` + `extends` 查询 overlay 记录
  - Overlay 保存时自动递增 `version` 字段

#### 2. 数据库驱动的 `getEffective()` 合并

- [ ] **三层合并引擎**
  - 加载 base（system, 来自文件系统） → 合并 platform overlay（来自 DB） → 合并 user overlay（来自 DB）
  - 合并使用 JSON Merge Patch（RFC 7396）
  - 对合并结果缓存，overlay 变更时失效
  - 支持冲突检测（当 base 升级时）

#### 3. REST API 端点

- [ ] **元数据 CRUD API**
  ```
  GET    /api/v1/metadata/:type              — 按类型列出元数据
  GET    /api/v1/metadata/:type/:name         — 获取元数据
  GET    /api/v1/metadata/:type/:name/effective — 获取合并后的有效元数据
  PUT    /api/v1/metadata/:type/:name         — 创建/更新元数据（platform scope）
  DELETE /api/v1/metadata/:type/:name         — 删除元数据
  GET    /api/v1/metadata/:type/:name/overlays — 列出 overlay
  PUT    /api/v1/metadata/:type/:name/overlays/:scope — 保存 overlay
  POST   /api/v1/metadata/query               — 带过滤、分页的查询
  POST   /api/v1/metadata/import              — 批量导入
  GET    /api/v1/metadata/export              — 批量导出
  ```

#### 4. 权限集成

- [ ] **Scope 级别访问控制**
  - system scope: 只读，不可通过 API 修改
  - platform scope: 需要 admin 权限
  - user scope: 只能操作自己的定制
  - 与 `IAuthService` 集成进行权限校验
  - 校验 user scope 记录的 `owner` 字段

#### 5. 数据库变更监听

- [ ] **Polling 方式的变更检测**
  - 为 DatabaseLoader 实现基于轮询的变更检测
  - 变更时发射 `MetadataWatchEvent`
  - 支持 webhook 通知外部消费者

---

### 关键 Spec 依赖

| Spec 文件 | 提供内容 |
|:---|:---|
| `packages/spec/src/system/metadata-persistence.zod.ts` | MetadataRecordSchema（scope, extends, strategy, version） |
| `packages/spec/src/kernel/metadata-customization.zod.ts` | MetadataOverlaySchema, FieldChangeSchema |
| `packages/spec/src/contracts/metadata-service.ts` | IMetadataService 接口 |
| `packages/metadata/src/loaders/database-loader.ts` | DatabaseLoader 实现 |
| `packages/metadata/src/metadata-manager.ts` | MetadataManager 核心逻辑 |

### 验收标准

- [ ] Platform/User overlay 可持久化到 `sys_metadata` 表并在重启后恢复
- [ ] `getEffective()` 从数据库加载 overlay 并正确合并
- [ ] REST API 全套端点可用，Studio UI 可消费
- [ ] Scope 级别权限正确实施
- [ ] 完整的单元测试和集成测试覆盖
- [ ] `packages/metadata/ROADMAP.md` Phase 2 标记为已完成

### 关联

- ROADMAP: `packages/metadata/ROADMAP.md` Phase 2
- 前置: Phase 1 DatabaseLoader ✅ 已完成
- 后续: Phase 4a Metadata Versioning & History

---

## Issue 2: Metadata Versioning & History — 元数据版本历史与回滚 (Phase 4a)

### 背景

ObjectStack 的元数据系统需要支持 **版本历史追踪** 和 **回滚能力**，这是企业级低代码平台的核心需求。当 admin 修改了一个对象定义后，需要能查看变更历史、比较版本差异、并在出现问题时快速回滚到之前的版本。

当前基础设施已具备版本管理的前置条件，但 **历史追踪和回滚尚未实现**。

### 现状分析

**✅ 已有基础设施：**
- `MetadataRecordSchema.version` — 版本号字段，已定义（`metadata-persistence.zod.ts:103`）
- `MetadataRecordSchema.checksum` — 校验和字段，已定义（`metadata-persistence.zod.ts:106`）
- `DatabaseLoader` — 保存时自动递增 `version`（`database-loader.ts:292`）
- `publishPackage()` — 包发布时快照 + 版本递增（`metadata-manager.ts:341-458`）
- `revertPackage()` — 包级别回滚到上次发布状态（`metadata-manager.ts:468`）

**❌ 尚未实现：**
- `sys_metadata_history` 表 — 变更历史存储
- `getHistory(type, name)` — 查询版本时间线
- `rollback(type, name, version)` — 回滚到指定版本
- `diff(type, name, v1, v2)` — 版本间差异比较
- `IMetadataService` 接口中的 history/rollback 方法声明

---

### 任务分解

#### 1. History 存储层

- [ ] **定义 `MetadataHistoryRecordSchema`**（`packages/spec/src/system/metadata-persistence.zod.ts`）
  ```typescript
  MetadataHistoryRecordSchema = z.object({
    id: z.string(),                    // UUID
    metadataId: z.string(),            // 关联的 MetadataRecord.id
    type: z.string(),                  // 元数据类型
    name: z.string(),                  // 元数据名称
    version: z.number(),               // 版本号
    definition: z.unknown(),           // 该版本的完整定义快照
    checksum: z.string(),              // 内容校验和
    changeType: z.enum(['created', 'updated', 'published', 'reverted', 'deleted']),
    changeSummary: z.string().optional(), // 人类可读的变更摘要
    changedBy: z.string().optional(),  // 操作者
    changedAt: z.string().datetime(),  // 变更时间
  });
  ```

- [ ] **创建 `sys_metadata_history` 系统对象**（`packages/metadata/src/objects/`）
  - 对应 `MetadataHistoryRecordSchema` 的数据库表
  - 通过 `IDataDriver.syncSchema()` 自动建表

#### 2. IMetadataService 接口扩展

- [ ] **在 `packages/spec/src/contracts/metadata-service.ts` 增加方法**
  ```typescript
  // 版本历史
  getHistory(type: string, name: string, options?: {
    limit?: number;
    offset?: number;
    since?: string; // ISO datetime
  }): Promise<MetadataHistoryRecord[]>;

  // 回滚到指定版本
  rollback(type: string, name: string, version: number): Promise<void>;

  // 版本差异
  diff(type: string, name: string, fromVersion: number, toVersion: number): Promise<MetadataDiff>;
  ```

#### 3. DatabaseLoader 历史追踪

- [ ] **保存时自动写入历史记录**
  - `save()` 操作时，在更新 `sys_metadata` 记录的同时，向 `sys_metadata_history` 插入一条快照
  - 记录 changeType, changeSummary, changedBy, changedAt
  - 使用内容 hash 生成 `checksum`（SHA-256 或 xxhash）

- [ ] **实现 `getHistory()`**
  - 从 `sys_metadata_history` 按 `type + name` 查询，按 `version DESC` 排序
  - 支持分页（limit + offset）
  - 支持时间范围过滤（since）

- [ ] **实现 `rollback()`**
  - 从 `sys_metadata_history` 加载指定版本的 `definition`
  - 用该 definition 覆盖 `sys_metadata` 当前记录
  - 递增 version 号（回滚本身也是一次变更）
  - 在 history 中记录 changeType: 'reverted'
  - 触发 `MetadataWatchEvent` 通知

- [ ] **实现 `diff()`**
  - 加载两个版本的 definition
  - 使用 JSON deep diff 计算差异
  - 返回结构化的 `MetadataDiff`（added, removed, modified 路径列表）

#### 4. Checksum 实现

- [ ] **内容校验和**
  - 保存时自动计算 definition 的 checksum（规范化 JSON → SHA-256）
  - 用于快速变更检测（不读取完整 definition 即可判断是否变更）
  - 用于版本去重（如果 checksum 与上一版本相同，跳过 history 记录）

#### 5. REST API 端点

- [ ] **历史与回滚 API**
  ```
  GET  /api/v1/metadata/:type/:name/history           — 获取版本历史
  GET  /api/v1/metadata/:type/:name/history/:version   — 获取指定版本快照
  POST /api/v1/metadata/:type/:name/rollback           — 回滚到指定版本
  GET  /api/v1/metadata/:type/:name/diff               — 版本间差异比较
  ```

#### 6. 历史清理策略

- [ ] **可配置的历史保留策略**
  - `MetadataManagerConfig.history.maxVersions` — 每个元数据项保留的最大版本数（默认 50）
  - `MetadataManagerConfig.history.maxAge` — 历史记录最大保留时间（默认 90 天）
  - 后台清理任务（或 lazy 清理：查询时顺带清理过期记录）

---

### 关键 Spec 依赖

| Spec 文件 | 提供内容 |
|:---|:---|
| `packages/spec/src/system/metadata-persistence.zod.ts` | MetadataRecordSchema（version, checksum 字段已存在） |
| `packages/spec/src/contracts/metadata-service.ts` | IMetadataService 接口（需扩展） |
| `packages/metadata/src/loaders/database-loader.ts` | DatabaseLoader（需增加 history 写入） |
| `packages/metadata/src/metadata-manager.ts` | MetadataManager（需增加 history/rollback 方法） |

### 架构对标

| 平台 | 版本控制方式 |
|:---|:---|
| **Salesforce** | Setup Audit Trail + Change Sets，保留 6 个月变更历史 |
| **ServiceNow** | Update Sets + Versions 表，支持回退到任意版本 |
| **Kubernetes** | etcd revision + `kubectl rollout undo`，保留完整 revision 历史 |
| **WordPress** | Post Revisions 表，自动保存修改历史 |

### 验收标准

- [ ] 元数据每次修改自动写入 `sys_metadata_history`
- [ ] `getHistory()` 返回完整版本时间线，支持分页
- [ ] `rollback()` 正确恢复到指定版本，并记录回滚事件
- [ ] `diff()` 返回两个版本间的结构化差异
- [ ] Checksum 正确计算并支持变更检测
- [ ] REST API 端点全部可用
- [ ] 完整的单元测试和集成测试
- [ ] `packages/metadata/ROADMAP.md` Phase 4a 标记为已完成
- [ ] `IMetadataService` 接口更新并通过类型检查

### 关联

- ROADMAP: `packages/metadata/ROADMAP.md` Phase 4a
- 前置: Phase 2 Overlay Persistence（需要数据库 API 层就绪）
- 后续: Phase 4b Package Upgrade & Three-Way Merge

---

## Issue 3: Package Upgrade & Three-Way Merge — 包升级三路合并与冲突解决 (Phase 4b)

### 背景

当 ObjectStack 平台上安装的 Package（插件包）发布新版本时，admin 已经在 platform 层对包的元数据进行了自定义（通过 overlay 系统）。升级包时需要 **三路合并**（Three-Way Merge），在保留 admin 自定义的同时安全地应用包的更新。这是企业级低代码平台的核心能力。

当前协议层（Spec）已完整定义了升级生命周期、合并策略配置和冲突检测模型，但 **运行时实现尚未开始**。

### 现状分析

**✅ 已定义（Spec 层）：**
- `UpgradePlanSchema` — 升级计划，包含 metadata diff 和 impact 分析（`package-upgrade.zod.ts`）
- `MetadataDiffItemSchema` — 单个元数据变更描述（added/modified/removed/renamed）
- `MergeConflictSchema` — 冲突模型（baseValue, incomingValue, customValue, suggestedResolution）
- `MergeStrategyConfigSchema` — 合并策略配置（alwaysAcceptIncoming, alwaysKeepCustom, autoResolveNonConflicting）
- `UpgradePackageRequestSchema` — 请求参数（mergeStrategy: keep-custom | accept-incoming | three-way-merge, dryRun, createSnapshot）
- `UpgradeSnapshotSchema` — 升级前快照（previousManifest, metadataSnapshot, customizationSnapshot）
- `IPackageService` 接口 — `planUpgrade()`, `upgrade()`, `rollback()`, `getSnapshot()`（`package-service.ts`）

**❌ 尚未实现（Runtime 层）：**
- Three-Way Merge 引擎（base vs incoming vs custom）
- 冲突检测与自动/手动解决
- 升级计划生成（metadata diff 计算）
- Pre-upgrade Snapshot 创建与恢复
- 升级执行流水线（PreCheck → Plan → Snapshot → Execute → Validate → Commit/Rollback）
- REST API 端点
- Studio UI 冲突解决界面

---

### 任务分解

#### 1. Three-Way Merge 引擎

- [ ] **实现 `ThreeWayMerger`**（`packages/metadata/src/merge/three-way-merger.ts`）
  - 输入：`base`（旧包版本）、`incoming`（新包版本）、`custom`（admin 自定义后的版本）
  - 输出：合并结果 + 冲突列表
  - 算法：
    1. 对 base 与 incoming 做 diff，得到 "包的变更"
    2. 对 base 与 custom 做 diff，得到 "admin 的自定义"
    3. 不冲突的变更自动合并
    4. 同一路径被双方修改 → 标记为冲突

- [ ] **合并策略支持**
  - `keep-custom`：所有冲突保留 admin 自定义值
  - `accept-incoming`：所有冲突接受包的新值
  - `three-way-merge`：智能合并 + 冲突检测
  - `MergeStrategyConfig` 路径级规则：
    - `alwaysAcceptIncoming` — 包更新必须被接受的路径（如 `fields.*.type`, `triggers.*`）
    - `alwaysKeepCustom` — admin 自定义必须被保留的路径（如 `fields.*.label`, `fields.*.helpText`）

- [ ] **JSON Deep Merge 实现**
  - 递归对象合并
  - 数组合并策略（replace / append / merge by key）
  - 路径匹配（支持 `*` 通配符 glob 模式）

#### 2. 升级计划生成

- [ ] **实现 `planUpgrade()`**
  - 输入：当前已安装包 manifest + 新版本 manifest
  - diff 计算：比对两个版本的所有元数据项（added, modified, removed, renamed）
  - 对每个 modified 项，检查是否有 platform overlay → 预测冲突
  - 输出：`UpgradePlan`（包含 `MetadataDiffItem[]`, `MergeConflict[]`, impact 分析）
  - 支持 `dryRun` 模式（只生成计划，不执行）

#### 3. Snapshot 系统

- [ ] **Pre-upgrade Snapshot**
  - 创建升级前快照，包含：
    - `previousManifest` — 当前包的完整 manifest
    - `metadataSnapshot` — 所有受影响元数据项的当前定义
    - `customizationSnapshot` — 所有相关 overlay 的备份
  - 存储在 `sys_upgrade_snapshots` 表中
  - 设置过期时间（`expiresAt`），默认 30 天后自动清理

- [ ] **Snapshot 恢复**
  - `rollback(packageId, snapshotId)` — 从 snapshot 完全恢复
  - 恢复 manifest、元数据定义、overlay 自定义
  - 在 history 中记录 rollback 事件

#### 4. 升级执行流水线

- [ ] **完整 6 步流水线**
  ```
  1. PreCheck    → 校验版本兼容性、依赖关系
  2. Plan        → 生成升级计划（metadata diff + 冲突预测）
  3. Snapshot    → 备份当前状态
  4. Execute     → 应用新包元数据 + 三路合并
  5. Validate    → 运行升级后健康检查（schema 校验、引用完整性）
  6. Commit      → 确认升级（或 Rollback 回滚）
  ```

- [ ] **每一步的状态追踪**
  - 使用 `UpgradePhaseSchema`（precheck/plan/snapshot/execute/validate/commit）
  - 支持失败时自动回滚到 Snapshot
  - 进度事件通知（供 UI 显示升级进度）

#### 5. IPackageService 实现

- [ ] **实现 `IPackageService` 合约**（`packages/metadata/src/` 或 `packages/core/src/`）
  ```typescript
  planUpgrade(input: PlanUpgradeInput): Promise<UpgradePlan>;
  upgrade(input: ExecuteUpgradeInput): Promise<UpgradePackageResponse>;
  rollback(input: RollbackInput): Promise<RollbackPackageResponse>;
  getSnapshot(snapshotId: string): Promise<UpgradeSnapshot | null>;
  ```

#### 6. REST API 端点

- [ ] **包升级 API**
  ```
  POST /api/v1/packages/:packageId/upgrade/plan     — 生成升级计划（dry-run）
  POST /api/v1/packages/:packageId/upgrade/execute   — 执行升级
  POST /api/v1/packages/:packageId/upgrade/rollback  — 回滚升级
  GET  /api/v1/packages/:packageId/upgrade/snapshots — 列出快照
  GET  /api/v1/packages/:packageId/upgrade/snapshots/:id — 获取快照详情
  POST /api/v1/packages/:packageId/upgrade/conflicts/resolve — 手动解决冲突
  ```

#### 7. 冲突解决数据模型

- [ ] **冲突 UI 支持数据**
  - 每个冲突返回：`baseValue`, `incomingValue`, `customValue`, `suggestedResolution`
  - 支持批量解决（全部接受 incoming / 全部保留 custom）
  - 支持逐项解决（为每个冲突单独选择策略）
  - 解决后的结果可以预览（preview merged result）

---

### 架构对标

| 平台 | 升级策略 |
|:---|:---|
| **Salesforce** | Managed Package Push Upgrade, subscriber 可锁定特定组件不被升级覆盖 |
| **ServiceNow** | Update Sets Preview → Commit, 支持 skip/accept per item |
| **Helm** | `helm upgrade --install` + `helm rollback`, 基于 Release Revision |
| **Kubernetes** | Strategic Merge Patch，字段级合并策略注解（`patchMergeKey`） |
| **Git** | Three-Way Merge（common ancestor → ours → theirs），冲突标记后手动解决 |

### 关键 Spec 依赖

| Spec 文件 | 提供内容 |
|:---|:---|
| `packages/spec/src/kernel/package-upgrade.zod.ts` | 升级全流程 Schema（Plan, Snapshot, Merge, Conflict, Response） |
| `packages/spec/src/kernel/metadata-customization.zod.ts` | MetadataOverlaySchema（获取 admin 自定义数据） |
| `packages/spec/src/contracts/package-service.ts` | IPackageService 接口（planUpgrade, upgrade, rollback） |
| `packages/spec/src/system/metadata-persistence.zod.ts` | MetadataRecordSchema（version, checksum, publishedDefinition） |
| `packages/metadata/src/metadata-manager.ts` | publishPackage/revertPackage（现有包发布逻辑） |

### 验收标准

- [ ] Three-Way Merge 引擎正确处理：无冲突自动合并、冲突检测、三种合并策略
- [ ] 升级计划准确生成 metadata diff 和冲突预测
- [ ] Snapshot 可创建和恢复，支持完整回滚
- [ ] 6 步流水线完整执行，失败时自动回滚
- [ ] REST API 全套端点可用
- [ ] 冲突数据模型支持 UI 逐项解决
- [ ] 完整的单元测试（合并引擎测试用例覆盖各种边界条件）
- [ ] `packages/metadata/ROADMAP.md` Phase 4b 标记为已完成
- [ ] `IPackageService` 实现通过合约测试

### 关联

- ROADMAP: `packages/metadata/ROADMAP.md` Phase 4b
- 前置: Phase 4a Metadata Versioning & History（需要 history 记录升级/回滚事件）
- 前置: Phase 2 Overlay Persistence（需要 overlay 持久化以读取 admin 自定义）
- 关联: Issue #774 Marketplace Package Lifecycle（包升级是 marketplace 生命周期的一部分）
- Spec: `packages/spec/src/kernel/package-upgrade.zod.ts`（协议已完整定义）

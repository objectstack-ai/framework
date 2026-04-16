# Marketplace 服务实施总结

## 概述

成功实施了基于 cloud 项目 marketplace 的远程插件加载服务，使 `apps/server` 可以在运行时动态安装和卸载插件，无需重新部署。

## 主要改动

### 1. 新增 `@objectstack/service-marketplace` 包

位置：`packages/services/service-marketplace/`

**核心组件：**

- **`RemotePluginLoader`**: 核心加载逻辑
  - 从 cloud marketplace API 获取插件清单
  - 动态 `import()` ESM 模块
  - 内存缓存 + 可选 Turso 持久化
  - 插件安装/卸载管理
  - 自动加载标记为 autoload 的插件

- **`MarketplaceServicePlugin`**: 服务插件包装器
  - 在 kernel init 阶段注册 marketplace 服务
  - 在 kernel start 阶段自动加载插件

**类型定义：**
- `RemotePluginManifest`: 插件元数据（id, name, version, moduleUrl, etc.）
- `MarketplaceConfig`: 服务配置（marketplaceUrl, authToken, caching, etc.）
- `PluginInstallResult` / `PluginUninstallResult`: 操作结果
- `InstalledPluginInfo`: 已安装插件信息

### 2. 增强 `ObjectKernel` 支持运行时卸载

文件：`packages/core/src/kernel.ts`

新增方法：`async unload(pluginName: string)`

**功能：**
1. 调用插件的 `stop()` 钩子
2. 调用插件的 `onDisable()` 钩子
3. 注销插件注册的服务
4. 清理插件钩子
5. 从插件注册表移除
6. 触发 `plugin:unloaded` 事件

### 3. 增强 `PluginLoader`

文件：`packages/core/src/plugin-loader.ts`

新增方法：`unregisterService(name: string)`

清理服务工厂、实例缓存和作用域服务。

### 4. 增强 `AppPlugin` 支持 onDisable 钩子

文件：`packages/runtime/src/app-plugin.ts`

新增方法：`async onDisable(ctx: PluginContext)`

- 调用用户定义的 `runtime.onDisable()` 函数
- 优雅处理错误，不中断卸载流程

### 5. 修改 `apps/server` 配置

**package.json:**
- ❌ 删除：`@example/app-crm`, `@example/app-todo`, `@example/plugin-bi`
- ✅ 新增：`@objectstack/service-marketplace`

**objectstack.config.ts:**
- ❌ 删除：静态 import 示例应用
- ✅ 新增：`MarketplaceServicePlugin` 注册
- ✅ 新增：开发模式下条件加载示例应用的逻辑

## 配置示例

### 环境变量

```bash
# .env
OBJECTSTACK_MARKETPLACE_URL=https://cloud.objectstack.ai
OBJECTSTACK_AUTH_TOKEN=your-auth-token-here
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

### 代码配置

```typescript
new MarketplaceServicePlugin({
  marketplaceUrl: 'https://cloud.objectstack.ai',
  authToken: process.env.OBJECTSTACK_AUTH_TOKEN,
  enableCache: true,
  cacheTTL: 3600,
  persistState: true,
})
```

## 使用流程

### 在 Cloud Marketplace 注册插件

```bash
# 通过 cloud 项目的 API 或管理界面添加插件
POST https://cloud.objectstack.ai/api/marketplace/plugins
{
  "id": "com.example.crm",
  "name": "CRM Application",
  "version": "4.0.4",
  "namespace": "crm",
  "type": "app",
  "moduleUrl": "https://esm.sh/@example/app-crm@4.0.4",
  "autoload": false
}
```

### 运行时安装插件

```typescript
// 通过服务 API
const marketplace = kernel.getService('marketplace');
await marketplace.installPlugin('com.example.crm');
```

### 运行时卸载插件

```typescript
await marketplace.uninstallPlugin('com.example.crm');
```

### 查询已安装插件

```typescript
const installed = await marketplace.getInstalledPlugins();
console.log(installed);
```

## 下一步工作

### Phase 1: 数据库模式（待完成）

在 `sys` 命名空间添加 `plugin_manifest` 对象定义：

```typescript
// packages/spec/src/data/objects/sys-plugin-manifest.object.ts
export const SysPluginManifestObject = defineObject({
  name: 'plugin_manifest',
  namespace: 'sys',
  label: 'Plugin Manifest',
  fields: [
    { name: 'id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'version', type: 'text', required: true },
    { name: 'namespace', type: 'text', required: true },
    { name: 'type', type: 'text', required: true },
    { name: 'module_url', type: 'text', required: true },
    { name: 'integrity', type: 'text' },
    { name: 'enabled', type: 'boolean', defaultValue: false },
    { name: 'autoload', type: 'boolean', defaultValue: false },
    { name: 'description', type: 'text' },
    { name: 'author', type: 'text' },
  ]
});
```

### Phase 2: REST API 端点（可选）

如果需要通过 HTTP API 管理插件，可以在 `HttpDispatcher` 或专门的路由中添加：

- `GET /api/v1/marketplace/plugins` - 列出可用插件
- `POST /api/v1/marketplace/plugins/:id/install` - 安装插件
- `DELETE /api/v1/marketplace/plugins/:id` - 卸载插件
- `GET /api/v1/marketplace/plugins/installed` - 列出已安装插件

### Phase 3: Studio UI 集成

在 `apps/studio` 中添加插件管理页面。

### Phase 4: Cloud 项目集成

确保 cloud 项目的 marketplace API 已实现：

- `GET /api/marketplace/plugins` - 返回所有可用插件
- `GET /api/marketplace/plugins/:id` - 返回指定插件详情

## 优势

✅ **完美适配 Vercel Serverless** - 无需文件系统写入
✅ **部署包最小化** - apps/server 不再包含示例代码
✅ **动态性** - 运行时启用/禁用插件，无需重新部署
✅ **开发体验** - 开发模式下仍可加载本地示例
✅ **与 cloud 项目集成** - 复用现有 marketplace 基础设施
✅ **可扩展** - 支持私有插件（通过 authToken）

## 测试建议

1. **单元测试**: 测试 `RemotePluginLoader` 的加载、缓存、持久化逻辑
2. **集成测试**: 测试完整的安装/卸载流程
3. **E2E 测试**: 测试与 cloud marketplace 的真实集成
4. **性能测试**: 测试动态 import 的加载时间和缓存效果

## 兼容性

- ✅ Node.js 环境（apps/server）
- ✅ Vercel Serverless
- ✅ 本地开发环境
- ⚠️ 需要 ESM 支持（dynamic import）

## 文档更新

需要更新以下文档：

1. `content/docs/guides/` - 添加插件安装指南
2. `packages/services/service-marketplace/README.md` - 已完成
3. `ARCHITECTURE.md` - 更新架构图，包含 marketplace 服务

---

**实施状态**: ✅ Phase 1 完成（核心功能）
**下一步**: 添加 `sys__plugin_manifest` 表定义到 spec

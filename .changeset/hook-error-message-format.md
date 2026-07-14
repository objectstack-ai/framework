---
'@objectstack/rest': patch
'@objectstack/client': patch
---

面向最终用户的错误消息去掉调试噪音:REST 数据路由(`mapDataError`)对沙箱 hook/action 抛错解包 `SandboxError.innerMessage`(并对丢失实例的情况正则剥离 `hook 'x' threw: Error: ` 包装,保留 `TypeError:` 等非默认错误名);客户端 SDK 的 `error.message` 不再拼 `[ObjectStack] CODE:` 前缀(code 仍在 `error.code` 上可编程读取)。控制台报错 toast 从 `[ObjectStack] hook 'pm_ref_base' threw: Error: 制作基地被…` 变为只显示业务消息本身;完整调试包装仍写入服务端日志。

---
'@objectstack/console': patch
---

修复 console 产物打包旧版 @objectstack/client 的问题:`build-console.sh` 现在通过 `OBJECTSTACK_CLIENT_DIST` 把本仓库、本版本的 client 注入 console bundle(此前由 objectui lockfile 决定,11.5.0 因此发布了新导入 UI + client 11.2.0,运行时报 "does not support async import jobs")。构建拆为 deps(turbo)+ console 本体(直跑,避开 turbo strict env 剥离环境变量),并新增产物 canary 断言防止旧 client 再次静默发布。

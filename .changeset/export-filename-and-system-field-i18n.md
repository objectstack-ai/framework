---
'@objectstack/spec': patch
'@objectstack/rest': patch
'@objectstack/plugin-reports': patch
---

导出文件名本地化 + 系统字段标签内置多语言回退。

**`@objectstack/rest` — 导出下载文件名**:`GET /data/:object/export` 的 `Content-Disposition` 不再是裸的 `<对象名>.<扩展名>`,改为「对象显示名-时间戳」:ASCII 兜底用 API 名(`filename="contracts-20260714-153045.xlsx"`),本地化标签(如中文)按 RFC 5987/6266 编码进 `filename*=UTF-8''…`(浏览器直接下载得到 `合同-20260714-153045.xlsx`)。新增导出 `exportContentDisposition(objectName, label, ext, now?)`。

**`@objectstack/spec` — 系统字段标签回退**:ObjectQL 注册表给每个对象注入的系统字段(`owner_id`/`created_at`/`created_by`/`updated_at`/`updated_by`)只带英文标签,自定义对象又没有对应的翻译条目,导致中文界面的列表表头、导出文件、导入模板里漏出 "Owner"/"Created At" 等英文。`translateObject` 现内置这五个字段的 en/zh-CN/ja-JP/es-ES 标签表(措辞与平台生成的翻译包一致),仅当字段仍是注入的英文默认值时套用——作者自定义的标签绝不覆盖;无翻译包时也生效(`translateObject` 不再因缺 bundle 而提前返回,REST 元数据翻译路径同步放宽,缓存 ETag 本就按 locale 分键,无缓存串味风险)。

**`@objectstack/plugin-reports` — 附件文件名**:定时报表附件的文件名清洗从「非 ASCII 全部替换成 `_`」改为按 Unicode 字母/数字保留(`\p{L}\p{N}`),中文计划名不再变成一串下划线。

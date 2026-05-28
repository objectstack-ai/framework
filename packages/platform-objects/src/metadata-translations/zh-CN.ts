// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationData } from '@objectstack/spec/system';

/**
 * Simplified Chinese (zh-CN) — Metadata-Type Form Translations
 *
 * Scope: the `metadataForms.*` namespace for the top-5 form-bearing
 * metadata types (object / field / agent / flow / view). Section keys
 * mirror the `name` set in each `*.form.ts` definition shipped from
 * `@objectstack/spec`.
 *
 * Path convention:
 *   metadataForms.<type>.{label,description}
 *   metadataForms.<type>.sections.<section.name>.{label,description}
 *   metadataForms.<type>.fields.<dot-path>.{label,helpText,placeholder}
 *
 * `dot-path` is dot-notation: top-level fields use the field name
 * directly; composite/repeater children prefix with the parent field
 * (e.g. `capabilities.trackHistory`, `fields.items.label`).
 */
export const zhCN: TranslationData = {
  metadataForms: {
    object: {
      label: '对象',
      description: '业务对象定义',
      sections: {
        basics: { label: '基础信息', description: '标识、显示名与分类标签' },
        fields: { label: '字段', description: '定义数据模型——每行对应数据库表中的一列' },
        capabilities: { label: '功能开关', description: '系统功能与 API 暴露' },
        advanced: { label: '高级设置', description: '状态机、动作与存储' },
      },
      fields: {
        // basics section
        name: { label: '名称', helpText: 'snake_case 唯一标识符（创建后不可修改）', placeholder: '如：account' },
        label: { label: '显示名', helpText: '单数显示名（如："客户"）', placeholder: '如：客户' },
        pluralLabel: { label: '复数显示名', helpText: '复数显示名（如："客户列表"）', placeholder: '如：客户列表' },
        icon: { label: '图标', helpText: 'Lucide 图标名称（如："building"、"users"）' },
        description: { label: '描述', helpText: '开发文档说明' },
        tags: { label: '标签', helpText: '分类标签（如："sales"、"system"）' },
        active: { label: '启用', helpText: '对象是否启用并可用' },
        isSystem: { label: '系统对象', helpText: '系统对象（受保护，不可删除）' },
        abstract: { label: '抽象对象', helpText: '抽象基类（不能直接实例化）' },

        // fields repeater
        fields: { label: '字段', helpText: '添加该对象将存储的列' },
        'fields.name': { label: '字段名', helpText: 'snake_case 标识符', placeholder: 'snake_case' },
        'fields.label': { label: '字段显示名', helpText: '展示用标签' },
        'fields.type': { label: '字段类型', helpText: '字段类型' },
        'fields.required': { label: '必填' },
        'fields.reference': { label: '引用对象', helpText: '目标对象（用于 lookup / master_detail）' },

        // capabilities composite
        capabilities: { label: '功能开关', helpText: '启用或禁用系统功能' },
        'capabilities.trackHistory': { label: '记录变更历史' },
        'capabilities.searchable': { label: '可搜索' },
        'capabilities.apiEnabled': { label: '启用 API' },
        'capabilities.files': { label: '附件' },
        'capabilities.feeds': { label: '动态' },
        'capabilities.activities': { label: '活动' },
        'capabilities.trash': { label: '回收站' },
        'capabilities.mru': { label: '最近浏览' },
        'capabilities.clone': { label: '可克隆' },
        'capabilities.exportable': { label: '可导出' },
        'capabilities.auditable': { label: '可审计' },

        // advanced section
        datasource: { label: '数据源', helpText: '目标数据源 ID（默认："default"）' },
        namespace: { label: '命名空间' },
      },
    },

    field: {
      label: '字段',
      description: '对象字段定义',
      sections: {
        basics: { label: '基础信息', description: '核心标识与约束' },
        configuration: { label: '配置', description: '类型相关设置（不同字段类型显示不同选项）' },
        formula: { label: '公式与计算', description: '计算值与汇总' },
        advanced: { label: '高级设置', description: '数据库、界面、审计与安全' },
      },
      fields: {
        // basics
        name: { label: '名称', helpText: '唯一标识符（snake_case，创建后不可修改）' },
        label: { label: '显示名', helpText: '用户看到的显示名称' },
        type: { label: '字段类型', helpText: '该字段的数据类型' },
        group: { label: '分组', helpText: '表单布局中的分组名称' },
        description: { label: '描述', helpText: '展示给用户的帮助文本' },
        required: { label: '必填', helpText: '用户必须填写' },
        unique: { label: '唯一', helpText: '任意两条记录的值不能相同' },
        multiple: { label: '允许多值', helpText: '允许多个值（用于 select / lookup）' },

        // configuration
        defaultValue: { label: '默认值', helpText: '新建记录时的默认值' },
        minLength: { label: '最小长度', helpText: '最少字符数' },
        maxLength: { label: '最大长度', helpText: '最多字符数' },
        min: { label: '最小值', helpText: '允许的最小数值' },
        max: { label: '最大值', helpText: '允许的最大数值' },
        precision: { label: '精度', helpText: '小数位数（如：货币用 2 表示保留两位）' },
        scale: { label: '小数位', helpText: '小数部分位数' },
        options: { label: '选项', helpText: '可选项（label/value 对）' },
        reference: { label: '引用对象', helpText: '被引用的对象名称' },
        referenceFilters: { label: '引用筛选', helpText: '筛选表达式（如：active = true）' },
        deleteBehavior: { label: '删除行为', helpText: '被引用记录删除时的处理方式' },

        // formula
        expression: { label: '表达式', helpText: '用 CEL 表达式计算此字段的值（自动设为只读）' },
        formula: { label: '公式表达式' },
        summaryOperations: { label: '汇总配置', helpText: '父子关系下的汇总聚合配置' },
        cached: { label: '缓存配置', helpText: '计算字段的缓存配置' },

        // advanced
        columnName: { label: '列名', helpText: '数据库中的物理列名（默认与字段名相同）' },
        index: { label: '索引', helpText: '建立数据库索引以加速查询' },
        externalId: { label: '外部 ID', helpText: '标记为外部 ID 用于 upsert 操作' },
        readonly: { label: '只读', helpText: '在表单中只读' },
        hidden: { label: '隐藏', helpText: '在默认界面视图中隐藏' },
        searchable: { label: '可搜索', helpText: '纳入全局搜索结果' },
        sortable: { label: '可排序', helpText: '允许按此字段排序' },
        auditTrail: { label: '审计轨迹', helpText: '记录详细变更与操作人、时间戳' },
        trackFeedHistory: { label: '动态记录', helpText: '在活动动态中展示变更' },
        encryptionConfig: { label: '加密配置', helpText: '字段级加密（GDPR / HIPAA / PCI-DSS）' },
        maskingRule: { label: '脱敏规则', helpText: 'PII 数据脱敏规则' },

        // summaryOperations composite children
        'summaryOperations.object': { label: '所属对象', helpText: '子对象名称' },
        'summaryOperations.field': { label: '汇总字段', helpText: '要聚合的字段' },
        'summaryOperations.function': { label: '聚合函数', helpText: 'COUNT / SUM / AVG / MIN / MAX' },

        // cached composite children
        'cached.enabled': { label: '启用缓存', helpText: '为计算字段开启缓存' },
        'cached.ttl': { label: '过期时间', helpText: '缓存有效期（秒）' },
        'cached.invalidateOn': { label: '失效依据', helpText: '触发缓存失效的字段变更' },

        // encryptionConfig composite children
        'encryptionConfig.enabled': { label: '启用加密', helpText: '启用字段级加密' },
        'encryptionConfig.algorithm': { label: '加密算法', helpText: '加密算法' },
        'encryptionConfig.keyManagement': { label: '密钥管理', helpText: '密钥管理配置' },
        'encryptionConfig.scope': { label: '加密范围', helpText: '加密范围级别' },
        'encryptionConfig.deterministicEncryption': { label: '确定性加密', helpText: '支持等值匹配' },
        'encryptionConfig.searchableEncryption': { label: '可搜索加密', helpText: '支持搜索的加密方式' },

        // maskingRule composite children
        'maskingRule.field': { label: '目标字段', helpText: '需要脱敏的字段名' },
        'maskingRule.strategy': { label: '脱敏策略', helpText: '使用的脱敏策略' },
        'maskingRule.pattern': { label: '脱敏规则', helpText: '部分脱敏的正则模式' },
        'maskingRule.preserveFormat': { label: '保留格式', helpText: '脱敏后保留原数据格式' },
        'maskingRule.preserveLength': { label: '保留长度', helpText: '脱敏后保留原数据长度' },
        'maskingRule.roles': { label: '受影响角色', helpText: '可见脱敏数据的角色' },
        'maskingRule.exemptRoles': { label: '豁免角色', helpText: '可见原始（未脱敏）数据的角色' },
      },
    },

    agent: {
      label: 'AI 代理',
      description: '智能助手定义',
      sections: {
        identity: { label: '身份信息', description: '用户如何识别与调用该代理' },
        ai_configuration: { label: 'AI 配置', description: '模型选择、指令、规划与记忆' },
        capabilities: { label: '能力配置', description: '代理可使用的技能、工具与知识来源' },
        access: { label: '访问与安全', description: '谁能使用此代理以及防护措施' },
      },
      fields: {
        // identity
        name: { label: '名称', helpText: '唯一标识符（snake_case）' },
        label: { label: '显示名', helpText: '显示名称（如："销售助手"）' },
        role: { label: '角色定位', helpText: '代理人设（如："客户支持专家"）' },
        avatar: { label: '头像', helpText: '头像图片 URL' },
        active: { label: '启用', helpText: '启用或禁用此代理' },

        // ai_configuration
        instructions: { label: '指令', helpText: '系统提示词——告诉代理如何行动与可以做什么' },
        systemPrompt: { label: '系统提示词' },
        model: { label: '模型', helpText: 'AI 模型配置（提供方、模型名、温度等）' },
        planning: { label: '规划', helpText: '自主推理配置（策略、最大迭代、是否重规划）' },
        memory: { label: '记忆', helpText: '记忆管理（短期、长期、反思）' },
        lifecycle: { label: '生命周期', helpText: '定义会话流程的状态机' },
        description: { label: '描述' },

        // capabilities
        skills: { label: '技能', helpText: '技能名称（Agent→Skill→Tool 架构）' },
        tools: { label: '工具', helpText: '直接引用的工具（旧版模式）' },
        knowledge: { label: '知识库', helpText: 'RAG 知识访问配置' },

        // model composite children
        'model.provider': { label: '提供方' },
        'model.model': { label: '模型名称', helpText: '模型名称（如 gpt-4、claude-3-opus）' },
        'model.temperature': { label: '温度' },
        'model.maxTokens': { label: '最大 Token 数' },
        'model.topP': { label: 'Top P' },

        // planning composite children
        'planning.strategy': { label: '策略', helpText: '自主推理策略' },
        'planning.maxIterations': { label: '最大迭代次数', helpText: '规划循环的最大迭代次数' },
        'planning.allowReplan': { label: '允许重规划', helpText: '允许基于中间结果进行动态重新规划' },

        // memory composite children
        'memory.shortTerm': { label: '短期记忆', helpText: '短期 / 工作记忆' },
        'memory.longTerm': { label: '长期记忆', helpText: '长期 / 持久记忆' },
        'memory.reflectionInterval': { label: '反思间隔', helpText: '每 N 次交互反思一次以改进行为' },

        // lifecycle composite children
        'lifecycle.id': { label: '状态机 ID', helpText: '唯一的状态机 ID' },
        'lifecycle.description': { label: '描述' },
        'lifecycle.contextSchema': { label: '上下文 Schema', helpText: '状态机上下文 / 记忆的 Zod Schema' },
        'lifecycle.initial': { label: '初始状态', helpText: '初始状态 ID' },
        'lifecycle.states': { label: '状态列表', helpText: '状态节点' },
        'lifecycle.on': { label: '事件处理' },

        // knowledge composite children
        'knowledge.sources': { label: '知识源' },
        'knowledge.embeddings': { label: '向量化配置' },

        // guardrails composite children
        'guardrails.contentPolicy': { label: '内容策略' },
        'guardrails.piiRedaction': { label: 'PII 脱敏' },

        // access
        visibility: { label: '可见性', helpText: '范围：全局、组织或私有' },
        access: { label: '访问名单', helpText: '可以与此代理对话的用户 ID 或角色名' },
        permissions: { label: '所需权限', helpText: '使用此代理所需的权限' },
        tenantId: { label: '组织 ID', helpText: '限定到特定组织' },
        guardrails: { label: '安全护栏', helpText: '安全规则与内容策略' },
      },
    },

    flow: {
      label: '流程',
      description: '可视化业务流程',
      sections: {
        basics: { label: '基础信息', description: '流程标识与启动方式' },
        canvas: { label: '画布', description: '节点、连线与流程变量——复杂流程建议用可视化设计器' },
        execution: { label: '执行配置', description: '部署状态、身份与异常处理' },
      },
      fields: {
        // basics
        name: { label: '名称', helpText: '唯一标识符（snake_case）' },
        label: { label: '显示名', helpText: '用户看到的显示名称' },
        type: { label: '触发类型', helpText: '流程如何启动（autolaunched / record_change / schedule / screen / api）' },
        template: { label: '子流程模板', helpText: '是否为可复用子流程（可被其他流程调用）' },
        description: { label: '描述', helpText: '此流程做什么' },

        // canvas
        nodes: { label: '节点', helpText: '⚠️ 建议使用流程设计器，而非手写 JSON' },
        edges: { label: '连线', helpText: '节点间的连接——建议用流程设计器编辑' },
        variables: { label: '变量', helpText: '流程变量（输入/输出）' },
        trigger: { label: '触发器' },
        steps: { label: '步骤' },

        // execution
        status: { label: '状态', helpText: '部署状态：draft → active → obsolete' },
        version: { label: '版本号', helpText: '版本号（自动递增）' },
        runAs: { label: '执行身份', helpText: '以系统（管理员）或当前用户权限执行' },
        errorHandling: { label: '错误处理', helpText: '节点失败时的处理方式（fail / retry / continue）' },

        // errorHandling composite children
        'errorHandling.strategy': { label: '策略', helpText: '如何处理节点执行错误' },
        'errorHandling.maxRetries': { label: '最大重试次数', helpText: '重试次数（仅 retry 策略生效）' },
        'errorHandling.retryDelayMs': { label: '重试延迟（毫秒）', helpText: '两次重试之间的延迟（毫秒）' },
        'errorHandling.backoffMultiplier': { label: '退避倍数', helpText: '两次重试之间指数退避的倍数' },
        'errorHandling.maxRetryDelayMs': { label: '最大重试延迟（毫秒）', helpText: '两次重试之间的最大延迟（毫秒）' },
        'errorHandling.jitter': { label: '抖动', helpText: '为重试延迟添加随机抖动，避免雪崩' },
        'errorHandling.fallbackNodeId': { label: '回退节点 ID', helpText: '不可恢复错误时跳转的节点 ID' },
      },
    },

    view: {
      label: '视图',
      description: '数据展示视图',
      sections: {
        basics: { label: '基础信息', description: '标识与主显示形态' },
        columns_filters: { label: '列与筛选', description: '展示哪些行以及用户如何筛选' },
        table_options: { label: '表格选项', description: '仅 Grid 表格的显示选项' },
        kanban: { label: '看板配置', description: '看板专属配置' },
        calendar: { label: '日历配置', description: '日历专属配置' },
        gantt: { label: '甘特图配置', description: '甘特图专属配置' },
        gallery: { label: '画廊配置', description: '画廊专属配置' },
        timeline: { label: '时间线配置', description: '时间线专属配置' },
        chart: { label: '图表配置', description: '图表专属配置' },
        navigation_sharing: { label: '导航与共享', description: '视图出现在哪里以及谁可以查看' },
      },
      fields: {
        // basics
        name: { label: '名称', helpText: 'snake_case，环境内唯一' },
        label: { label: '显示名', helpText: '展示用的标签（纯文本；框架会自动生成 i18n 键）' },
        description: { label: '描述', helpText: '用于文档/提示的视图描述' },
        type: { label: '视图类型', helpText: '主要的视图形态' },
        data: { label: '数据来源', helpText: '数据源——如：{"provider":"object","object":"task"}' },
        object: { label: '所属对象' },

        // columns_filters
        columns: { label: '列', helpText: '要展示的列（来自所选对象的字段名）' },
        filter: { label: '筛选条件', helpText: '筛选规则' },
        filters: { label: '筛选条件' },
        sort: { label: '排序', helpText: '默认排序方式' },
        sortBy: { label: '排序字段' },
        searchableFields: { label: '可搜索字段', helpText: '可用于快速搜索的字段名' },
        filterableFields: { label: '可筛选字段', helpText: '可用于筛选的字段名' },

        // table_options
        resizable: { label: '列宽可调', helpText: '允许用户拖动调整列宽' },
        striped: { label: '斑马纹', helpText: '为奇偶行应用不同背景色' },
        bordered: { label: '显示边框', helpText: '在单元格之间显示边框' },
        compactToolbar: { label: '紧凑工具栏', helpText: '将分组/颜色/密度/隐藏字段合并为单个"视图设置"弹窗' },
        rowHeight: { label: '行高', helpText: '行高 / 密度设置' },
        selection: { label: '选择', helpText: '行选择配置' },
        pagination: { label: '分页', helpText: '分页配置' },

        // surface composites
        kanban: { label: '看板' },
        calendar: { label: '日历' },
        gantt: { label: '甘特图' },
        gallery: { label: '画廊' },
        timeline: { label: '时间线' },
        chart: { label: '图表' },

        // navigation_sharing
        navigation: { label: '导航', helpText: '项目点击跳转配置（页面、抽屉、模态框等）' },
        sharing: { label: '共享' },

        // selection composite children
        'selection.type': { label: '选择模式' },

        // pagination composite children
        'pagination.type': { label: '分页模式' },
        'pagination.pageSize': { label: '每页条数', helpText: '每页显示的记录数' },
        'pagination.pageSizeOptions': { label: '可选每页条数', helpText: '可用的每页条数选项' },

        // navigation composite children
        'navigation.mode': { label: '跳转模式', helpText: '项目点击跳转配置（页面、抽屉、模态框等）' },
        'navigation.view': { label: '关联视图', helpText: '用于详情的表单视图名称（如 "summary_view"、"edit_form"）' },
        'navigation.preventNavigation': { label: '禁止跳转', helpText: '完全禁用标准跳转' },
        'navigation.openNewTab': { label: '在新标签页打开', helpText: '强制在新标签页打开（适用于页面模式）' },

        // sharing
        sharing: { label: '共享', helpText: '视图的共享和访问配置' },

        // sharing composite children
        'sharing.visibility': { label: '可见性' },
        'sharing.roles': { label: '可见角色' },
        'sharing.users': { label: '可见用户' },
      },
    },

    action: {
      label: '操作',
      description: '按钮/菜单项触发的业务动作',
      sections: {
        basics: { label: '基础信息', description: '标识、对象与图标' },
        behavior: { label: '行为', description: '点击后执行的操作' },
        placement: { label: '位置', description: '在界面上的呈现与可见性' },
        advanced: { label: '高级设置', description: '批量与 AI 暴露' },
      },
      fields: {
        name: { label: '名称', helpText: '唯一标识符（snake_case）' },
        label: { label: '显示名', helpText: '展示给用户的按钮文字' },
        objectName: { label: '所属对象', helpText: '所属对象（可选）' },
        icon: { label: '图标', helpText: 'Lucide 图标名（如 "check"、"x-circle"）' },
        type: { label: '操作类型', helpText: '点击后发生什么' },
        variant: { label: '样式', helpText: '按钮样式（primary=蓝色，danger=红色，ghost=透明）' },
        target: { label: '目标', helpText: '调用的 URL、流程名或 API 端点' },
        method: { label: 'HTTP 方法', helpText: 'GET / POST / PUT / DELETE' },
        body: { label: '脚本', helpText: '要执行的 JavaScript 代码' },
        params: { label: '参数', helpText: '执行前向用户收集的输入参数' },
        confirmText: { label: '确认文本', helpText: '执行前的确认提示（如 "确定要执行吗？"）' },
        successMessage: { label: '成功提示', helpText: '执行成功后的提示信息' },
        refreshAfter: { label: '完成后刷新', helpText: '执行完成后刷新当前列表/页面' },
        locations: { label: '展示位置', helpText: '出现在工具栏、行菜单等位置' },
        component: { label: '渲染组件', helpText: '以按钮、图标或菜单项的形式呈现' },
        visible: { label: '可见条件', helpText: 'CEL 表达式：满足条件时显示' },
        disabled: { label: '禁用条件', helpText: 'CEL 表达式：满足条件时禁用' },
        shortcut: { label: '快捷键', helpText: '键盘快捷键（如 "Ctrl+S"、"Cmd+Enter"）' },
        bulkEnabled: { label: '支持批量', helpText: '允许对多条选中记录执行' },
        aiExposed: { label: 'AI 可调用', helpText: '允许 AI 智能体调用此操作' },
        recordIdParam: { label: '记录 ID 参数', helpText: 'API 请求体中记录 ID 的参数名' },
        recordIdField: { label: '记录 ID 字段', helpText: '作为记录 ID 的字段（默认 "id"）' },
        bodyShape: { label: '请求体结构', helpText: '请求体的组织形式（扁平或嵌套）' },
      },
    },

    app: {
      label: '应用',
      description: '面向用户的应用入口与导航',
      sections: {
        basics: { label: '基础信息', description: '标识、版本与图标' },
        navigation: { label: '导航', description: '菜单结构与首页' },
        content: { label: '内容', description: '对象、API 与默认智能体' },
        branding: { label: '品牌', description: '主题色与 Logo' },
        access_and_sharing: { label: '访问与共享', description: '权限、共享与嵌入' },
        access: { label: '访问与共享', description: '权限、共享与嵌入' },
      },
      fields: {
        name: { label: '名称', helpText: 'snake_case 唯一标识符' },
        label: { label: '显示名', helpText: '应用显示名称' },
        description: { label: '描述', helpText: '应用描述' },
        version: { label: '版本', helpText: '应用版本号' },
        icon: { label: '图标', helpText: 'Lucide 图标名（如 users、briefcase）' },
        active: { label: '启用', helpText: '应用是否启用' },
        isDefault: { label: '默认应用', helpText: '设为新用户的默认应用' },
        navigation: { label: '导航树', helpText: '递归的导航结构' },
        areas: { label: '分组', helpText: '将菜单项组织为可折叠分组' },
        homePageId: { label: '首页', helpText: '应用打开时跳转的页面' },
        mobileNavigation: { label: '移动端导航', helpText: '移动端底部 Tab 栏配置' },
        'mobileNavigation.mode': { label: '导航模式', helpText: '移动端导航模式：抽屉边栏、底部导航栏或汉堡菜单' },
        'mobileNavigation.bottomNavItems': { label: '底部导航项', helpText: '底部导航中展示的项 ID（最多 5 个）' },
        objects: { label: '对象', helpText: '此应用暴露的对象名' },
        apis: { label: 'API', helpText: 'API 端点定义' },
        defaultAgent: { label: '默认智能体', helpText: '右下角浮动助手按钮调用的 AI 智能体' },
        branding: { label: '品牌设置', helpText: '主色、辅色、Logo 与主题' },
        'branding.primaryColor': { label: '主色', helpText: '主题主色（十六进制色值）' },
        'branding.logo': { label: 'Logo', helpText: '此应用的自定义 Logo URL' },
        'branding.favicon': { label: 'Favicon', helpText: '此应用的自定义 Favicon URL' },
        requiredPermissions: { label: '所需权限', helpText: '访问该应用需要的权限' },
        sharing: { label: '共享设置', helpText: '公开 / 内部 / 受限的访问控制' },
        'sharing.enabled': { label: '启用共享', helpText: '允许公开共享' },
        'sharing.publicLink': { label: '公开链接', helpText: '自动生成的公开共享 URL' },
        'sharing.password': { label: '访问密码', helpText: '访问共享链接所需的密码' },
        'sharing.allowedDomains': { label: '允许的域名', helpText: '限制访问到指定邮箱域名（如 ["example.com"]）' },
        'sharing.expiresAt': { label: '过期时间', helpText: '过期时间（ISO 8601 格式）' },
        'sharing.allowAnonymous': { label: '允许匿名访问', helpText: '允许未登录用户访问' },
        embed: { label: '嵌入设置', helpText: 'iFrame 嵌入配置' },
        'embed.enabled': { label: '启用嵌入', helpText: '启用 iframe 嵌入' },
        'embed.allowedOrigins': { label: '允许的来源', helpText: '允许嵌入的父级来源（如 ["https://example.com"]）' },
        'embed.width': { label: '宽度', helpText: '嵌入宽度（CSS 值）' },
        'embed.height': { label: '高度', helpText: '嵌入高度（CSS 值）' },
        'embed.showHeader': { label: '显示头部', helpText: '在嵌入中显示界面头部' },
        'embed.showNavigation': { label: '显示导航', helpText: '在嵌入中显示导航' },
        'embed.responsive': { label: '响应式布局', helpText: '启用响应式自适应' },
        aria: { label: '无障碍', helpText: '无障碍标签与角色' },
        'aria.ariaLabel': { label: 'ARIA 标签', helpText: '屏幕阅读器可访问的标签（WAI-ARIA aria-label）' },
        'aria.ariaDescribedBy': { label: 'ARIA 描述关联' },
        'aria.role': { label: 'ARIA 角色' },
      },
    },

    page: {
      label: '页面',
      description: '应用中的单个页面',
      sections: {
        basics: { label: '基础信息', description: '名称、标题与图标' },
        data_context: { label: '数据上下文', description: '关联对象与变量' },
        layout: { label: '布局', description: '页面区块与组件' },
        advanced: { label: '高级设置', description: '默认页、类型与分配' },
      },
      fields: {
        name: { label: '名称', helpText: 'snake_case 唯一标识符' },
        label: { label: '显示名', helpText: '展示给用户的页面标题' },
        icon: { label: '图标', helpText: '导航菜单中显示的图标' },
        type: { label: '页面类型', helpText: '页面类型（record、home、app、dashboard 等）' },
        template: { label: '布局模板', helpText: '布局模板（如 "header-sidebar-main"）' },
        description: { label: '描述', helpText: '用于导航的页面描述' },
        object: { label: '关联对象', helpText: '绑定的对象（用于记录页）' },
        variables: { label: '页面变量', helpText: '页面本地状态变量' },
        regions: { label: '布局区域', helpText: '布局区域（header、main、sidebar、footer）及其组件' },
        isDefault: { label: '默认页', helpText: '设为该页面类型的默认页' },
        kind: { label: '种类', helpText: '页面种类分组（如 record / list / detail）' },
        assignedProfiles: { label: '分配的配置文件', helpText: '此页面对哪些 Profile 可用' },
        aria: { label: '无障碍', helpText: '无障碍标签与角色' },
        'aria.ariaLabel': { label: 'ARIA 标签', helpText: '屏幕阅读器可访问的标签（WAI-ARIA aria-label）' },
        'aria.ariaDescribedBy': { label: 'ARIA 描述关联' },
        'aria.role': { label: 'ARIA 角色' },
      },
    },

    dashboard: {
      label: '仪表板',
      description: '多组件的数据看板',
      sections: {
        basics: { label: '基础信息', description: '名称与图标' },
        layout: { label: '布局', description: '栅格与响应式' },
        widgets: { label: '组件', description: '图表、指标、列表等' },
        filters: { label: '筛选', description: '全局筛选与日期范围' },
        advanced: { label: '高级设置', description: '性能与无障碍' },
      },
      fields: {
        name: { label: '名称' },
        label: { label: '显示名', helpText: '显示名' },
        description: { label: '描述', helpText: '仪表板描述' },
        icon: { label: '图标' },
        layout: { label: '布局' },
        columns: { label: '栅格列数', helpText: '栅格列数（默认 12）' },
        rowHeight: { label: '行高' },
        gap: { label: '间距', helpText: '栅格间距（Tailwind 单位）' },
        responsive: { label: '响应式' },
        widgets: { label: '组件列表', helpText: '包含位置和尺寸的仪表板组件' },
        header: { label: '头部', helpText: '标题、操作按钮与筛选' },
        'header.title': { label: '标题' },
        'header.subtitle': { label: '副标题' },
        'header.actions': { label: '头部操作按钮', helpText: '头部操作按钮' },
        filters: { label: '筛选条件' },
        globalFilters: { label: '全局筛选', helpText: '应用到所有组件的筛选条件' },
        dateRange: { label: '日期范围', helpText: '默认日期范围选择器' },
        'dateRange.enabled': { label: '启用日期范围' },
        'dateRange.field': { label: '日期字段', helpText: '基于时间的筛选所用的默认日期字段名' },
        'dateRange.default': { label: '默认范围' },
        'dateRange.presets': { label: '快捷预设' },
        refreshInterval: { label: '自动刷新间隔（秒）', helpText: '自动刷新间隔（秒）' },
        permissions: { label: '所需权限' },
        visible: { label: '可见条件' },
        performance: { label: '性能', helpText: '懒加载、虚拟滚动、缓存等' },
        'performance.lazyLoad': { label: '懒加载', helpText: '启用懒加载（在可见之前延迟渲染）' },
        'performance.virtualScroll': { label: '虚拟滚动', helpText: '虚拟滚动配置' },
        'performance.cacheStrategy': { label: '缓存策略', helpText: '客户端数据缓存策略' },
        'performance.prefetch': { label: '预取数据', helpText: '在组件可见之前预取数据' },
        'performance.pageSize': { label: '每页数量', helpText: '分页时每页的条目数量' },
        'performance.debounceMs': { label: '防抖（毫秒）', helpText: '用户交互的防抖间隔（毫秒）' },
        aria: { label: '无障碍', helpText: '无障碍标签' },
        'aria.ariaLabel': { label: 'ARIA 标签', helpText: '屏幕阅读器可访问的标签（WAI-ARIA aria-label）' },
        'aria.ariaDescribedBy': { label: 'ARIA 描述关联' },
        'aria.role': { label: 'ARIA 角色' },
      },
    },

    report: {
      label: '报表',
      description: '数据查询与可视化',
      sections: {
        basics: { label: '基础信息', description: '名称与数据源' },
        columns: { label: '列', description: '选择要展示的列' },
        groupings: { label: '分组与汇总', description: '行列分组维度' },
        joined_blocks: { label: '关联对象', description: '跨对象联合查询' },
        filter_and_chart: { label: '筛选与图表', description: '条件与图表展示' },
        advanced: { label: '高级设置', description: '性能与无障碍' },
      },
      fields: {
        name: { label: '名称', helpText: 'snake_case 唯一标识符' },
        label: { label: '显示名', helpText: '展示标签（纯字符串；i18n key 由框架自动生成）' },
        description: { label: '描述', helpText: '报表用途说明' },
        objectName: { label: '主数据对象', helpText: '报表数据源对象' },
        type: { label: '报表类型', helpText: '报表类型：tabular / summary / matrix / joined' },
        columns: { label: '列', helpText: '报表中显示的列' },
        groupingsDown: { label: '行分组', helpText: '行方向分组层级' },
        groupingsAcross: { label: '列分组', helpText: '列方向分组层级（matrix 报表）' },
        blocks: { label: '联合块', helpText: 'joined 报表的联合查询块' },
        filter: { label: '筛选条件', helpText: '报表级别的筛选规则' },
        chart: { label: '图表', helpText: '图表类型与配置' },
        'chart.type': { label: '图表类型' },
        'chart.xField': { label: 'X 轴字段' },
        'chart.yField': { label: 'Y 轴字段' },
        'chart.series': { label: '系列', helpText: '已定义的系列配置' },
        'chart.colors': { label: '颜色', helpText: '调色板' },
        'chart.stacked': { label: '堆叠' },
        'chart.showLegend': { label: '显示图例', helpText: '显示图例' },
        'chart.showTooltip': { label: '显示悬浮提示' },
        performance: { label: '性能', helpText: '性能与缓存策略' },
        'performance.lazyLoad': { label: '懒加载', helpText: '启用懒加载（在可见之前延迟渲染）' },
        'performance.virtualScroll': { label: '虚拟滚动', helpText: '虚拟滚动配置' },
        'performance.cacheStrategy': { label: '缓存策略', helpText: '客户端数据缓存策略' },
        'performance.prefetch': { label: '预取数据', helpText: '在组件可见之前预取数据' },
        'performance.pageSize': { label: '每页数量', helpText: '分页时每页的条目数量' },
        'performance.debounceMs': { label: '防抖（毫秒）', helpText: '用户交互的防抖间隔（毫秒）' },
        aria: { label: '无障碍', helpText: '无障碍标签与角色' },
        'aria.ariaLabel': { label: 'ARIA 标签', helpText: '屏幕阅读器可见的标签（WAI-ARIA aria-label）' },
        'aria.ariaDescribedBy': { label: 'ARIA 描述关联' },
        'aria.role': { label: 'ARIA 角色' },
      },
    },

    workflow: {
      label: '工作流',
      description: '自动化规则与触发器',
      sections: {
        basics: { label: '基础信息', description: '名称与触发条件' },
        actions: { label: '执行动作', description: '满足条件后做什么' },
        advanced: { label: '高级设置', description: '执行顺序与错误处理' },
      },
      fields: {
        name: { label: '名称', helpText: '唯一标识符（snake_case）' },
        label: { label: '显示名' },
        description: { label: '描述', helpText: '此工作流的用途说明' },
        objectName: { label: '所属对象', helpText: '触发此工作流的对象' },
        triggerType: { label: '触发类型', helpText: '何时触发：on_create、on_update、on_delete、schedule' },
        active: { label: '启用', helpText: '启用或禁用此工作流' },
        criteria: { label: '触发条件', helpText: 'CEL 表达式：仅当条件为真时执行' },
        actions: { label: '动作列表', helpText: '立即执行的动作（字段更新、邮件、API 调用等）' },
        timeTriggers: { label: '定时触发', helpText: '定时动作（如截止前 1 天发提醒）' },
        executionOrder: { label: '执行顺序', helpText: '同时匹配多个工作流时的执行顺序（数字越小越先执行）' },
      },
    },

    approval: {
      label: '审批流',
      description: '多级审批与升级',
      sections: {
        basics: { label: '基础信息', description: '名称与目标对象' },
        entry_rules: { label: '进入规则', description: '何时进入审批' },
        steps: { label: '审批步骤', description: '逐级审批配置' },
        escalation_and_outcomes: { label: '升级与结果', description: '超时升级与最终处理' },
      },
      fields: {
        name: { label: '名称', helpText: '唯一标识符（snake_case）' },
        label: { label: '显示名', helpText: '显示名（如："合同审批"）' },
        description: { label: '描述', helpText: '审批的对象与原因' },
        objectName: { label: '所属对象', helpText: '需要审批的对象' },
        entryCondition: { label: '进入条件', helpText: 'CEL 表达式：满足时进入审批流' },
        autoSubmit: { label: '自动提交' },
        steps: { label: '审批步骤', helpText: '按顺序排列的审批步骤——每一步定义由谁审批以及结果' },
        defaultApprovers: { label: '默认审批人' },
        statusField: { label: '审批状态字段', helpText: '用于镜像审批状态的字段名（如 "approval_status"）' },
        lockRecord: { label: '锁定记录', helpText: '审批待处理期间锁定记录，禁止编辑' },
        escalation: { label: '升级策略', helpText: '超时未审批的处理方式' },
        'escalation.enabled': { label: '启用升级', helpText: '启用基于 SLA 的升级' },
        'escalation.timeoutHours': { label: '超时时长（小时）', helpText: '升级触发前的等待小时数' },
        'escalation.escalateTo': { label: '升级给', helpText: '升级到的用户 ID、角色或管理层级' },
        'escalation.notifyOnEscalation': { label: '升级时通知' },
        onApprove: { label: '通过后动作', helpText: '所有步骤通过后的动作（如更新状态）' },
        onReject: { label: '拒绝后动作', helpText: '被拒绝后的动作（如通知提交人）' },
        onTimeout: { label: '超时后动作' },
        active: { label: '启用', helpText: '启用或禁用此审批流' },
      },
    },

    role: {
      label: '角色',
      description: '权限分组与继承',
      sections: {
        role: { label: '角色定义', description: '角色名称与继承关系' },
      },
      fields: {
        name: { label: '名称', helpText: 'snake_case 唯一标识符' },
        label: { label: '显示名', helpText: '显示名（如："销售副总裁"）' },
        parent: { label: '父角色', helpText: '继承父角色的权限' },
        description: { label: '描述' },
      },
    },

    skill: {
      label: '技能',
      description: 'AI 智能体可调用的能力',
      sections: {
        basics: { label: '基础信息', description: '名称与描述' },
        ai_instructions: { label: 'AI 指令', description: 'AI 何时与如何使用该技能' },
        triggers: { label: '触发条件', description: '触发关键词与上下文' },
        access: { label: '访问', description: '哪些智能体可使用' },
      },
      fields: {
        name: { label: '名称', helpText: '唯一标识符（snake_case）' },
        label: { label: '显示名', helpText: '显示名（如："案件管理"）' },
        description: { label: '描述', helpText: 'AI 用来判断是否调用的简短说明' },
        active: { label: '启用', helpText: '启用或禁用此技能' },
        instructions: { label: '使用说明', helpText: 'AI 调用此技能时遵循的详细指令' },
        tools: { label: '工具', helpText: '工具名（支持通配符：action_*）' },
        triggerPhrases: { label: '触发短语', helpText: '激活此技能的自然语言短语' },
        triggerConditions: { label: '触发条件', helpText: '程序化条件（如 objectName == "case"）' },
        permissions: { label: '所需权限', helpText: '使用此技能所需的权限' },
      },
    },

    tool: {
      label: '工具',
      description: 'AI 智能体可调用的函数 / API',
      sections: {
        basics: { label: '基础信息', description: '工具身份与面向 AI 的说明' },
        schemas: { label: '参数 / 返回结构', description: '工具接收的输入与输出形态' },
        access_and_safety: { label: '访问与安全', description: '权限与确认要求' },
      },
      fields: {
        name: { label: '名称', helpText: '唯一标识符（snake_case）' },
        label: { label: '显示名', helpText: 'Studio 中展示的名称' },
        description: { label: '描述', helpText: '告诉 AI 何时使用此工具——请尽量具体！' },
        category: { label: '分类', helpText: '工具类别（data、action、flow、integration 等）' },
        objectName: { label: '所属对象', helpText: '相关对象（若工具针对特定对象）' },
        active: { label: '启用', helpText: '启用或禁用此工具' },
        builtIn: { label: '平台内置', helpText: '平台内置工具（区别于用户自定义）' },
        parameters: { label: '参数', helpText: '输入参数——定义形如：{name: {type: "string", description: "..."}}' },
        outputSchema: { label: '返回值定义', helpText: '用于校验的输出结构（可选）' },
        requiresConfirmation: { label: '需要确认', helpText: '在执行前请求用户确认（用于破坏性操作）' },
        permissions: { label: '所需权限', helpText: '使用此工具所需的权限' },
      },
    },
    hook: {
      label: '钩子',
      description: '对象生命周期回调',
      sections: {
        identity: { label: '基础信息', description: '名称、对象与触发事件' },
        body: { label: '处理体', description: '触发时执行的内联表达式或沙箱 JavaScript' },
        legacy_handler: { label: '旧版处理器', description: '函数名引用——已废弃，请改用 body' },
        execution: { label: '执行', description: '异步、错误与执行条件' },
      },
      fields: {
        name: { label: '名称', helpText: 'snake_case 标识符（创建后不可修改）' },
        label: { label: '显示名', helpText: '钩子用途的人工可读说明' },
        description: { label: '描述', helpText: '此钩子用途的扩展说明' },
        object: { label: '所属对象', helpText: '目标对象名（或 "*" 表示全局）' },
        events: { label: '触发事件', helpText: '生命周期事件（如 beforeInsert、afterUpdate）' },
        priority: { label: '优先级', helpText: '数字越小越先执行' },
        body: { label: '处理体', helpText: 'L1 表达式或 L2 沙箱 JS 体' },
        'body.language': { label: '语言', helpText: 'expression = 纯公式；js = 沙箱 JavaScript' },
        'body.source': { label: '源码', helpText: '函数体源码——禁止顶层 import' },
        'body.capabilities': { label: '允许能力', helpText: '可用的 ctx API（api.read、api.write、crypto.uuid、log 等）' },
        'body.timeoutMs': { label: '超时（毫秒）', helpText: '单次调用超时时间（毫秒）' },
        handler: { label: '处理器名', helpText: '处理器函数名（已废弃——建议使用 body）' },
        async: { label: '异步执行', helpText: '后台运行，不阻塞当前事务' },
        onError: { label: '错误策略', helpText: '错误处理策略' },
        condition: { label: '执行条件', helpText: '可选公式——求值为 false 时跳过该钩子' },
      },
    },
    permission: {
      label: '权限集 / 配置文件',
      description: '系统、对象、字段与行级访问控制',
      sections: {
        identity: { label: '身份', description: '权限集或配置文件标识' },
        'system_permissions': { label: '系统权限', description: '应用、API、管理与设置访问' },
        'object_and_field_permissions': { label: '对象与字段权限', description: '增删改查与字段可见性' },
        'tab_and_row_level_security': { label: '标签页与行级安全', description: '导航可见性与共享规则' },
      },
      fields: {
        name: { label: '名称', helpText: '唯一标识符（snake_case）' },
        label: { label: '显示名', helpText: '面向管理员的显示标签' },
        isProfile: { label: '配置文件', helpText: '勾选后作为完整配置文件（而非附加权限集）' },
        systemPermissions: { label: '系统权限', helpText: '应用访问、API、管理操作' },
        objects: { label: '对象权限', helpText: '按对象配置增删改查' },
        fields: { label: '字段权限', helpText: '按字段配置可读 / 可写' },
        tabPermissions: { label: '标签页权限', helpText: '导航中标签页的可见性' },
        rowLevelSecurity: { label: '行级安全', helpText: '基于记录条件的访问规则' },
        contextVariables: { label: '上下文变量', helpText: '可在规则中引用的变量' },
      },
    },
    email_template: {
      label: '邮件模板',
      description: '可重用的邮件正文与变量定义',
      sections: {
        identity: { label: '基础信息', description: '模板 ID 与正文类型' },
        html: { label: 'HTML', description: 'HTML 富文本正文' },
        'plain_text': { label: '纯文本', description: '纯文本正文' },
        markdown: { label: 'Markdown', description: 'Markdown 正文' },
        subject: { label: '主题', description: '邮件主题模板' },
        body: { label: '正文', description: '邮件正文内容' },
        'variables_and_attachments': { label: '变量与附件', description: '可注入的变量与附件列表' },
      },
      fields: {
        id: { label: '模板 ID', helpText: '唯一标识符（snake_case）' },
        bodyType: { label: '正文类型', helpText: 'html / text / markdown' },
        subject: { label: '主题', helpText: '支持变量插值，如 {{record.name}}' },
        body: { label: '正文', helpText: '支持变量插值的邮件正文' },
        variables: { label: '变量', helpText: '模板内可引用的变量与默认值' },
        attachments: { label: '附件', helpText: '附件列表（文件引用或 URL）' },
      },
    },
  },
};

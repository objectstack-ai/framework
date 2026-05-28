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
        'model.model': { label: '模型名称' },
        'model.temperature': { label: '温度' },
        'model.maxTokens': { label: '最大 Token 数' },
        'model.topP': { label: 'Top P' },

        // planning composite children
        'planning.strategy': { label: '策略' },
        'planning.maxIterations': { label: '最大迭代次数' },
        'planning.allowReplan': { label: '允许重规划' },

        // memory composite children
        'memory.shortTerm': { label: '短期记忆' },
        'memory.longTerm': { label: '长期记忆' },
        'memory.reflectionInterval': { label: '反思间隔' },

        // lifecycle composite children
        'lifecycle.id': { label: '状态机 ID' },
        'lifecycle.description': { label: '描述' },
        'lifecycle.contextSchema': { label: '上下文 Schema' },
        'lifecycle.initial': { label: '初始状态' },
        'lifecycle.states': { label: '状态列表' },
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
        'errorHandling.strategy': { label: '策略' },
        'errorHandling.maxRetries': { label: '最大重试次数' },
        'errorHandling.retryDelayMs': { label: '重试延迟（毫秒）' },
        'errorHandling.backoffMultiplier': { label: '退避倍数' },
        'errorHandling.maxRetryDelayMs': { label: '最大重试延迟（毫秒）' },
        'errorHandling.jitter': { label: '抖动' },
        'errorHandling.fallbackNodeId': { label: '回退节点 ID' },
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
        label: { label: '显示名' },
        description: { label: '描述' },
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
        resizable: { label: '列宽可调' },
        striped: { label: '斑马纹' },
        bordered: { label: '显示边框' },
        compactToolbar: { label: '紧凑工具栏' },
        rowHeight: { label: '行高' },
        selection: { label: '选择' },
        pagination: { label: '分页' },

        // surface composites
        kanban: { label: '看板' },
        calendar: { label: '日历' },
        gantt: { label: '甘特图' },
        gallery: { label: '画廊' },
        timeline: { label: '时间线' },
        chart: { label: '图表' },

        // navigation_sharing
        navigation: { label: '导航' },
        sharing: { label: '共享' },

        // selection composite children
        'selection.type': { label: '选择模式' },

        // pagination composite children
        'pagination.type': { label: '分页模式' },
        'pagination.pageSize': { label: '每页条数' },
        'pagination.pageSizeOptions': { label: '可选每页条数' },

        // navigation composite children
        'navigation.mode': { label: '跳转模式' },
        'navigation.view': { label: '关联视图' },
        'navigation.preventNavigation': { label: '禁止跳转' },
        'navigation.openNewTab': { label: '在新标签页打开' },

        // sharing composite children
        'sharing.visibility': { label: '可见性' },
        'sharing.roles': { label: '可见角色' },
        'sharing.users': { label: '可见用户' },
      },
    },
  },
};

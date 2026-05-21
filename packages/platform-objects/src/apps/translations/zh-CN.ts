// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationData } from '@objectstack/spec/system';

/**
 * 简体中文 (zh-CN) — Setup App Translations
 */
export const zhCN: TranslationData = {
  apps: {
    setup: {
      label: '系统设置',
      description: '平台设置与管理',
      navigation: {
        group_overview: { label: '总览' },
        group_people_org: { label: '人员与组织' },
        group_access_control: { label: '访问控制' },
        group_approvals: { label: '审批' },
        group_configuration: { label: '配置' },
        group_diagnostics: { label: '诊断' },
        group_advanced: { label: '高级' },

        nav_system_overview: { label: '系统概览' },
        nav_security_overview: { label: '安全概览' },

        nav_users: { label: '用户' },
        nav_departments: { label: '部门' },
        nav_teams: { label: '团队' },
        nav_organizations: { label: '组织' },
        nav_invitations: { label: '邀请' },

        nav_roles: { label: '角色' },
        nav_permission_sets: { label: '权限集' },
        nav_sharing_rules: { label: '共享规则' },
        nav_record_shares: { label: '记录共享' },
        nav_api_keys: { label: 'API 密钥' },

        nav_approval_processes: { label: '审批流程' },
        nav_approval_requests: { label: '审批申请' },
        nav_approval_actions: { label: '审批历史' },

        nav_settings_hub: { label: '全部设置' },
        nav_settings_mail: { label: '邮件' },
        nav_settings_branding: { label: '品牌' },
        nav_settings_feature_flags: { label: '功能开关' },

        nav_sessions: { label: '会话' },
        nav_audit_logs: { label: '审计日志' },
        nav_notifications: { label: '通知' },

        nav_oauth_apps: { label: 'OAuth 应用' },
        nav_jwks: { label: '签名密钥 (JWKS)' },
        nav_verifications: { label: '验证记录' },
        nav_two_factor: { label: '双重认证' },
        nav_device_codes: { label: '设备代码' },
        nav_accounts: { label: '身份链接' },
        nav_user_preferences: { label: '用户偏好' },
        nav_metadata: { label: '全部元数据' },
      },
    },
  },

  dashboards: {
    system_overview: {
      label: '系统概览',
      description: '平台运行状况、会话与审计活动',
      widgets: {
        widget_active_sessions: { title: '活跃会话', description: '当前活跃用户会话数量' },
        widget_total_users: { title: '用户总数', description: '系统中已注册的用户总数' },
        widget_organizations: { title: '组织数', description: '平台上的组织总数' },
        widget_packages_installed: { title: '已安装包', description: '项目中已激活的安装包数' },
        widget_audit_actions: { title: '审计操作', description: '按操作类型分布的审计事件' },
        widget_active_orgs: { title: '按组织划分会话', description: '按组织分组的活跃会话' },
        widget_recent_events: { title: '最近审计事件', description: '最新的平台事件' },
      },
    },

    security_overview: {
      label: '安全概览',
      description: '安全事件、身份认证与审计追踪',
      widgets: {
        widget_login_events: { title: '登录事件', description: '审计日志中记录的认证事件' },
        widget_permission_changes: { title: '权限变更', description: '最近的权限和角色修改' },
        widget_config_changes: { title: '配置变更', description: '系统配置修改' },
        widget_active_sessions: { title: '活跃会话', description: '当前活跃用户会话' },
        widget_events_by_type: { title: '按类型分布的审计事件', description: '安全与审计事件分布' },
        widget_events_by_user: { title: '按用户分布的事件', description: '用户活动分布' },
        widget_recent_security_events: { title: '最近安全事件', description: '最新的权限与配置变更' },
      },
    },
  },
};

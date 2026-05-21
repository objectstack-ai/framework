// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationData } from '@objectstack/spec/system';

/**
 * 日本語 (ja-JP) — Setup App Translations
 */
export const jaJP: TranslationData = {
  apps: {
    setup: {
      label: 'セットアップ',
      description: 'プラットフォーム設定と管理',
      navigation: {
        group_overview: { label: '概要' },
        group_people_org: { label: 'ユーザーと組織' },
        group_access_control: { label: 'アクセス制御' },
        group_approvals: { label: '承認' },
        group_configuration: { label: '構成' },
        group_diagnostics: { label: '診断' },
        group_advanced: { label: '詳細' },

        nav_system_overview: { label: 'システム概要' },
        nav_security_overview: { label: 'セキュリティ概要' },

        nav_users: { label: 'ユーザー' },
        nav_departments: { label: '部署' },
        nav_teams: { label: 'チーム' },
        nav_organizations: { label: '組織' },
        nav_invitations: { label: '招待' },

        nav_roles: { label: 'ロール' },
        nav_permission_sets: { label: '権限セット' },
        nav_sharing_rules: { label: '共有ルール' },
        nav_record_shares: { label: 'レコード共有' },
        nav_api_keys: { label: 'API キー' },

        nav_approval_processes: { label: 'プロセス' },
        nav_approval_requests: { label: 'リクエスト' },
        nav_approval_actions: { label: 'アクション履歴' },

        nav_settings_hub: { label: 'すべての設定' },
        nav_settings_mail: { label: 'メール' },
        nav_settings_branding: { label: 'ブランディング' },
        nav_settings_feature_flags: { label: '機能フラグ' },

        nav_sessions: { label: 'セッション' },
        nav_audit_logs: { label: '監査ログ' },
        nav_notifications: { label: '通知' },

        nav_oauth_apps: { label: 'OAuth アプリケーション' },
        nav_jwks: { label: '署名キー (JWKS)' },
        nav_verifications: { label: '検証' },
        nav_two_factor: { label: '二要素認証' },
        nav_device_codes: { label: 'デバイスコード' },
        nav_accounts: { label: 'ID 連携' },
        nav_user_preferences: { label: 'ユーザー設定' },
        nav_metadata: { label: 'すべてのメタデータ' },
      },
    },
  },

  dashboards: {
    system_overview: {
      label: 'システム概要',
      description: 'プラットフォームの健全性、セッション、監査アクティビティ',
      widgets: {
        widget_active_sessions: { title: 'アクティブセッション', description: '現在アクティブなユーザーセッション数' },
        widget_total_users: { title: 'ユーザー総数', description: 'システムに登録されたユーザーの総数' },
        widget_organizations: { title: '組織', description: 'プラットフォーム上の組織総数' },
        widget_packages_installed: { title: 'インストール済みパッケージ', description: 'プロジェクトでアクティブなパッケージインストール数' },
        widget_audit_actions: { title: '監査アクション', description: 'アクションタイプ別の監査イベント分布' },
        widget_active_orgs: { title: '組織別セッション', description: '組織別にグループ化されたアクティブセッション' },
        widget_recent_events: { title: '最近の監査イベント', description: '最新のプラットフォームイベント' },
      },
    },

    security_overview: {
      label: 'セキュリティ概要',
      description: 'セキュリティイベント、認証、監査証跡',
      widgets: {
        widget_login_events: { title: 'ログインイベント', description: '監査ログに記録された認証イベント' },
        widget_permission_changes: { title: '権限変更', description: '最近の権限とロールの変更' },
        widget_config_changes: { title: '構成変更', description: 'システム構成の変更' },
        widget_active_sessions: { title: 'アクティブセッション', description: '現在アクティブなユーザーセッション' },
        widget_events_by_type: { title: 'タイプ別監査イベント', description: 'セキュリティと監査イベントの分布' },
        widget_events_by_user: { title: 'ユーザー別イベント', description: 'ユーザー別アクティビティ分布' },
        widget_recent_security_events: { title: '最近のセキュリティイベント', description: '最新の権限と構成の変更' },
      },
    },
  },
};

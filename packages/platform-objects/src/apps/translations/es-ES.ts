// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationData } from '@objectstack/spec/system';

/**
 * Español (es-ES) — Setup App Translations
 */
export const esES: TranslationData = {
  apps: {
    setup: {
      label: 'Configuración',
      description: 'Configuración y administración de la plataforma',
      navigation: {
        group_overview: { label: 'Resumen' },
        group_people_org: { label: 'Personas y Organización' },
        group_access_control: { label: 'Control de Acceso' },
        group_approvals: { label: 'Aprobaciones' },
        group_configuration: { label: 'Configuración' },
        group_diagnostics: { label: 'Diagnóstico' },
        group_advanced: { label: 'Avanzado' },

        nav_system_overview: { label: 'Resumen del Sistema' },
        nav_security_overview: { label: 'Resumen de Seguridad' },

        nav_users: { label: 'Usuarios' },
        nav_departments: { label: 'Departamentos' },
        nav_teams: { label: 'Equipos' },
        nav_organizations: { label: 'Organizaciones' },
        nav_invitations: { label: 'Invitaciones' },

        nav_roles: { label: 'Roles' },
        nav_permission_sets: { label: 'Conjuntos de Permisos' },
        nav_sharing_rules: { label: 'Reglas de Compartición' },
        nav_record_shares: { label: 'Registros Compartidos' },
        nav_api_keys: { label: 'Claves API' },

        nav_approval_processes: { label: 'Procesos' },
        nav_approval_requests: { label: 'Solicitudes' },
        nav_approval_actions: { label: 'Historial de Acciones' },

        nav_settings_hub: { label: 'Todos los Ajustes' },
        nav_settings_mail: { label: 'Correo' },
        nav_settings_branding: { label: 'Marca' },
        nav_settings_feature_flags: { label: 'Indicadores de Funcionalidad' },

        nav_sessions: { label: 'Sesiones' },
        nav_audit_logs: { label: 'Registros de Auditoría' },
        nav_notifications: { label: 'Notificaciones' },

        nav_oauth_apps: { label: 'Aplicaciones OAuth' },
        nav_jwks: { label: 'Claves de Firma (JWKS)' },
        nav_verifications: { label: 'Verificaciones' },
        nav_two_factor: { label: 'Doble Factor' },
        nav_device_codes: { label: 'Códigos de Dispositivo' },
        nav_accounts: { label: 'Enlaces de Identidad' },
        nav_user_preferences: { label: 'Preferencias de Usuario' },
        nav_metadata: { label: 'Todos los Metadatos' },
      },
    },
  },

  dashboards: {
    system_overview: {
      label: 'Resumen del Sistema',
      description: 'Estado de la plataforma, sesiones y actividad de auditoría',
      widgets: {
        widget_active_sessions: { title: 'Sesiones Activas', description: 'Número de sesiones de usuario activas en este momento' },
        widget_total_users: { title: 'Usuarios Totales', description: 'Total de usuarios registrados en el sistema' },
        widget_organizations: { title: 'Organizaciones', description: 'Total de organizaciones en la plataforma' },
        widget_packages_installed: { title: 'Paquetes Instalados', description: 'Instalaciones de paquetes activas en los proyectos' },
        widget_audit_actions: { title: 'Acciones de Auditoría', description: 'Distribución de eventos de auditoría por tipo de acción' },
        widget_active_orgs: { title: 'Sesiones por Organización', description: 'Sesiones activas agrupadas por organización' },
        widget_recent_events: { title: 'Eventos de Auditoría Recientes', description: 'Últimos eventos de la plataforma' },
      },
    },

    security_overview: {
      label: 'Resumen de Seguridad',
      description: 'Eventos de seguridad, autenticación y registros de auditoría',
      widgets: {
        widget_login_events: { title: 'Eventos de Inicio de Sesión', description: 'Eventos de autenticación registrados por el log de auditoría' },
        widget_permission_changes: { title: 'Cambios de Permisos', description: 'Modificaciones recientes de permisos y roles' },
        widget_config_changes: { title: 'Cambios de Configuración', description: 'Modificaciones de configuración del sistema' },
        widget_active_sessions: { title: 'Sesiones Activas', description: 'Sesiones de usuario actualmente activas' },
        widget_events_by_type: { title: 'Eventos de Auditoría por Tipo', description: 'Distribución de eventos de seguridad y auditoría' },
        widget_events_by_user: { title: 'Eventos por Usuario', description: 'Distribución de actividad entre usuarios' },
        widget_recent_security_events: { title: 'Eventos de Seguridad Recientes', description: 'Últimos cambios de permisos y configuración' },
      },
    },
  },
};

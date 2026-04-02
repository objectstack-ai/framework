// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { NavigationArea } from '@objectstack/spec/ui';

/**
 * Well-known Setup Area IDs.
 *
 * Every internal or third-party plugin that wants to contribute settings
 * navigation uses one of these area IDs (or defines a custom one).
 */
export const SETUP_AREA_IDS = {
  administration: 'area_administration',
  platform: 'area_platform',
  system: 'area_system',
  ai: 'area_ai',
} as const;

export type SetupAreaId = (typeof SETUP_AREA_IDS)[keyof typeof SETUP_AREA_IDS];

/**
 * Built-in Setup Areas — empty skeletons.
 *
 * These are the four default areas that ship with the platform.
 * Other plugins contribute navigation items into these areas
 * via the `setupNav` service convention during kernel init.
 *
 * At finalization time, empty areas (no contributed navigation items)
 * are automatically filtered out so the Setup App only shows
 * areas that actually have content.
 */
export const SETUP_AREAS: readonly NavigationArea[] = [
  {
    id: SETUP_AREA_IDS.administration,
    label: 'Administration',
    icon: 'shield',
    order: 10,
    description: 'User management, roles, permissions, and security settings',
    navigation: [],
  },
  {
    id: SETUP_AREA_IDS.platform,
    label: 'Platform',
    icon: 'layers',
    order: 20,
    description: 'Objects, fields, layouts, automation, and extensibility settings',
    navigation: [],
  },
  {
    id: SETUP_AREA_IDS.system,
    label: 'System',
    icon: 'settings',
    order: 30,
    description: 'Datasources, integrations, jobs, logs, and environment configuration',
    navigation: [],
  },
  {
    id: SETUP_AREA_IDS.ai,
    label: 'AI',
    icon: 'brain',
    order: 40,
    description: 'AI agents, model registry, RAG pipelines, and intelligence settings',
    navigation: [],
  },
] as const;

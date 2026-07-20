// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Activity summary verb templates (framework#3039).
 *
 * Keys are single-segment on purpose: both i18n implementations (the core
 * memory fallback and service-i18n's FileI18nAdapter) resolve dot-notation
 * keys by walking NESTED objects, so a flat record key containing a dot
 * (`'activity.created'`) would never resolve — `messages.activityCreated`
 * does. Interpolation uses the shared `{{param}}` convention.
 */

import type { TranslationData } from '@objectstack/spec/system';

type Messages = NonNullable<TranslationData['messages']>;

export const enMessages: Messages = {
  activityCreated: 'Created {{object}} "{{label}}"',
  activityUpdated: 'Updated {{object}} "{{label}}"',
  activityDeleted: 'Deleted {{object}} "{{label}}"',
  assignedToYou: '{{object}} "{{label}}" assigned to you',
  mentionedYou: '{{actor}} mentioned you',
  mentionedYouAnonymous: 'You were mentioned',
};

export const zhCNMessages: Messages = {
  activityCreated: '创建了 {{object}} "{{label}}"',
  activityUpdated: '更新了 {{object}} "{{label}}"',
  activityDeleted: '删除了 {{object}} "{{label}}"',
  assignedToYou: '{{object}} "{{label}}" 已分配给你',
  mentionedYou: '{{actor}} 提到了你',
  mentionedYouAnonymous: '有人提到了你',
};

export const jaJPMessages: Messages = {
  activityCreated: '{{object}}「{{label}}」を作成しました',
  activityUpdated: '{{object}}「{{label}}」を更新しました',
  activityDeleted: '{{object}}「{{label}}」を削除しました',
  assignedToYou: '{{object}}「{{label}}」があなたに割り当てられました',
  mentionedYou: '{{actor}}さんがあなたをメンションしました',
  mentionedYouAnonymous: 'あなたがメンションされました',
};

export const esESMessages: Messages = {
  activityCreated: 'Creó {{object}} "{{label}}"',
  activityUpdated: 'Actualizó {{object}} "{{label}}"',
  activityDeleted: 'Eliminó {{object}} "{{label}}"',
  assignedToYou: 'Se te asignó {{object}} "{{label}}"',
  mentionedYou: '{{actor}} te mencionó',
  mentionedYouAnonymous: 'Te han mencionado',
};

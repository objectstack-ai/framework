// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_agent Object Definition
 *
 * Represents AI agent metadata as queryable data.
 */
export const SysAgent = ObjectSchema.create({
  name: 'sys_agent',
  namespace: 'sys',
  label: 'AI Agent',
  pluralLabel: 'AI Agents',
  description: 'AI agent definitions',
  icon: 'bot',

  fields: {
    // Core Identity
    name: Field.text({
      label: 'Agent Name',
      required: true,
      maxLength: 255,
    }),

    label: Field.text({
      label: 'Display Label',
      required: true,
      maxLength: 255,
    }),

    description: Field.textarea({
      label: 'Description',
    }),

    // Agent Type
    agent_type: Field.select({
      label: 'Agent Type',
      options: [
        { value: 'conversational', label: 'Conversational' },
        { value: 'task', label: 'Task-Based' },
        { value: 'analytical', label: 'Analytical' },
        { value: 'workflow', label: 'Workflow' },
      ],
    }),

    // Model Configuration
    model: Field.text({
      label: 'Model ID',
      maxLength: 255,
      description: 'AI model identifier',
    }),

    temperature: Field.number({
      label: 'Temperature',
      min: 0,
      max: 2,
      defaultValue: 0.7,
    }),

    max_tokens: Field.number({
      label: 'Max Tokens',
      min: 1,
      max: 100000,
    }),

    top_p: Field.number({
      label: 'Top P',
      min: 0,
      max: 1,
    }),

    // System Prompt
    system_prompt: Field.textarea({
      label: 'System Prompt',
      description: 'Instructions for the AI agent',
    }),

    // Tools Configuration
    tools_json: Field.textarea({
      label: 'Tools (JSON)',
      description: 'Available tools as JSON array',
    }),

    // Skills Configuration
    skills_json: Field.textarea({
      label: 'Skills (JSON)',
      description: 'Available skills as JSON array',
    }),

    // Memory Configuration
    memory_enabled: Field.boolean({
      label: 'Memory Enabled',
      defaultValue: false,
    }),

    memory_window: Field.number({
      label: 'Memory Window',
      description: 'Number of conversation turns to remember',
      defaultValue: 10,
    }),

    // Classification
    namespace: Field.text({
      label: 'Namespace',
      maxLength: 100,
    }),

    // Package Management
    package_id: Field.text({
      label: 'Package ID',
      maxLength: 255,
    }),

    managed_by: Field.select({
      label: 'Managed By',
      options: [
        { value: 'package', label: 'Package' },
        { value: 'platform', label: 'Platform' },
        { value: 'user', label: 'User' },
      ],
    }),

    // Audit
    created_by: Field.text({ label: 'Created By', maxLength: 255 }),
    created_at: Field.datetime({ label: 'Created At' }),
    updated_by: Field.text({ label: 'Updated By', maxLength: 255 }),
    updated_at: Field.datetime({ label: 'Updated At' }),
  },

  indexes: [
    { fields: ['name'], unique: true },
    { fields: ['agent_type'] },
    { fields: ['namespace'] },
    { fields: ['package_id'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    trash: true,
    mru: true,
  },
});

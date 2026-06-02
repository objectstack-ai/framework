// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  SolutionBlueprintSchema,
  defineSolutionBlueprint,
  type SolutionBlueprint,
} from './solution-blueprint.zod';

const validBlueprint: SolutionBlueprint = {
  summary: 'A simple project tracker',
  assumptions: ['Projects own many tasks', 'Tasks have a status'],
  objects: [
    {
      name: 'project',
      label: 'Project',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'due_date', type: 'date' },
      ],
    },
    {
      name: 'task',
      label: 'Task',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'status', type: 'select', options: [{ label: 'Open', value: 'open' }, { label: 'Done', value: 'done' }] },
        { name: 'project_id', type: 'lookup', reference: 'project' },
      ],
    },
  ],
  views: [
    { object: 'task', name: 'open_tasks', label: 'Open Tasks', type: 'list', columns: ['title', 'status'] },
  ],
};

describe('SolutionBlueprintSchema', () => {
  it('parses a valid blueprint', () => {
    const parsed = SolutionBlueprintSchema.parse(validBlueprint);
    expect(parsed.objects).toHaveLength(2);
    expect(parsed.objects[1].fields[2]).toMatchObject({ type: 'lookup', reference: 'project' });
    expect(parsed.views?.[0].type).toBe('list');
  });

  it('defaults assumptions to an empty array and view type to list', () => {
    const parsed = SolutionBlueprintSchema.parse({
      summary: 'minimal',
      objects: [{ name: 'thing', fields: [{ name: 'name', type: 'text' }] }],
      views: [{ object: 'thing', name: 'all_things', columns: ['name'] }],
    });
    expect(parsed.assumptions).toEqual([]);
    expect(parsed.views?.[0].type).toBe('list');
  });

  it('rejects a missing summary', () => {
    const { summary: _drop, ...noSummary } = validBlueprint;
    expect(() => SolutionBlueprintSchema.parse(noSummary)).toThrow();
  });

  it('rejects an invalid field type', () => {
    expect(() =>
      SolutionBlueprintSchema.parse({
        summary: 'bad',
        objects: [{ name: 'x', fields: [{ name: 'f', type: 'not_a_real_type' }] }],
      }),
    ).toThrow();
  });

  it('rejects a non-snake_case object name', () => {
    expect(() =>
      SolutionBlueprintSchema.parse({
        summary: 'bad',
        objects: [{ name: 'MyObject', fields: [{ name: 'f', type: 'text' }] }],
      }),
    ).toThrow();
  });

  it('rejects more than 2 clarifying questions', () => {
    expect(() =>
      SolutionBlueprintSchema.parse({
        summary: 'too many questions',
        objects: [{ name: 'x', fields: [{ name: 'f', type: 'text' }] }],
        questions: ['a?', 'b?', 'c?'],
      }),
    ).toThrow();
  });

  it('defineSolutionBlueprint validates and returns the parsed value', () => {
    const bp = defineSolutionBlueprint(validBlueprint);
    expect(bp.summary).toBe('A simple project tracker');
  });

  it('accepts an optional app with explicit nav', () => {
    const parsed = SolutionBlueprintSchema.parse({
      ...validBlueprint,
      app: {
        name: 'project_mgmt',
        label: 'Project Management',
        icon: 'kanban',
        nav: [
          { type: 'object', target: 'project', label: 'Projects' },
          { type: 'object', target: 'task' },
          { type: 'dashboard', target: 'overview' },
        ],
      },
    });
    expect(parsed.app?.name).toBe('project_mgmt');
    expect(parsed.app?.nav).toHaveLength(3);
    expect(parsed.app?.nav?.[1].type).toBe('object'); // default applied
  });

  it('allows an app with no nav (auto-surfaced at apply time)', () => {
    const parsed = SolutionBlueprintSchema.parse({
      ...validBlueprint,
      app: { name: 'pm', label: 'PM' },
    });
    expect(parsed.app?.nav).toBeUndefined();
  });

  it('app is optional', () => {
    expect(SolutionBlueprintSchema.parse(validBlueprint).app).toBeUndefined();
  });

  it('rejects a non-snake_case app name', () => {
    expect(() =>
      SolutionBlueprintSchema.parse({ ...validBlueprint, app: { name: 'MyApp' } }),
    ).toThrow();
  });

  it('rejects an invalid nav item type', () => {
    expect(() =>
      SolutionBlueprintSchema.parse({
        ...validBlueprint,
        app: { name: 'pm', nav: [{ type: 'flow', target: 'project' }] },
      }),
    ).toThrow();
  });
});

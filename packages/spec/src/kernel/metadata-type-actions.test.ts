import { describe, it, expect } from 'vitest';
import {
  registerMetadataTypeActions,
  getMetadataTypeActions,
} from './metadata-type-schemas';
import { DEFAULT_METADATA_TYPE_REGISTRY } from './metadata-plugin.zod';
import type { Action } from '../ui/action.zod';

const action = (name: string, overrides: Partial<Action> = {}): Action =>
  ({
    name,
    label: name,
    type: 'api',
    refreshAfter: false,
    ...overrides,
  }) as Action;

describe('Metadata type-level actions', () => {
  describe('declarative actions on the registry entry', () => {
    it('ships a Test-connection action on the datasource entry', () => {
      const ds = DEFAULT_METADATA_TYPE_REGISTRY.find((e) => e.type === 'datasource');
      expect(ds?.actions).toBeDefined();
      const test = ds!.actions!.find((a) => a.name === 'test_connection');
      expect(test).toMatchObject({
        type: 'api',
        method: 'POST',
        target: '/api/v1/datasources/${ctx.recordId}/test',
      });
    });

    it('surfaces declarative actions through getMetadataTypeActions', () => {
      const actions = getMetadataTypeActions('datasource');
      expect(actions.map((a) => a.name)).toContain('test_connection');
    });

    it('returns [] for a type with no actions', () => {
      expect(getMetadataTypeActions('object')).toEqual([]);
    });
  });

  describe('registerMetadataTypeActions (runtime registry)', () => {
    it('registers actions for a custom type', () => {
      registerMetadataTypeActions('my_custom_type', [action('do_thing')]);
      expect(getMetadataTypeActions('my_custom_type').map((a) => a.name)).toEqual(['do_thing']);
    });

    it('merges plugin actions on top of declarative ones, declarative first', () => {
      registerMetadataTypeActions('datasource', [action('rotate_secret')]);
      const names = getMetadataTypeActions('datasource').map((a) => a.name);
      expect(names).toContain('test_connection');
      expect(names).toContain('rotate_secret');
      expect(names.indexOf('test_connection')).toBeLessThan(names.indexOf('rotate_secret'));
    });

    it('dedupes by name — a later registration overrides the earlier', () => {
      registerMetadataTypeActions('dedupe_type', [action('a', { label: 'first' })]);
      registerMetadataTypeActions('dedupe_type', [action('a', { label: 'second' })]);
      const actions = getMetadataTypeActions('dedupe_type');
      expect(actions).toHaveLength(1);
      expect(actions[0].label).toBe('second');
    });
  });
});

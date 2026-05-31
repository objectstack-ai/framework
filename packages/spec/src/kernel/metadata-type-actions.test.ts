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
    // The open-source framework intentionally ships NO declarative type-level
    // actions. The datasource "Test connection" button used to live here, but
    // it was relocated to the datasource-admin backend plugin (which owns the
    // route it calls) so the framework never advertises a button it can't serve.
    it('ships no declarative action on the datasource entry', () => {
      const ds = DEFAULT_METADATA_TYPE_REGISTRY.find((e) => e.type === 'datasource');
      expect(ds?.actions ?? []).toEqual([]);
    });

    it('returns [] for datasource until a plugin registers an action', () => {
      expect(getMetadataTypeActions('datasource')).toEqual([]);
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

    it('surfaces a plugin-registered action on a built-in type (datasource)', () => {
      // Mirrors what the datasource-admin plugin does at install time.
      registerMetadataTypeActions('datasource', [
        action('test_connection', {
          method: 'POST',
          target: '/api/v1/datasources/${ctx.recordId}/test',
        }),
      ]);
      const test = getMetadataTypeActions('datasource').find((a) => a.name === 'test_connection');
      expect(test).toMatchObject({
        type: 'api',
        method: 'POST',
        target: '/api/v1/datasources/${ctx.recordId}/test',
      });
    });

    it('appends later registrations after earlier ones', () => {
      registerMetadataTypeActions('merge_order_type', [action('first_action')]);
      registerMetadataTypeActions('merge_order_type', [action('second_action')]);
      const names = getMetadataTypeActions('merge_order_type').map((a) => a.name);
      expect(names).toContain('first_action');
      expect(names).toContain('second_action');
      expect(names.indexOf('first_action')).toBeLessThan(names.indexOf('second_action'));
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

import { describe, it, expect } from 'vitest';
import {
  TestContextSchema,
  TestActionTypeSchema,
  TestActionSchema,
  TestAssertionTypeSchema,
  TestAssertionSchema,
  TestStepSchema,
  TestScenarioSchema,
  TestSuiteSchema,
} from './testing.zod';

describe('TestContextSchema', () => {
  it('should accept a valid context record', () => {
    expect(() => TestContextSchema.parse({ userId: '123', debug: true })).not.toThrow();
  });

  it('should accept an empty record', () => {
    expect(() => TestContextSchema.parse({})).not.toThrow();
  });

  it('should reject non-object values', () => {
    expect(() => TestContextSchema.parse('invalid')).toThrow();
  });
});

describe('TestActionTypeSchema', () => {
  it('should accept all valid action types', () => {
    const types = ['create_record', 'update_record', 'delete_record', 'read_record', 'query_records', 'api_call', 'run_script', 'wait'];
    types.forEach(t => {
      expect(() => TestActionTypeSchema.parse(t)).not.toThrow();
    });
  });

  it('should reject invalid action type', () => {
    expect(() => TestActionTypeSchema.parse('invalid_type')).toThrow();
  });
});

describe('TestActionSchema', () => {
  it('should accept minimal valid action', () => {
    const action = { type: 'create_record', target: 'account' };
    const result = TestActionSchema.parse(action);
    expect(result.type).toBe('create_record');
    expect(result.target).toBe('account');
    expect(result.payload).toBeUndefined();
    expect(result.user).toBeUndefined();
  });

  it('should accept full action with all optional fields', () => {
    const action = {
      type: 'api_call',
      target: '/api/v1/accounts',
      payload: { name: 'Test Account' },
      user: 'admin',
    };
    expect(() => TestActionSchema.parse(action)).not.toThrow();
  });

  it('should reject action without target', () => {
    expect(() => TestActionSchema.parse({ type: 'create_record' })).toThrow();
  });

  it('should reject action with invalid type', () => {
    expect(() => TestActionSchema.parse({ type: 'bad_type', target: 'x' })).toThrow();
  });
});

describe('TestAssertionTypeSchema', () => {
  it('should accept all valid assertion types', () => {
    const types = ['equals', 'not_equals', 'contains', 'not_contains', 'is_null', 'not_null', 'gt', 'gte', 'lt', 'lte', 'error'];
    types.forEach(t => {
      expect(() => TestAssertionTypeSchema.parse(t)).not.toThrow();
    });
  });

  it('should reject invalid assertion type', () => {
    expect(() => TestAssertionTypeSchema.parse('unknown')).toThrow();
  });
});

describe('TestAssertionSchema', () => {
  it('should accept a valid assertion', () => {
    const assertion = { field: 'body.status', operator: 'equals', expectedValue: 'active' };
    const result = TestAssertionSchema.parse(assertion);
    expect(result.field).toBe('body.status');
    expect(result.operator).toBe('equals');
    expect(result.expectedValue).toBe('active');
  });

  it('should reject assertion without field', () => {
    expect(() => TestAssertionSchema.parse({ operator: 'equals', expectedValue: 1 })).toThrow();
  });

  it('should reject assertion with invalid operator', () => {
    expect(() => TestAssertionSchema.parse({ field: 'x', operator: 'invalid', expectedValue: 1 })).toThrow();
  });
});

describe('TestStepSchema', () => {
  const minimalStep = {
    name: 'Create account',
    action: { type: 'create_record', target: 'account' },
  };

  it('should accept minimal step', () => {
    const result = TestStepSchema.parse(minimalStep);
    expect(result.name).toBe('Create account');
    expect(result.description).toBeUndefined();
    expect(result.assertions).toBeUndefined();
    expect(result.capture).toBeUndefined();
  });

  it('should accept step with all optional fields', () => {
    const step = {
      ...minimalStep,
      description: 'Creates a new account record',
      assertions: [{ field: 'body.id', operator: 'not_null', expectedValue: null }],
      capture: { newId: 'body.id' },
    };
    expect(() => TestStepSchema.parse(step)).not.toThrow();
  });

  it('should reject step without name', () => {
    expect(() => TestStepSchema.parse({ action: { type: 'read_record', target: 'x' } })).toThrow();
  });

  it('should reject step without action', () => {
    expect(() => TestStepSchema.parse({ name: 'step1' })).toThrow();
  });
});

describe('TestScenarioSchema', () => {
  const minimalScenario = {
    id: 'sc-001',
    name: 'Account CRUD Test',
    steps: [{ name: 'step1', action: { type: 'create_record', target: 'account' } }],
  };

  it('should accept minimal scenario', () => {
    const result = TestScenarioSchema.parse(minimalScenario);
    expect(result.id).toBe('sc-001');
    expect(result.name).toBe('Account CRUD Test');
    expect(result.steps).toHaveLength(1);
    expect(result.description).toBeUndefined();
    expect(result.tags).toBeUndefined();
    expect(result.setup).toBeUndefined();
    expect(result.teardown).toBeUndefined();
    expect(result.requires).toBeUndefined();
  });

  it('should accept full scenario with all optional fields', () => {
    const scenario = {
      ...minimalScenario,
      description: 'Tests full CRUD lifecycle',
      tags: ['critical', 'regression'],
      setup: [{ name: 'setup-data', action: { type: 'run_script', target: 'seed' } }],
      teardown: [{ name: 'cleanup', action: { type: 'delete_record', target: 'account' } }],
      requires: {
        params: ['API_KEY'],
        plugins: ['crm'],
      },
    };
    expect(() => TestScenarioSchema.parse(scenario)).not.toThrow();
  });

  it('should reject scenario without steps', () => {
    expect(() => TestScenarioSchema.parse({ id: 'sc-001', name: 'Test' })).toThrow();
  });

  it('should reject scenario without id', () => {
    expect(() => TestScenarioSchema.parse({ name: 'Test', steps: [] })).toThrow();
  });
});

describe('TestSuiteSchema', () => {
  it('should accept a valid test suite', () => {
    const suite = {
      name: 'CRM Test Suite',
      scenarios: [{
        id: 'sc-001',
        name: 'Account Test',
        steps: [{ name: 'step1', action: { type: 'read_record', target: 'account' } }],
      }],
    };
    const result = TestSuiteSchema.parse(suite);
    expect(result.name).toBe('CRM Test Suite');
    expect(result.scenarios).toHaveLength(1);
  });

  it('should accept suite with empty scenarios', () => {
    expect(() => TestSuiteSchema.parse({ name: 'Empty Suite', scenarios: [] })).not.toThrow();
  });

  it('should reject suite without name', () => {
    expect(() => TestSuiteSchema.parse({ scenarios: [] })).toThrow();
  });

  it('should reject suite without scenarios', () => {
    expect(() => TestSuiteSchema.parse({ name: 'Suite' })).toThrow();
  });
});

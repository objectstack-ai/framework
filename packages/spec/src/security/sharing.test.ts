import { describe, it, expect } from 'vitest';
import {
  SharingRuleSchema,
  SharingRuleType,
  SharingLevel,
  OWDModel,
  type SharingRule,
} from './sharing.zod';

describe('SharingRuleType', () => {
  it('should accept valid sharing rule types', () => {
    const validTypes = ['owner', 'criteria'];

    validTypes.forEach(type => {
      expect(() => SharingRuleType.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid sharing rule types', () => {
    expect(() => SharingRuleType.parse('automatic')).toThrow();
    expect(() => SharingRuleType.parse('manual')).toThrow();
    expect(() => SharingRuleType.parse('guest')).toThrow();
    expect(() => SharingRuleType.parse('public')).toThrow();
    expect(() => SharingRuleType.parse('')).toThrow();
  });
});

describe('SharingLevel', () => {
  it('should accept valid sharing levels', () => {
    const validLevels = ['read', 'edit', 'full'];

    validLevels.forEach(level => {
      expect(() => SharingLevel.parse(level)).not.toThrow();
    });
  });

  it('should reject invalid sharing levels', () => {
    expect(() => SharingLevel.parse('write')).toThrow();
    expect(() => SharingLevel.parse('delete')).toThrow();
  });
});

describe('OWDModel', () => {
  it('should accept valid OWD models', () => {
    const validModels = ['private', 'public_read', 'public_read_write'];

    validModels.forEach(model => {
      expect(() => OWDModel.parse(model)).not.toThrow();
    });
  });

  it('should reject invalid OWD models', () => {
    expect(() => OWDModel.parse('public')).toThrow();
    expect(() => OWDModel.parse('public_write')).toThrow();
    expect(() => OWDModel.parse('')).toThrow();
  });
});

describe('SharingRuleSchema', () => {
  it('should accept valid minimal sharing rule', () => {
    const rule: SharingRule = {
      name: 'sales_team_access',
      object: 'opportunity',
      type: 'criteria',
      condition: "stage = 'Open'",
      sharedWith: {
        type: 'group',
        value: 'group_sales_team',
      },
    };

    expect(() => SharingRuleSchema.parse(rule)).not.toThrow();
  });

  it('should validate rule name format (snake_case)', () => {
    expect(() => SharingRuleSchema.parse({
      name: 'valid_rule_name',
      object: 'account',
      type: 'criteria',
      condition: "status = 'Active'",
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    })).not.toThrow();

    expect(() => SharingRuleSchema.parse({
      name: 'InvalidRule',
      object: 'account',
      type: 'criteria',
      condition: "status = 'Active'",
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    })).toThrow();

    expect(() => SharingRuleSchema.parse({
      name: 'invalid-rule',
      object: 'account',
      type: 'criteria',
      condition: "status = 'Active'",
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    })).toThrow();
  });

  it('should apply default values', () => {
    const rule = SharingRuleSchema.parse({
      name: 'test_rule',
      object: 'account',
      type: 'criteria',
      condition: "status = 'Active'",
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    });

    expect(rule.active).toBe(true);
    expect(rule.type).toBe('criteria');
    expect(rule.accessLevel).toBe('read');
  });

  it('should accept sharing rule with all fields', () => {
    const rule = SharingRuleSchema.parse({
      name: 'full_sharing_rule',
      label: 'Full Sharing Rule',
      active: true,
      object: 'opportunity',
      type: 'criteria',
      condition: "stage = 'Closed Won' AND amount > 100000",
      accessLevel: 'edit',
      sharedWith: {
        type: 'group',
        value: 'group_executive_team',
      },
    });

    expect(rule.label).toBe('Full Sharing Rule');
    expect((rule.condition as any).source).toContain('Closed Won');
  });

  it('should accept different sharing rule types', () => {
    // Criteria-based rule
    const criteriaRule = SharingRuleSchema.parse({
      name: 'test_criteria_rule',
      object: 'account',
      type: 'criteria',
      condition: "status = 'Active'",
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    });
    expect(criteriaRule.type).toBe('criteria');

    // Owner-based rule
    const ownerRule = SharingRuleSchema.parse({
      name: 'test_owner_rule',
      object: 'account',
      type: 'owner',
      ownedBy: {
        type: 'position',
        value: 'role_sales_rep',
      },
      sharedWith: {
        type: 'position',
        value: 'role_sales_manager',
      },
    });
    expect(ownerRule.type).toBe('owner');
  });

  it('should accept different access levels', () => {
    const levels: Array<SharingRule['accessLevel']> = ['read', 'edit', 'full'];

    levels.forEach(level => {
      const rule = SharingRuleSchema.parse({
        name: 'test_rule',
        object: 'account',
        type: 'criteria',
        condition: "status = 'Active'",
        accessLevel: level,
        sharedWith: {
          type: 'group',
          value: 'group_id',
        },
      });
      expect(rule.accessLevel).toBe(level);
    });
  });

  it('should accept owner-based sharing rule', () => {
    const rule = SharingRuleSchema.parse({
      name: 'owner_hierarchy_rule',
      object: 'account',
      type: 'owner',
      ownedBy: {
        type: 'position',
        value: 'role_sales_rep',
      },
      accessLevel: 'read',
      sharedWith: {
        type: 'position',
        value: 'role_sales_manager',
      },
    });

    expect(rule.type).toBe('owner');
  });

  it('should accept criteria-based sharing rule', () => {
    const rule = SharingRuleSchema.parse({
      name: 'high_value_accounts',
      object: 'account',
      type: 'criteria',
      condition: "annual_revenue > 1000000 AND status = 'Active'",
      accessLevel: 'read',
      sharedWith: {
        type: 'group',
        value: 'group_executive_team',
      },
    });

    expect(rule.type).toBe('criteria');
    expect(rule.condition).toBeDefined();
  });

  it('should accept criteria sharing rule for manual approval workflows', () => {
    const rule = SharingRuleSchema.parse({
      name: 'manual_approval_share',
      object: 'opportunity',
      type: 'criteria',
      condition: "requires_approval = true",
      accessLevel: 'edit',
      sharedWith: {
        type: 'user',
        value: 'user_john_doe',
      },
    });

    expect(rule.type).toBe('criteria');
  });

  it('should accept guest sharing rule', () => {
    const rule = SharingRuleSchema.parse({
      name: 'public_access',
      object: 'knowledge_article',
      type: 'criteria',
      condition: "is_published = true",
      accessLevel: 'read',
      sharedWith: {
        type: 'guest',
        value: 'guest_users',
      },
    });

    expect(rule.type).toBe('criteria');
  });

  it('should accept inactive sharing rule', () => {
    const rule = SharingRuleSchema.parse({
      name: 'disabled_rule',
      object: 'account',
      type: 'criteria',
      condition: "status = 'Inactive'",
      active: false,
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    });

    expect(rule.active).toBe(false);
  });

  it('should handle sales territory sharing', () => {
    const rule = SharingRuleSchema.parse({
      name: 'west_coast_territory',
      label: 'West Coast Territory Access',
      object: 'account',
      type: 'criteria',
      condition: "billing_state IN ('CA', 'OR', 'WA')",
      accessLevel: 'edit',
      sharedWith: {
        type: 'group',
        value: 'group_west_coast_sales',
      },
    });

    expect((rule.condition as any).source).toContain('CA');
  });

  it('should handle department-based sharing', () => {
    const rule = SharingRuleSchema.parse({
      name: 'finance_department_access',
      object: 'invoice',
      type: 'criteria',
      condition: "department = 'Finance'",
      accessLevel: 'edit',
      sharedWith: {
        type: 'group',
        value: 'group_finance_team',
      },
    });

    expect(rule.object).toBe('invoice');
  });

  it('should handle read-only sharing', () => {
    const rule = SharingRuleSchema.parse({
      name: 'readonly_access',
      object: 'contract',
      type: 'criteria',
      condition: "status = 'Executed'",
      accessLevel: 'read',
      sharedWith: {
        type: 'group',
        value: 'group_all_users',
      },
    });

    expect(rule.accessLevel).toBe('read');
  });

  it('should handle edit access sharing', () => {
    const rule = SharingRuleSchema.parse({
      name: 'edit_access',
      object: 'opportunity',
      type: 'criteria',
      condition: "stage != 'Closed Won'",
      accessLevel: 'edit',
      sharedWith: {
        type: 'group',
        value: 'group_sales_reps',
      },
    });

    expect(rule.accessLevel).toBe('edit');
  });

  it('should reject sharing rule without required fields', () => {
    expect(() => SharingRuleSchema.parse({
      object: 'account',
      type: 'criteria',
      condition: "status = 'Active'",
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    })).toThrow(); // Missing name

    expect(() => SharingRuleSchema.parse({
      name: 'test_rule',
      type: 'criteria',
      condition: "status = 'Active'",
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    })).toThrow(); // Missing object

    expect(() => SharingRuleSchema.parse({
      name: 'test_rule',
      object: 'account',
      type: 'criteria',
      condition: "status = 'Active'",
    })).toThrow(); // Missing sharedWith
  });

  it('should reject invalid sharing rule type', () => {
    expect(() => SharingRuleSchema.parse({
      name: 'test_rule',
      object: 'account',
      type: 'invalid_type',
      condition: "status = 'Active'",
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    })).toThrow();
  });

  it('should reject invalid access level', () => {
    expect(() => SharingRuleSchema.parse({
      name: 'test_rule',
      object: 'account',
      type: 'criteria',
      condition: "status = 'Active'",
      accessLevel: 'delete',
      sharedWith: {
        type: 'group',
        value: 'group_id',
      },
    })).toThrow();
  });
});

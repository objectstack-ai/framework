import { describe, it, expect } from 'vitest';
import {
  CustomizationOriginSchema,
  FieldChangeSchema,
  MetadataOverlaySchema,
  MergeConflictSchema,
  MergeStrategyConfigSchema,
  MergeResultSchema,
  CustomizationPolicySchema,
} from './metadata-customization.zod';

describe('CustomizationOriginSchema', () => {
  it('should accept valid origins', () => {
    const origins = ['package', 'admin', 'user', 'migration', 'api'];
    origins.forEach(origin => {
      expect(() => CustomizationOriginSchema.parse(origin)).not.toThrow();
    });
  });

  it('should reject invalid origins', () => {
    expect(() => CustomizationOriginSchema.parse('system')).toThrow();
    expect(() => CustomizationOriginSchema.parse('')).toThrow();
  });
});

describe('FieldChangeSchema', () => {
  it('should accept minimal field change', () => {
    const change = {
      path: 'fields.status.label',
      currentValue: 'Account Status',
    };
    expect(() => FieldChangeSchema.parse(change)).not.toThrow();
  });

  it('should accept full field change with tracking', () => {
    const change = {
      path: 'fields.status.label',
      originalValue: 'Status',
      currentValue: 'Account Status',
      changedBy: 'admin@acme.com',
      changedAt: '2025-06-15T10:00:00Z',
    };
    const parsed = FieldChangeSchema.parse(change);
    expect(parsed.path).toBe('fields.status.label');
    expect(parsed.originalValue).toBe('Status');
    expect(parsed.currentValue).toBe('Account Status');
  });

  it('should reject missing required fields', () => {
    expect(() => FieldChangeSchema.parse({ currentValue: 'test' })).toThrow();
    expect(() => FieldChangeSchema.parse({})).toThrow();
  });
});

describe('MetadataOverlaySchema', () => {
  it('should accept minimal overlay', () => {
    const overlay = {
      id: 'overlay-001',
      baseType: 'object',
      baseName: 'account',
      patch: { label: 'My Custom Account' },
    };
    const parsed = MetadataOverlaySchema.parse(overlay);
    expect(parsed.scope).toBe('platform');
    expect(parsed.active).toBe(true);
  });

  it('should accept full overlay with package reference', () => {
    const overlay = {
      id: 'overlay-002',
      baseType: 'object',
      baseName: 'account',
      packageId: 'com.acme.crm',
      packageVersion: '1.0.0',
      scope: 'platform' as const,
      tenantId: 'tenant-001',
      patch: {
        label: 'Custom Account',
        'fields.status.label': 'Account Status',
      },
      changes: [
        {
          path: 'label',
          originalValue: 'Account',
          currentValue: 'Custom Account',
          changedBy: 'admin@acme.com',
          changedAt: '2025-06-15T10:00:00Z',
        },
      ],
      active: true,
      createdAt: '2025-06-15T10:00:00Z',
      createdBy: 'admin@acme.com',
    };

    const parsed = MetadataOverlaySchema.parse(overlay);
    expect(parsed.packageId).toBe('com.acme.crm');
    expect(parsed.changes).toHaveLength(1);
    expect(parsed.patch.label).toBe('Custom Account');
  });

  it('should accept user-scope overlay', () => {
    const overlay = {
      id: 'overlay-003',
      baseType: 'view',
      baseName: 'account_list',
      scope: 'user' as const,
      owner: 'user-123',
      patch: { columns: ['name', 'status', 'created_at'] },
    };
    const parsed = MetadataOverlaySchema.parse(overlay);
    expect(parsed.scope).toBe('user');
    expect(parsed.owner).toBe('user-123');
  });

  it('should reject overlay without required fields', () => {
    expect(() => MetadataOverlaySchema.parse({})).toThrow();
    expect(() => MetadataOverlaySchema.parse({ id: 'test' })).toThrow();
  });
});

describe('MergeConflictSchema', () => {
  it('should accept valid merge conflict', () => {
    const conflict = {
      path: 'fields.status.options',
      baseValue: ['new', 'open', 'closed'],
      incomingValue: ['new', 'open', 'in_progress', 'closed'],
      customValue: ['new', 'open', 'resolved', 'closed'],
      suggestedResolution: 'manual' as const,
      reason: 'Both package and customer modified the options list',
    };
    const parsed = MergeConflictSchema.parse(conflict);
    expect(parsed.suggestedResolution).toBe('manual');
  });

  it('should accept all resolution strategies', () => {
    const strategies = ['keep-custom', 'accept-incoming', 'manual'] as const;
    strategies.forEach(strategy => {
      const conflict = {
        path: 'label',
        baseValue: 'old',
        incomingValue: 'new',
        customValue: 'custom',
        suggestedResolution: strategy,
      };
      expect(() => MergeConflictSchema.parse(conflict)).not.toThrow();
    });
  });
});

describe('MergeStrategyConfigSchema', () => {
  it('should apply defaults', () => {
    const parsed = MergeStrategyConfigSchema.parse({});
    expect(parsed.defaultStrategy).toBe('three-way-merge');
    expect(parsed.autoResolveNonConflicting).toBe(true);
  });

  it('should accept full configuration', () => {
    const config = {
      defaultStrategy: 'keep-custom' as const,
      alwaysAcceptIncoming: ['fields.*.type', 'triggers.*'],
      alwaysKeepCustom: ['fields.*.label', 'fields.*.helpText', 'description'],
      autoResolveNonConflicting: true,
    };
    const parsed = MergeStrategyConfigSchema.parse(config);
    expect(parsed.alwaysAcceptIncoming).toHaveLength(2);
    expect(parsed.alwaysKeepCustom).toHaveLength(3);
  });
});

describe('MergeResultSchema', () => {
  it('should accept successful merge result', () => {
    const result = {
      success: true,
      mergedMetadata: { name: 'account', label: 'Custom Account' },
      stats: {
        totalFields: 15,
        unchanged: 10,
        autoResolved: 4,
        conflicts: 1,
      },
    };
    const parsed = MergeResultSchema.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.stats?.totalFields).toBe(15);
  });

  it('should accept merge result with conflicts', () => {
    const result = {
      success: false,
      conflicts: [{
        path: 'fields.status.options',
        baseValue: ['a'],
        incomingValue: ['a', 'b'],
        customValue: ['a', 'c'],
        suggestedResolution: 'manual' as const,
      }],
      autoResolved: [{
        path: 'label',
        resolution: 'keep-custom',
        description: 'Customer label preserved',
      }],
    };
    const parsed = MergeResultSchema.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.conflicts).toHaveLength(1);
  });
});

describe('CustomizationPolicySchema', () => {
  it('should apply defaults', () => {
    const parsed = CustomizationPolicySchema.parse({ metadataType: 'object' });
    expect(parsed.allowCustomization).toBe(true);
    expect(parsed.allowAddFields).toBe(true);
    expect(parsed.allowDeleteFields).toBe(false);
  });

  it('should accept full policy configuration', () => {
    const policy = {
      metadataType: 'object',
      allowCustomization: true,
      lockedFields: ['name', 'type', 'fields.*.type'],
      customizableFields: ['label', 'description', 'fields.*.label', 'fields.*.helpText'],
      allowAddFields: true,
      allowDeleteFields: false,
    };
    const parsed = CustomizationPolicySchema.parse(policy);
    expect(parsed.lockedFields).toHaveLength(3);
    expect(parsed.customizableFields).toHaveLength(4);
  });

  it('should accept restrictive policy', () => {
    const policy = {
      metadataType: 'flow',
      allowCustomization: false,
      allowAddFields: false,
      allowDeleteFields: false,
    };
    const parsed = CustomizationPolicySchema.parse(policy);
    expect(parsed.allowCustomization).toBe(false);
  });
});

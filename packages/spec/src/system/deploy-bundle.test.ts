import { describe, it, expect } from 'vitest';
import {
  DeployStatusEnum,
  SchemaChangeSchema,
  DeployDiffSchema,
  MigrationStatementSchema,
  MigrationPlanSchema,
  DeployValidationIssueSchema,
  DeployValidationResultSchema,
  DeployManifestSchema,
  DeployBundleSchema,
  type DeployStatus,
  type DeployDiff,
  type MigrationPlan,
  type DeployValidationResult,
  type DeployBundle,
} from './deploy-bundle.zod';

describe('DeployStatusEnum', () => {
  it('should accept valid statuses', () => {
    const statuses: DeployStatus[] = [
      'validating', 'diffing', 'migrating', 'registering', 'ready', 'failed', 'rolling_back',
    ];
    statuses.forEach((s) => {
      expect(() => DeployStatusEnum.parse(s)).not.toThrow();
    });
  });

  it('should reject invalid status', () => {
    expect(() => DeployStatusEnum.parse('deploying')).toThrow();
  });
});

describe('SchemaChangeSchema', () => {
  it('should accept a valid added change', () => {
    const change = {
      entityType: 'object',
      entityName: 'project_task',
      changeType: 'added',
      newValue: { name: 'project_task', label: 'Task' },
    };
    expect(() => SchemaChangeSchema.parse(change)).not.toThrow();
  });

  it('should accept a modified field change', () => {
    const change = {
      entityType: 'field',
      entityName: 'status',
      parentEntity: 'project_task',
      changeType: 'modified',
      oldValue: { type: 'text' },
      newValue: { type: 'select' },
    };
    expect(() => SchemaChangeSchema.parse(change)).not.toThrow();
  });

  it('should accept a removed change', () => {
    const change = {
      entityType: 'index',
      entityName: 'idx_name',
      changeType: 'removed',
    };
    expect(() => SchemaChangeSchema.parse(change)).not.toThrow();
  });
});

describe('DeployDiffSchema', () => {
  it('should accept a diff with changes', () => {
    const diff: DeployDiff = {
      changes: [
        { entityType: 'object', entityName: 'task', changeType: 'added' },
        { entityType: 'field', entityName: 'priority', parentEntity: 'task', changeType: 'added' },
      ],
      summary: { added: 2, modified: 0, removed: 0 },
      hasBreakingChanges: false,
    };
    const parsed = DeployDiffSchema.parse(diff);
    expect(parsed.changes).toHaveLength(2);
    expect(parsed.summary.added).toBe(2);
  });

  it('should accept empty diff with defaults', () => {
    const diff = { summary: { added: 0, modified: 0, removed: 0 } };
    const parsed = DeployDiffSchema.parse(diff);
    expect(parsed.changes).toEqual([]);
    expect(parsed.hasBreakingChanges).toBe(false);
  });
});

describe('MigrationPlanSchema', () => {
  it('should accept a valid migration plan', () => {
    const plan: MigrationPlan = {
      statements: [
        { sql: 'CREATE TABLE task (id TEXT PRIMARY KEY, name TEXT)', reversible: true, rollbackSql: 'DROP TABLE task', order: 0 },
        { sql: 'CREATE INDEX idx_task_name ON task(name)', reversible: true, rollbackSql: 'DROP INDEX idx_task_name', order: 1 },
      ],
      dialect: 'sqlite',
      reversible: true,
      estimatedDurationMs: 150,
    };
    const parsed = MigrationPlanSchema.parse(plan);
    expect(parsed.statements).toHaveLength(2);
    expect(parsed.dialect).toBe('sqlite');
  });

  it('should accept empty plan', () => {
    const plan = { dialect: 'sqlite' };
    const parsed = MigrationPlanSchema.parse(plan);
    expect(parsed.statements).toEqual([]);
    expect(parsed.reversible).toBe(true);
  });

  it('should reject missing dialect', () => {
    expect(() => MigrationPlanSchema.parse({ statements: [] })).toThrow();
  });
});

describe('DeployValidationResultSchema', () => {
  it('should accept valid validation result', () => {
    const result: DeployValidationResult = {
      valid: false,
      issues: [
        { severity: 'error', path: 'objects.task.fields.name', message: 'Field name is required', code: 'invalid_type' },
        { severity: 'warning', path: 'views.task_list', message: 'Missing description' },
      ],
      errorCount: 1,
      warningCount: 1,
    };
    const parsed = DeployValidationResultSchema.parse(result);
    expect(parsed.valid).toBe(false);
    expect(parsed.issues).toHaveLength(2);
    expect(parsed.errorCount).toBe(1);
  });

  it('should accept valid bundle', () => {
    const result = { valid: true };
    const parsed = DeployValidationResultSchema.parse(result);
    expect(parsed.issues).toEqual([]);
    expect(parsed.errorCount).toBe(0);
    expect(parsed.warningCount).toBe(0);
  });
});

describe('DeployManifestSchema', () => {
  it('should accept full manifest', () => {
    const manifest = {
      version: '1.0.0',
      checksum: 'sha256:abc123',
      objects: ['project_task', 'project'],
      views: ['task_list', 'project_board'],
      flows: ['auto_assign'],
      permissions: ['task_crud'],
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(() => DeployManifestSchema.parse(manifest)).not.toThrow();
  });

  it('should accept minimal manifest', () => {
    const manifest = { version: '0.1.0' };
    const parsed = DeployManifestSchema.parse(manifest);
    expect(parsed.objects).toEqual([]);
    expect(parsed.views).toEqual([]);
  });

  it('should reject empty version', () => {
    expect(() => DeployManifestSchema.parse({ version: '' })).toThrow();
  });
});

describe('DeployBundleSchema', () => {
  it('should accept full deploy bundle', () => {
    const bundle: DeployBundle = {
      manifest: {
        version: '1.0.0',
        objects: ['task'],
      },
      objects: [{ name: 'task', label: 'Task' }],
      views: [{ name: 'task_list', type: 'grid' }],
      flows: [],
      permissions: [],
    };
    const parsed = DeployBundleSchema.parse(bundle);
    expect(parsed.manifest.version).toBe('1.0.0');
    expect(parsed.objects).toHaveLength(1);
  });

  it('should accept minimal bundle', () => {
    const bundle = {
      manifest: { version: '0.1.0' },
    };
    const parsed = DeployBundleSchema.parse(bundle);
    expect(parsed.objects).toEqual([]);
    expect(parsed.views).toEqual([]);
    expect(parsed.flows).toEqual([]);
    expect(parsed.permissions).toEqual([]);
  });

  it('should reject missing manifest', () => {
    expect(() => DeployBundleSchema.parse({})).toThrow();
  });
});

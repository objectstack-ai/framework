import { describe, it, expect } from 'vitest';
import {
  RowLevelSecurityPolicySchema,
  RLSConfigSchema,
  RLSUserContextSchema,
  RLSEvaluationResultSchema,
  RLSAuditEventSchema,
  RLSAuditConfigSchema,
  RLSOperation,
  RLS,
  type RowLevelSecurityPolicy,
} from './rls.zod';

describe('Row-Level Security (RLS) Protocol', () => {
  describe('RLSOperation', () => {
    it('should validate allowed operations', () => {
      expect(RLSOperation.parse('select')).toBe('select');
      expect(RLSOperation.parse('insert')).toBe('insert');
      expect(RLSOperation.parse('update')).toBe('update');
      expect(RLSOperation.parse('delete')).toBe('delete');
      expect(RLSOperation.parse('all')).toBe('all');
    });

    it('should reject invalid operations', () => {
      expect(() => RLSOperation.parse('invalid')).toThrow();
      expect(() => RLSOperation.parse('merge')).toThrow();
    });
  });

  describe('RowLevelSecurityPolicySchema', () => {
    it('should validate a minimal policy', () => {
      const policy = {
        name: 'tenant_isolation',
        object: 'account',
        operation: 'select',
        using: 'organization_id == current_user.organization_id',
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result.name).toBe('tenant_isolation');
      expect(result.enabled).toBe(true); // default
      expect(result.priority).toBe(0); // default
    });

    it('should validate a complete policy with all fields', () => {
      const policy: RowLevelSecurityPolicy = {
        name: 'manager_team_access',
        label: 'Managers Can View Team Records',
        description: 'Allow managers to view records of their team members',
        object: 'task',
        operation: 'select',
        using: 'assigned_to_id IN (SELECT id FROM users WHERE manager_id = current_user.id)',
        check: 'assigned_to_id IN (SELECT id FROM users WHERE manager_id = current_user.id)',
        roles: ['manager', 'director'],
        enabled: true,
        priority: 10,
        tags: ['team_access', 'hierarchy'],
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result).toEqual(policy);
    });

    it('should enforce snake_case naming convention', () => {
      const validPolicy = {
        name: 'valid_policy_name',
        object: 'account',
        operation: 'select',
        using: 'owner_id == current_user.id',
      };

      expect(() => RowLevelSecurityPolicySchema.parse(validPolicy)).not.toThrow();

      const invalidPolicy = {
        name: 'InvalidPolicyName', // camelCase not allowed
        object: 'account',
        operation: 'select',
        using: 'owner_id == current_user.id',
      };

      expect(() => RowLevelSecurityPolicySchema.parse(invalidPolicy)).toThrow();
    });

    it('should allow complex USING clauses', () => {
      const complexPolicies = [
        {
          name: 'multi_condition',
          object: 'opportunity',
          operation: 'select',
          using: 'owner_id = current_user.id OR team_id = current_user.team_id',
        },
        {
          name: 'with_subquery',
          object: 'account',
          operation: 'select',
          using: 'region IN (SELECT region FROM user_territories WHERE user_id = current_user.id)',
        },
        {
          name: 'time_based',
          object: 'contract',
          operation: 'select',
          using: 'status = "active" AND start_date <= NOW() AND end_date >= NOW()',
        },
      ];

      complexPolicies.forEach(policy => {
        expect(() => RowLevelSecurityPolicySchema.parse(policy)).not.toThrow();
      });
    });

    it('should default enabled to true if not specified', () => {
      const policy = {
        name: 'test_policy',
        object: 'account',
        operation: 'select',
        using: 'owner_id == current_user.id',
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result.enabled).toBe(true);
    });

    it('should default priority to 0 if not specified', () => {
      const policy = {
        name: 'test_policy',
        object: 'account',
        operation: 'select',
        using: 'owner_id == current_user.id',
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result.priority).toBe(0);
    });

    it('should handle policies for all operations', () => {
      const policy = {
        name: 'tenant_all_ops',
        object: 'account',
        operation: 'all',
        using: 'organization_id == current_user.organization_id',
        check: 'organization_id == current_user.organization_id',
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result.operation).toBe('all');
    });

    it('should validate role restrictions', () => {
      const policy = {
        name: 'sales_only',
        object: 'opportunity',
        operation: 'select',
        using: 'region = current_user.region',
        roles: ['sales_rep', 'sales_manager'],
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result.roles).toEqual(['sales_rep', 'sales_manager']);
    });

    it('should validate tags', () => {
      const policy = {
        name: 'gdpr_policy',
        object: 'customer',
        operation: 'select',
        using: 'country IN (SELECT country FROM gdpr_countries)',
        tags: ['compliance', 'gdpr', 'privacy'],
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result.tags).toEqual(['compliance', 'gdpr', 'privacy']);
    });
  });

  describe('RLSConfigSchema', () => {
    it('should validate minimal config', () => {
      const config = {};
      const result = RLSConfigSchema.parse(config);

      expect(result.enabled).toBe(true);
      expect(result.defaultPolicy).toBe('deny');
      expect(result.allowSuperuserBypass).toBe(true);
      expect(result.logEvaluations).toBe(false);
      expect(result.cacheResults).toBe(true);
      expect(result.cacheTtlSeconds).toBe(300);
      expect(result.prefetchUserContext).toBe(true);
    });

    it('should validate complete config', () => {
      const config = {
        enabled: true,
        defaultPolicy: 'deny' as const,
        allowSuperuserBypass: true,
        bypassRoles: ['system_admin', 'data_auditor'],
        logEvaluations: true,
        cacheResults: true,
        cacheTtlSeconds: 600,
        prefetchUserContext: true,
      };

      const result = RLSConfigSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should validate defaultPolicy options', () => {
      const denyConfig = { defaultPolicy: 'deny' as const };
      expect(RLSConfigSchema.parse(denyConfig).defaultPolicy).toBe('deny');

      const allowConfig = { defaultPolicy: 'allow' as const };
      expect(RLSConfigSchema.parse(allowConfig).defaultPolicy).toBe('allow');

      const invalidConfig = { defaultPolicy: 'reject' };
      expect(() => RLSConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate bypass roles', () => {
      const config = {
        bypassRoles: ['admin', 'superuser', 'auditor'],
      };

      const result = RLSConfigSchema.parse(config);
      expect(result.bypassRoles).toEqual(['admin', 'superuser', 'auditor']);
    });

    it('should validate cache TTL as positive integer', () => {
      const validConfig = { cacheTtlSeconds: 600 };
      expect(() => RLSConfigSchema.parse(validConfig)).not.toThrow();

      const invalidConfig1 = { cacheTtlSeconds: -100 };
      expect(() => RLSConfigSchema.parse(invalidConfig1)).toThrow();

      const invalidConfig2 = { cacheTtlSeconds: 0 };
      expect(() => RLSConfigSchema.parse(invalidConfig2)).toThrow();
    });
  });

  describe('RLSUserContextSchema', () => {
    it('should validate minimal user context', () => {
      const context = {
        id: 'user_123',
      };

      const result = RLSUserContextSchema.parse(context);
      expect(result.id).toBe('user_123');
    });

    it('should validate complete user context', () => {
      const context = {
        id: 'user_123',
        email: 'john@example.com',
        tenantId: 'tenant_456',
        role: 'sales_rep',
        department: 'sales',
        attributes: {
          region: 'US-West',
          manager_id: 'user_789',
          custom_field: 'custom_value',
        },
      };

      const result = RLSUserContextSchema.parse(context);
      expect(result).toEqual(context);
    });

    it('should validate multiple roles as array', () => {
      const context = {
        id: 'user_123',
        role: ['sales_rep', 'team_lead'],
      };

      const result = RLSUserContextSchema.parse(context);
      expect(result.role).toEqual(['sales_rep', 'team_lead']);
    });

    it('should validate single role as string', () => {
      const context = {
        id: 'user_123',
        role: 'admin',
      };

      const result = RLSUserContextSchema.parse(context);
      expect(result.role).toBe('admin');
    });

    it('should validate email format', () => {
      const validContext = {
        id: 'user_123',
        email: 'valid@example.com',
      };
      expect(() => RLSUserContextSchema.parse(validContext)).not.toThrow();

      const invalidContext = {
        id: 'user_123',
        email: 'invalid-email',
      };
      expect(() => RLSUserContextSchema.parse(invalidContext)).toThrow();
    });

    it('should allow custom attributes', () => {
      const context = {
        id: 'user_123',
        attributes: {
          custom_field_1: 'value1',
          custom_field_2: 123,
          custom_field_3: true,
          nested_object: {
            key: 'value',
          },
        },
      };

      const result = RLSUserContextSchema.parse(context);
      expect(result.attributes).toEqual(context.attributes);
    });
  });

  describe('RLSEvaluationResultSchema', () => {
    it('should validate minimal evaluation result', () => {
      const result = {
        policyName: 'tenant_isolation',
        granted: true,
      };

      expect(() => RLSEvaluationResultSchema.parse(result)).not.toThrow();
    });

    it('should validate complete evaluation result', () => {
      const result = {
        policyName: 'owner_access',
        granted: true,
        durationMs: 15.5,
        usingResult: true,
        checkResult: true,
      };

      const parsed = RLSEvaluationResultSchema.parse(result);
      expect(parsed).toEqual(result);
    });

    it('should validate failed evaluation with error', () => {
      const result = {
        policyName: 'complex_policy',
        granted: false,
        durationMs: 25.3,
        error: 'Failed to evaluate subquery',
        usingResult: false,
      };

      const parsed = RLSEvaluationResultSchema.parse(result);
      expect(parsed.granted).toBe(false);
      expect(parsed.error).toBe('Failed to evaluate subquery');
    });
  });

  describe('RLS Helper Factory', () => {
    describe('ownerPolicy', () => {
      it('should create owner-based policy with default owner field', () => {
        const policy = RLS.ownerPolicy('opportunity');

        expect(policy.name).toBe('opportunity_owner_access');
        expect(policy.object).toBe('opportunity');
        expect(policy.operation).toBe('all');
        expect(policy.using).toBe('owner_id == current_user.id');
        expect(policy.enabled).toBe(true);
      });

      it('should create owner-based policy with custom owner field', () => {
        const policy = RLS.ownerPolicy('task', 'assigned_to_id');

        expect(policy.using).toBe('assigned_to_id == current_user.id');
      });
    });

    describe('tenantPolicy', () => {
      it('should create tenant isolation policy with default field', () => {
        const policy = RLS.tenantPolicy('account');

        expect(policy.name).toBe('account_tenant_isolation');
        expect(policy.object).toBe('account');
        expect(policy.operation).toBe('all');
        expect(policy.using).toBe('organization_id == current_user.organization_id');
        expect(policy.check).toBe('organization_id == current_user.organization_id');
        expect(policy.enabled).toBe(true);
      });

      it('should create tenant isolation policy with custom field', () => {
        const policy = RLS.tenantPolicy('order', 'workspace_id');

        expect(policy.using).toBe('workspace_id == current_user.organization_id');
        expect(policy.check).toBe('workspace_id == current_user.organization_id');
      });
    });

    describe('rolePolicy', () => {
      it('should create role-based policy', () => {
        const policy = RLS.rolePolicy(
          'sensitive_data',
          ['manager', 'director'],
          'department = current_user.department'
        );

        expect(policy.name).toBe('sensitive_data_manager_director_access');
        expect(policy.object).toBe('sensitive_data');
        expect(policy.operation).toBe('select');
        expect(policy.using).toBe('department = current_user.department');
        expect(policy.roles).toEqual(['manager', 'director']);
        expect(policy.enabled).toBe(true);
      });
    });

    describe('allowAllPolicy', () => {
      it('should create permissive policy for specified roles', () => {
        const policy = RLS.allowAllPolicy('account', ['ceo', 'cfo']);

        expect(policy.name).toBe('account_ceo_cfo_full_access');
        expect(policy.object).toBe('account');
        expect(policy.operation).toBe('all');
        expect(policy.using).toBe('1 == 1'); // Always true
        expect(policy.roles).toEqual(['ceo', 'cfo']);
        expect(policy.enabled).toBe(true);
      });
    });
  });

  describe('Real-World Use Cases', () => {
    it('should support multi-tenant SaaS isolation', () => {
      const policy: RowLevelSecurityPolicy = {
        name: 'saas_tenant_isolation',
        label: 'Multi-Tenant Data Isolation',
        description: 'Ensure users only access data from their own organization',
        object: 'customer',
        operation: 'all',
        using: 'organization_id == current_user.organization_id',
        check: 'organization_id == current_user.organization_id',
        enabled: true,
        tags: ['multi-tenant', 'security'],
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result.using).toContain('organization_id');
    });

    it('should support hierarchical access (manager sees team data)', () => {
      const policy: RowLevelSecurityPolicy = {
        name: 'manager_team_hierarchy',
        label: 'Manager Team Hierarchy Access',
        object: 'performance_review',
        operation: 'select',
        using: `
          employee_id = current_user.id 
          OR employee_id IN (
            SELECT id FROM users 
            WHERE manager_id = current_user.id
          )
        `,
        roles: ['manager', 'director'],
        enabled: true,
      };

      expect(() => RowLevelSecurityPolicySchema.parse(policy)).not.toThrow();
    });

    it('should support regional sales territory access', () => {
      const policy: RowLevelSecurityPolicy = {
        name: 'sales_territory_access',
        label: 'Sales Territory-Based Access',
        object: 'account',
        operation: 'select',
        using: 'territory IN (SELECT territory FROM user_territories WHERE user_id = current_user.id)',
        roles: ['sales_rep'],
        enabled: true,
      };

      expect(() => RowLevelSecurityPolicySchema.parse(policy)).not.toThrow();
    });

    it('should support time-based access (active contracts only)', () => {
      const policy: RowLevelSecurityPolicy = {
        name: 'active_contracts_only',
        label: 'Active Contracts Only',
        object: 'contract',
        operation: 'select',
        using: 'status = "active" AND start_date <= NOW() AND end_date >= NOW()',
        enabled: true,
      };

      expect(() => RowLevelSecurityPolicySchema.parse(policy)).not.toThrow();
    });

    it('should support GDPR compliance (data residency)', () => {
      const policy: RowLevelSecurityPolicy = {
        name: 'gdpr_data_residency',
        label: 'GDPR Data Residency Compliance',
        description: 'Users can only access data from their allowed regions',
        object: 'customer_data',
        operation: 'select',
        using: 'country IN (SELECT country FROM user_allowed_countries WHERE user_id = current_user.id)',
        enabled: true,
        tags: ['gdpr', 'compliance', 'privacy'],
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result.tags).toContain('gdpr');
    });

    it('should support shared team records', () => {
      const policy: RowLevelSecurityPolicy = {
        name: 'team_shared_access',
        label: 'Team Shared Records',
        object: 'project',
        operation: 'select',
        using: `
          owner_id = current_user.id 
          OR id IN (
            SELECT environment_id FROM project_members 
            WHERE user_id = current_user.id
          )
        `,
        enabled: true,
      };

      expect(() => RowLevelSecurityPolicySchema.parse(policy)).not.toThrow();
    });

    it('should support executive full access bypass', () => {
      const policy: RowLevelSecurityPolicy = {
        name: 'executive_full_access',
        label: 'Executive Full Access',
        description: 'C-level executives can view all data',
        object: 'financial_data',
        operation: 'all',
        using: '1 == 1', // Always true - see everything
        roles: ['ceo', 'cfo', 'cto'],
        enabled: true,
        priority: 100, // Highest priority
      };

      const result = RowLevelSecurityPolicySchema.parse(policy);
      expect(result.using).toBe('1 == 1');
      expect(result.priority).toBe(100);
    });
  });

  describe('Integration with Other Protocols', () => {
    it('should work alongside object permissions', () => {
      // Object permission grants read access
      // RLS filters which specific records can be read
      const rlsPolicy: RowLevelSecurityPolicy = {
        name: 'department_access',
        object: 'employee',
        operation: 'select',
        using: 'department = current_user.department',
        enabled: true,
      };

      expect(() => RowLevelSecurityPolicySchema.parse(rlsPolicy)).not.toThrow();
    });

    it('should support validation rules integration', () => {
      const policy: RowLevelSecurityPolicy = {
        name: 'prevent_backdating',
        object: 'transaction',
        operation: 'insert',
        using: '1 == 1',
        check: 'transaction_date >= CURRENT_DATE - INTERVAL "30 days"',
        enabled: true,
      };

      expect(() => RowLevelSecurityPolicySchema.parse(policy)).not.toThrow();
    });
  });

  // ==========================================
  // RLS Audit Event & Config Tests
  // ==========================================

  describe('RLSAuditEventSchema', () => {
    it('should accept minimal audit event', () => {
      const event = RLSAuditEventSchema.parse({
        timestamp: '2024-06-15T10:30:00Z',
        userId: 'user_123',
        operation: 'select',
        object: 'account',
        policyName: 'tenant_isolation',
        granted: true,
        evaluationDurationMs: 2.5,
      });

      expect(event.granted).toBe(true);
      expect(event.evaluationDurationMs).toBe(2.5);
    });

    it('should accept full audit event', () => {
      const event = RLSAuditEventSchema.parse({
        timestamp: '2024-06-15T10:30:00Z',
        userId: 'user_456',
        operation: 'delete',
        object: 'customer',
        policyName: 'owner_access',
        granted: false,
        evaluationDurationMs: 15.3,
        matchedCondition: 'owner_id == current_user.id',
        rowCount: 0,
        metadata: { source: 'api', requestId: 'req-789' },
      });

      expect(event.granted).toBe(false);
      expect(event.matchedCondition).toBe('owner_id == current_user.id');
      expect(event.rowCount).toBe(0);
      expect(event.metadata?.source).toBe('api');
    });

    it('should accept all operation types', () => {
      const ops = ['select', 'insert', 'update', 'delete'] as const;
      ops.forEach(operation => {
        expect(() => RLSAuditEventSchema.parse({
          timestamp: '2024-01-01T00:00:00Z',
          userId: 'u1',
          operation,
          object: 'test',
          policyName: 'test_policy',
          granted: true,
          evaluationDurationMs: 1,
        })).not.toThrow();
      });
    });
  });

  describe('RLSAuditConfigSchema', () => {
    it('should accept full audit config', () => {
      const config = RLSAuditConfigSchema.parse({
        enabled: true,
        logLevel: 'all',
        destination: 'audit_trail',
        sampleRate: 1.0,
        retentionDays: 365,
        includeRowData: false,
        alertOnDenied: true,
      });

      expect(config.enabled).toBe(true);
      expect(config.logLevel).toBe('all');
      expect(config.destination).toBe('audit_trail');
      expect(config.sampleRate).toBe(1.0);
      expect(config.retentionDays).toBe(365);
    });

    it('should accept all log levels', () => {
      const levels = ['all', 'denied_only', 'granted_only', 'none'] as const;
      levels.forEach(logLevel => {
        const config = RLSAuditConfigSchema.parse({
          enabled: true,
          logLevel,
          destination: 'system_log',
          sampleRate: 0.5,
        });
        expect(config.logLevel).toBe(logLevel);
      });
    });

    it('should accept all destinations', () => {
      const destinations = ['system_log', 'audit_trail', 'external'] as const;
      destinations.forEach(destination => {
        const config = RLSAuditConfigSchema.parse({
          enabled: true,
          logLevel: 'all',
          destination,
          sampleRate: 1,
        });
        expect(config.destination).toBe(destination);
      });
    });

    it('should enforce sampleRate range', () => {
      expect(() => RLSAuditConfigSchema.parse({
        enabled: true,
        logLevel: 'all',
        destination: 'system_log',
        sampleRate: -0.1,
      })).toThrow();

      expect(() => RLSAuditConfigSchema.parse({
        enabled: true,
        logLevel: 'all',
        destination: 'system_log',
        sampleRate: 1.1,
      })).toThrow();
    });

    it('should apply defaults for includeRowData and alertOnDenied', () => {
      const config = RLSAuditConfigSchema.parse({
        enabled: true,
        logLevel: 'denied_only',
        destination: 'external',
        sampleRate: 0.1,
      });

      expect(config.includeRowData).toBe(false);
      expect(config.alertOnDenied).toBe(true);
      expect(config.retentionDays).toBe(90);
    });
  });

  describe('RLSConfigSchema with audit', () => {
    it('should accept config with audit field', () => {
      const config = RLSConfigSchema.parse({
        enabled: true,
        audit: {
          enabled: true,
          logLevel: 'denied_only',
          destination: 'audit_trail',
          sampleRate: 0.5,
        },
      });

      expect(config.audit?.enabled).toBe(true);
      expect(config.audit?.logLevel).toBe('denied_only');
    });

    it('should accept config without audit field', () => {
      const config = RLSConfigSchema.parse({});
      expect(config.audit).toBeUndefined();
    });
  });
});

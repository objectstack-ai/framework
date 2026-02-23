import { describe, it, expect } from 'vitest';
import {
  SupplierRiskLevelSchema,
  SupplierAssessmentStatusSchema,
  SupplierSecurityRequirementSchema,
  SupplierSecurityAssessmentSchema,
  SupplierSecurityPolicySchema,
  type SupplierSecurityAssessment,
  type SupplierSecurityRequirement,
} from './supplier-security.zod';

describe('SupplierRiskLevelSchema', () => {
  it('should accept all valid risk levels', () => {
    const levels = ['critical', 'high', 'medium', 'low'];

    levels.forEach((level) => {
      expect(() => SupplierRiskLevelSchema.parse(level)).not.toThrow();
    });
  });

  it('should reject invalid risk level', () => {
    expect(() => SupplierRiskLevelSchema.parse('extreme')).toThrow();
  });
});

describe('SupplierAssessmentStatusSchema', () => {
  it('should accept all valid statuses', () => {
    const statuses = ['pending', 'in_progress', 'completed', 'expired', 'failed'];

    statuses.forEach((status) => {
      expect(() => SupplierAssessmentStatusSchema.parse(status)).not.toThrow();
    });
  });

  it('should reject invalid status', () => {
    expect(() => SupplierAssessmentStatusSchema.parse('unknown')).toThrow();
  });
});

describe('SupplierSecurityRequirementSchema', () => {
  it('should accept valid requirement with defaults', () => {
    const req = SupplierSecurityRequirementSchema.parse({
      id: 'REQ-001',
      description: 'Data encryption at rest using AES-256',
    });

    expect(req.mandatory).toBe(true);
    expect(req.compliant).toBeUndefined();
  });

  it('should accept full requirement', () => {
    const req: SupplierSecurityRequirement = {
      id: 'REQ-002',
      description: 'Access control with MFA',
      controlReference: 'A.8.5',
      mandatory: true,
      compliant: true,
      evidence: 'SOC 2 Type II report confirms MFA for all users',
    };

    expect(() => SupplierSecurityRequirementSchema.parse(req)).not.toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => SupplierSecurityRequirementSchema.parse({})).toThrow();
    expect(() => SupplierSecurityRequirementSchema.parse({ id: 'REQ-001' })).toThrow();
  });
});

describe('SupplierSecurityAssessmentSchema', () => {
  it('should accept complete assessment', () => {
    const assessment: SupplierSecurityAssessment = {
      supplierId: 'SUP-001',
      supplierName: 'Cloud Provider Inc.',
      riskLevel: 'critical',
      status: 'completed',
      assessedBy: 'security_team',
      assessedAt: 1704067200000,
      validUntil: 1735689600000,
      requirements: [
        {
          id: 'REQ-001',
          description: 'Data encryption at rest using AES-256',
          controlReference: 'A.8.24',
          mandatory: true,
          compliant: true,
          evidence: 'Verified via SOC 2 report',
        },
        {
          id: 'REQ-002',
          description: 'Annual penetration testing',
          controlReference: 'A.8.8',
          mandatory: true,
          compliant: true,
          evidence: 'Pen test report provided',
        },
      ],
      overallCompliant: true,
      dataClassificationsShared: ['pii', 'confidential'],
      servicesProvided: ['cloud-hosting', 'database-management'],
      certifications: ['ISO 27001', 'SOC 2 Type II'],
    };

    expect(() => SupplierSecurityAssessmentSchema.parse(assessment)).not.toThrow();
  });

  it('should accept minimal assessment', () => {
    const minimal = {
      supplierId: 'SUP-002',
      supplierName: 'SaaS Vendor',
      riskLevel: 'low',
      status: 'completed',
      assessedBy: 'it_team',
      assessedAt: Date.now(),
      validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000,
      requirements: [],
      overallCompliant: true,
    };

    expect(() => SupplierSecurityAssessmentSchema.parse(minimal)).not.toThrow();
  });

  it('should accept assessment with remediation items', () => {
    const assessment = {
      supplierId: 'SUP-003',
      supplierName: 'Data Processor Co.',
      riskLevel: 'high',
      status: 'completed',
      assessedBy: 'security_team',
      assessedAt: Date.now(),
      validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000,
      requirements: [
        {
          id: 'REQ-001',
          description: 'Encryption at rest',
          mandatory: true,
          compliant: false,
          evidence: 'Not currently implemented',
        },
      ],
      overallCompliant: false,
      remediationItems: [
        {
          requirementId: 'REQ-001',
          action: 'Implement AES-256 encryption at rest',
          deadline: Date.now() + 90 * 24 * 60 * 60 * 1000,
          status: 'pending',
        },
      ],
    };

    expect(() => SupplierSecurityAssessmentSchema.parse(assessment)).not.toThrow();
  });

  it('should accept failed assessment', () => {
    const failed = {
      supplierId: 'SUP-004',
      supplierName: 'Failing Vendor',
      riskLevel: 'critical',
      status: 'failed',
      assessedBy: 'external_auditor',
      assessedAt: Date.now(),
      validUntil: Date.now(),
      requirements: [
        {
          id: 'REQ-001',
          description: 'Basic access control',
          mandatory: true,
          compliant: false,
        },
      ],
      overallCompliant: false,
    };

    expect(() => SupplierSecurityAssessmentSchema.parse(failed)).not.toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => SupplierSecurityAssessmentSchema.parse({})).toThrow();
    expect(() => SupplierSecurityAssessmentSchema.parse({ supplierId: 'SUP-001' })).toThrow();
  });
});

describe('SupplierSecurityPolicySchema', () => {
  it('should accept policy with defaults', () => {
    const policy = SupplierSecurityPolicySchema.parse({});

    expect(policy.enabled).toBe(true);
    expect(policy.reassessmentIntervalDays).toBe(365);
    expect(policy.requirePreOnboardingAssessment).toBe(true);
    expect(policy.formalAssessmentThreshold).toBe('medium');
    expect(policy.monitorChanges).toBe(true);
    expect(policy.requiredCertifications).toEqual([]);
  });

  it('should accept full policy configuration', () => {
    const policy = SupplierSecurityPolicySchema.parse({
      enabled: true,
      reassessmentIntervalDays: 180,
      requirePreOnboardingAssessment: true,
      formalAssessmentThreshold: 'low',
      monitorChanges: true,
      requiredCertifications: ['ISO 27001', 'SOC 2 Type II'],
    });

    expect(policy.reassessmentIntervalDays).toBe(180);
    expect(policy.formalAssessmentThreshold).toBe('low');
    expect(policy.requiredCertifications).toHaveLength(2);
  });
});

import { describe, it, expect } from 'vitest';
import {
  GDPRConfigSchema,
  HIPAAConfigSchema,
  PCIDSSConfigSchema,
  AuditLogConfigSchema,
  ComplianceConfigSchema,
  AuditFindingSeveritySchema,
  AuditFindingStatusSchema,
  AuditFindingSchema,
  AuditScheduleSchema,
} from './compliance.zod';

describe('GDPRConfigSchema', () => {
  it('should accept valid GDPR config with defaults', () => {
    const config = GDPRConfigSchema.parse({
      enabled: true,
      dataSubjectRights: {},
      legalBasis: 'consent',
    });

    expect(config.enabled).toBe(true);
    expect(config.dataSubjectRights.rightToAccess).toBe(true);
    expect(config.dataSubjectRights.rightToRectification).toBe(true);
    expect(config.dataSubjectRights.rightToErasure).toBe(true);
    expect(config.dataSubjectRights.rightToRestriction).toBe(true);
    expect(config.dataSubjectRights.rightToPortability).toBe(true);
    expect(config.dataSubjectRights.rightToObjection).toBe(true);
    expect(config.consentTracking).toBe(true);
  });

  it('should accept all legal basis values', () => {
    const bases = [
      'consent', 'contract', 'legal-obligation',
      'vital-interests', 'public-task', 'legitimate-interests',
    ];

    bases.forEach((basis) => {
      expect(() => GDPRConfigSchema.parse({
        enabled: true,
        dataSubjectRights: {},
        legalBasis: basis,
      })).not.toThrow();
    });
  });

  it('should accept optional fields', () => {
    const config = GDPRConfigSchema.parse({
      enabled: true,
      dataSubjectRights: {},
      legalBasis: 'consent',
      dataRetentionDays: 365,
      dataProcessingAgreement: 'https://example.com/dpa',
    });

    expect(config.dataRetentionDays).toBe(365);
    expect(config.dataProcessingAgreement).toBe('https://example.com/dpa');
  });

  it('should reject invalid legal basis', () => {
    expect(() => GDPRConfigSchema.parse({
      enabled: true,
      dataSubjectRights: {},
      legalBasis: 'invalid',
    })).toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => GDPRConfigSchema.parse({})).toThrow();
    expect(() => GDPRConfigSchema.parse({ enabled: true })).toThrow();
  });
});

describe('HIPAAConfigSchema', () => {
  it('should accept valid HIPAA config with defaults', () => {
    const config = HIPAAConfigSchema.parse({
      enabled: true,
      phi: {},
    });

    expect(config.enabled).toBe(true);
    expect(config.phi.encryption).toBe(true);
    expect(config.phi.accessControl).toBe(true);
    expect(config.phi.auditTrail).toBe(true);
    expect(config.phi.backupAndRecovery).toBe(true);
    expect(config.businessAssociateAgreement).toBe(false);
  });

  it('should accept full configuration', () => {
    const config = HIPAAConfigSchema.parse({
      enabled: true,
      phi: {
        encryption: false,
        accessControl: true,
        auditTrail: true,
        backupAndRecovery: false,
      },
      businessAssociateAgreement: true,
    });

    expect(config.phi.encryption).toBe(false);
    expect(config.phi.backupAndRecovery).toBe(false);
    expect(config.businessAssociateAgreement).toBe(true);
  });

  it('should reject missing required fields', () => {
    expect(() => HIPAAConfigSchema.parse({})).toThrow();
    expect(() => HIPAAConfigSchema.parse({ enabled: true })).toThrow();
  });
});

describe('PCIDSSConfigSchema', () => {
  it('should accept valid PCI-DSS config with defaults', () => {
    const config = PCIDSSConfigSchema.parse({
      enabled: true,
      level: '1',
      cardDataFields: ['card_number', 'cvv'],
    });

    expect(config.enabled).toBe(true);
    expect(config.level).toBe('1');
    expect(config.cardDataFields).toEqual(['card_number', 'cvv']);
    expect(config.tokenization).toBe(true);
    expect(config.encryptionInTransit).toBe(true);
    expect(config.encryptionAtRest).toBe(true);
  });

  it('should accept all compliance levels', () => {
    const levels = ['1', '2', '3', '4'];

    levels.forEach((level) => {
      expect(() => PCIDSSConfigSchema.parse({
        enabled: true,
        level,
        cardDataFields: [],
      })).not.toThrow();
    });
  });

  it('should reject invalid level', () => {
    expect(() => PCIDSSConfigSchema.parse({
      enabled: true,
      level: '5',
      cardDataFields: [],
    })).toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => PCIDSSConfigSchema.parse({})).toThrow();
    expect(() => PCIDSSConfigSchema.parse({ enabled: true })).toThrow();
    expect(() => PCIDSSConfigSchema.parse({ enabled: true, level: '1' })).toThrow();
  });
});

describe('AuditLogConfigSchema', () => {
  it('should accept valid config with defaults', () => {
    const config = AuditLogConfigSchema.parse({
      events: ['create', 'update', 'delete'],
    });

    expect(config.enabled).toBe(true);
    expect(config.retentionDays).toBe(365);
    expect(config.immutable).toBe(true);
    expect(config.signLogs).toBe(false);
    expect(config.events).toEqual(['create', 'update', 'delete']);
  });

  it('should accept all event types', () => {
    const events = [
      'create', 'read', 'update', 'delete', 'export',
      'permission-change', 'login', 'logout', 'failed-login',
    ];

    expect(() => AuditLogConfigSchema.parse({ events })).not.toThrow();
  });

  it('should reject invalid event type', () => {
    expect(() => AuditLogConfigSchema.parse({
      events: ['invalid-event'],
    })).toThrow();
  });

  it('should reject missing events', () => {
    expect(() => AuditLogConfigSchema.parse({})).toThrow();
  });
});

describe('ComplianceConfigSchema', () => {
  it('should accept minimal configuration with required auditLog', () => {
    const config = ComplianceConfigSchema.parse({
      auditLog: {
        events: ['create', 'update'],
      },
    });

    expect(config.gdpr).toBeUndefined();
    expect(config.hipaa).toBeUndefined();
    expect(config.pciDss).toBeUndefined();
    expect(config.auditLog).toBeDefined();
    expect(config.auditLog.events).toEqual(['create', 'update']);
  });

  it('should accept full configuration', () => {
    const config = ComplianceConfigSchema.parse({
      gdpr: {
        enabled: true,
        dataSubjectRights: {},
        legalBasis: 'consent',
      },
      hipaa: {
        enabled: true,
        phi: {},
      },
      pciDss: {
        enabled: true,
        level: '1',
        cardDataFields: ['card_number'],
      },
      auditLog: {
        events: ['create', 'read', 'update', 'delete'],
      },
    });

    expect(config.gdpr?.enabled).toBe(true);
    expect(config.hipaa?.enabled).toBe(true);
    expect(config.pciDss?.enabled).toBe(true);
    expect(config.auditLog.events).toHaveLength(4);
  });

  it('should reject missing auditLog', () => {
    expect(() => ComplianceConfigSchema.parse({})).toThrow();
  });

  it('should accept configuration with audit schedules', () => {
    const config = ComplianceConfigSchema.parse({
      auditLog: {
        events: ['create', 'update'],
      },
      auditSchedules: [
        {
          id: 'AUDIT-2024-Q1',
          title: 'Q1 ISO 27001 Internal Audit',
          scope: ['access_control', 'encryption'],
          framework: 'iso27001',
          scheduledAt: 1711929600000,
          assessor: 'internal_audit_team',
        },
      ],
    });

    expect(config.auditSchedules).toHaveLength(1);
    expect(config.auditSchedules![0].framework).toBe('iso27001');
  });
});

describe('AuditFindingSeveritySchema', () => {
  it('should accept all valid severities', () => {
    const severities = ['critical', 'major', 'minor', 'observation'];

    severities.forEach((severity) => {
      expect(() => AuditFindingSeveritySchema.parse(severity)).not.toThrow();
    });
  });

  it('should reject invalid severity', () => {
    expect(() => AuditFindingSeveritySchema.parse('warning')).toThrow();
  });
});

describe('AuditFindingStatusSchema', () => {
  it('should accept all valid statuses', () => {
    const statuses = ['open', 'in_remediation', 'remediated', 'verified', 'accepted_risk', 'closed'];

    statuses.forEach((status) => {
      expect(() => AuditFindingStatusSchema.parse(status)).not.toThrow();
    });
  });

  it('should reject invalid status', () => {
    expect(() => AuditFindingStatusSchema.parse('pending')).toThrow();
  });
});

describe('AuditFindingSchema', () => {
  it('should accept valid finding', () => {
    const finding = AuditFindingSchema.parse({
      id: 'FIND-2024-001',
      title: 'Insufficient access logging',
      description: 'PHI access events are not being logged for HIPAA compliance',
      severity: 'major',
      status: 'in_remediation',
      controlReference: 'A.8.15',
      framework: 'iso27001',
      identifiedAt: 1704067200000,
      identifiedBy: 'external_auditor',
      remediationPlan: 'Implement audit logging for all PHI access events',
      remediationDeadline: 1706745600000,
    });

    expect(finding.severity).toBe('major');
    expect(finding.framework).toBe('iso27001');
  });

  it('should accept minimal finding', () => {
    const finding = AuditFindingSchema.parse({
      id: 'FIND-2024-002',
      title: 'Missing encryption',
      description: 'Field-level encryption not enabled',
      severity: 'minor',
      status: 'open',
      identifiedAt: Date.now(),
      identifiedBy: 'internal_audit',
    });

    expect(finding.controlReference).toBeUndefined();
    expect(finding.remediationPlan).toBeUndefined();
  });

  it('should accept verified finding', () => {
    const finding = AuditFindingSchema.parse({
      id: 'FIND-2024-003',
      title: 'Weak password policy',
      description: 'Password minimum length below 12 characters',
      severity: 'observation',
      status: 'verified',
      identifiedAt: 1704067200000,
      identifiedBy: 'auditor',
      verifiedAt: 1706745600000,
      verifiedBy: 'senior_auditor',
      notes: 'Password policy updated and verified',
    });

    expect(finding.verifiedAt).toBe(1706745600000);
    expect(finding.verifiedBy).toBe('senior_auditor');
  });

  it('should reject missing required fields', () => {
    expect(() => AuditFindingSchema.parse({})).toThrow();
  });
});

describe('AuditScheduleSchema', () => {
  it('should accept valid schedule with defaults', () => {
    const schedule = AuditScheduleSchema.parse({
      id: 'AUDIT-2024-Q1',
      title: 'Q1 ISO 27001 Internal Audit',
      scope: ['access_control', 'encryption', 'incident_response'],
      framework: 'iso27001',
      scheduledAt: 1711929600000,
      assessor: 'internal_audit_team',
    });

    expect(schedule.isExternal).toBe(false);
    expect(schedule.recurrenceMonths).toBe(0);
    expect(schedule.findings).toBeUndefined();
  });

  it('should accept full schedule with findings', () => {
    const schedule = AuditScheduleSchema.parse({
      id: 'AUDIT-2024-EXT',
      title: 'Annual External ISO 27001 Audit',
      scope: ['all_controls'],
      framework: 'iso27001',
      scheduledAt: 1711929600000,
      completedAt: 1712534400000,
      assessor: 'External Audit Firm LLC',
      isExternal: true,
      recurrenceMonths: 12,
      findings: [
        {
          id: 'FIND-001',
          title: 'Missing incident response plan',
          description: 'No documented incident response procedure',
          severity: 'major',
          status: 'open',
          controlReference: 'A.5.24',
          framework: 'iso27001',
          identifiedAt: 1712534400000,
          identifiedBy: 'External Audit Firm LLC',
        },
      ],
    });

    expect(schedule.isExternal).toBe(true);
    expect(schedule.recurrenceMonths).toBe(12);
    expect(schedule.findings).toHaveLength(1);
  });

  it('should accept all framework values', () => {
    const frameworks = ['gdpr', 'hipaa', 'sox', 'pci_dss', 'ccpa', 'iso27001'];

    frameworks.forEach((framework) => {
      expect(() => AuditScheduleSchema.parse({
        id: `AUDIT-${framework}`,
        title: `${framework} audit`,
        scope: ['general'],
        framework,
        scheduledAt: Date.now(),
        assessor: 'auditor',
      })).not.toThrow();
    });
  });

  it('should reject missing required fields', () => {
    expect(() => AuditScheduleSchema.parse({})).toThrow();
  });
});

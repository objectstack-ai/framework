import { describe, it, expect } from 'vitest';
import {
  TrainingCategorySchema,
  TrainingCompletionStatusSchema,
  TrainingCourseSchema,
  TrainingRecordSchema,
  TrainingPlanSchema,
  type TrainingCourse,
  type TrainingRecord,
} from './training.zod';

describe('TrainingCategorySchema', () => {
  it('should accept all valid categories', () => {
    const validCategories = [
      'security_awareness', 'data_protection', 'incident_response',
      'access_control', 'phishing_awareness', 'compliance',
      'secure_development', 'physical_security', 'business_continuity', 'other',
    ];

    validCategories.forEach((category) => {
      expect(() => TrainingCategorySchema.parse(category)).not.toThrow();
    });
  });

  it('should reject invalid category', () => {
    expect(() => TrainingCategorySchema.parse('yoga')).toThrow();
  });
});

describe('TrainingCompletionStatusSchema', () => {
  it('should accept all valid statuses', () => {
    const statuses = ['not_started', 'in_progress', 'completed', 'failed', 'expired'];

    statuses.forEach((status) => {
      expect(() => TrainingCompletionStatusSchema.parse(status)).not.toThrow();
    });
  });

  it('should reject invalid status', () => {
    expect(() => TrainingCompletionStatusSchema.parse('skipped')).toThrow();
  });
});

describe('TrainingCourseSchema', () => {
  it('should accept valid course with defaults', () => {
    const course = TrainingCourseSchema.parse({
      id: 'COURSE-SEC-001',
      title: 'Information Security Fundamentals',
      description: 'Annual security awareness training for all employees',
      category: 'security_awareness',
      durationMinutes: 60,
      targetRoles: ['all_employees'],
    });

    expect(course.mandatory).toBe(false);
    expect(course.passingScore).toBeUndefined();
    expect(course.validityDays).toBeUndefined();
  });

  it('should accept full course configuration', () => {
    const course: TrainingCourse = {
      id: 'COURSE-SEC-002',
      title: 'Phishing Awareness Training',
      description: 'Recognize and report phishing attempts',
      category: 'phishing_awareness',
      durationMinutes: 30,
      mandatory: true,
      targetRoles: ['all_employees', 'contractors'],
      validityDays: 365,
      passingScore: 80,
      version: '2.0',
    };

    expect(() => TrainingCourseSchema.parse(course)).not.toThrow();
  });

  it('should accept all category types', () => {
    const categories = [
      'security_awareness', 'data_protection', 'incident_response',
      'access_control', 'phishing_awareness', 'compliance',
      'secure_development', 'physical_security', 'business_continuity', 'other',
    ];

    categories.forEach((category) => {
      expect(() => TrainingCourseSchema.parse({
        id: `COURSE-${category}`,
        title: `${category} Training`,
        description: `Training for ${category}`,
        category,
        durationMinutes: 30,
        targetRoles: ['all'],
      })).not.toThrow();
    });
  });

  it('should reject invalid duration', () => {
    expect(() => TrainingCourseSchema.parse({
      id: 'COURSE-001',
      title: 'Test',
      description: 'Test',
      category: 'other',
      durationMinutes: 0,
      targetRoles: ['all'],
    })).toThrow();
  });

  it('should reject passing score out of range', () => {
    expect(() => TrainingCourseSchema.parse({
      id: 'COURSE-001',
      title: 'Test',
      description: 'Test',
      category: 'other',
      durationMinutes: 30,
      targetRoles: ['all'],
      passingScore: 101,
    })).toThrow();

    expect(() => TrainingCourseSchema.parse({
      id: 'COURSE-001',
      title: 'Test',
      description: 'Test',
      category: 'other',
      durationMinutes: 30,
      targetRoles: ['all'],
      passingScore: -1,
    })).toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => TrainingCourseSchema.parse({})).toThrow();
    expect(() => TrainingCourseSchema.parse({ id: 'COURSE-001' })).toThrow();
  });
});

describe('TrainingRecordSchema', () => {
  it('should accept valid completed training record', () => {
    const record: TrainingRecord = {
      courseId: 'COURSE-SEC-001',
      userId: 'user_123',
      status: 'completed',
      assignedAt: 1704067200000,
      completedAt: 1704153600000,
      score: 95,
      expiresAt: 1735689600000,
    };

    expect(() => TrainingRecordSchema.parse(record)).not.toThrow();
  });

  it('should accept minimal not-started record', () => {
    const record = {
      courseId: 'COURSE-SEC-002',
      userId: 'user_456',
      status: 'not_started',
      assignedAt: Date.now(),
    };

    expect(() => TrainingRecordSchema.parse(record)).not.toThrow();
  });

  it('should accept failed record', () => {
    const record = {
      courseId: 'COURSE-SEC-003',
      userId: 'user_789',
      status: 'failed',
      assignedAt: 1704067200000,
      completedAt: 1704153600000,
      score: 45,
      notes: 'Did not meet passing score of 80%',
    };

    expect(() => TrainingRecordSchema.parse(record)).not.toThrow();
  });

  it('should reject score out of range', () => {
    expect(() => TrainingRecordSchema.parse({
      courseId: 'COURSE-001',
      userId: 'user_123',
      status: 'completed',
      assignedAt: Date.now(),
      score: 150,
    })).toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => TrainingRecordSchema.parse({})).toThrow();
    expect(() => TrainingRecordSchema.parse({ courseId: 'COURSE-001' })).toThrow();
  });
});

describe('TrainingPlanSchema', () => {
  it('should accept plan with defaults', () => {
    const plan = TrainingPlanSchema.parse({
      courses: [
        {
          id: 'COURSE-SEC-001',
          title: 'Security Awareness',
          description: 'Annual security training',
          category: 'security_awareness',
          durationMinutes: 60,
          targetRoles: ['all_employees'],
        },
      ],
    });

    expect(plan.enabled).toBe(true);
    expect(plan.recertificationIntervalDays).toBe(365);
    expect(plan.trackCompletion).toBe(true);
    expect(plan.gracePeriodDays).toBe(30);
    expect(plan.sendReminders).toBe(true);
    expect(plan.reminderDaysBefore).toBe(14);
  });

  it('should accept full plan configuration', () => {
    const plan = TrainingPlanSchema.parse({
      enabled: true,
      courses: [
        {
          id: 'COURSE-SEC-001',
          title: 'Security Fundamentals',
          description: 'Core security training',
          category: 'security_awareness',
          durationMinutes: 60,
          mandatory: true,
          targetRoles: ['all_employees'],
          validityDays: 365,
          passingScore: 80,
        },
        {
          id: 'COURSE-SEC-002',
          title: 'Secure Development',
          description: 'Secure coding practices',
          category: 'secure_development',
          durationMinutes: 120,
          mandatory: true,
          targetRoles: ['developers', 'devops'],
          validityDays: 365,
          passingScore: 85,
        },
      ],
      recertificationIntervalDays: 180,
      trackCompletion: true,
      gracePeriodDays: 14,
      sendReminders: true,
      reminderDaysBefore: 30,
    });

    expect(plan.courses).toHaveLength(2);
    expect(plan.recertificationIntervalDays).toBe(180);
    expect(plan.gracePeriodDays).toBe(14);
    expect(plan.reminderDaysBefore).toBe(30);
  });

  it('should accept plan with empty courses', () => {
    const plan = TrainingPlanSchema.parse({
      courses: [],
    });

    expect(plan.courses).toHaveLength(0);
  });

  it('should reject missing courses', () => {
    expect(() => TrainingPlanSchema.parse({})).toThrow();
  });
});

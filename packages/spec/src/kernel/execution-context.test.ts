import { describe, it, expect } from 'vitest';
import { ExecutionContextSchema } from './execution-context.zod';

describe('ExecutionContextSchema', () => {
  it('should accept empty context (all optional)', () => {
    const ctx = ExecutionContextSchema.parse({});
    expect(ctx.positions).toEqual([]);
    expect(ctx.permissions).toEqual([]);
    expect(ctx.isSystem).toBe(false);
  });

  it('should accept full context', () => {
    const ctx = ExecutionContextSchema.parse({
      userId: 'user_123',
      tenantId: 'org_456',
      positions: ['admin', 'editor'],
      permissions: ['read:account', 'write:account'],
      isSystem: false,
      accessToken: 'Bearer abc',
      traceId: 'trace-789',
    });

    expect(ctx.userId).toBe('user_123');
    expect(ctx.tenantId).toBe('org_456');
    expect(ctx.positions).toEqual(['admin', 'editor']);
    expect(ctx.permissions).toEqual(['read:account', 'write:account']);
    expect(ctx.isSystem).toBe(false);
    expect(ctx.accessToken).toBe('Bearer abc');
    expect(ctx.traceId).toBe('trace-789');
  });

  it('should default roles and permissions to empty arrays', () => {
    const ctx = ExecutionContextSchema.parse({ userId: 'u1' });
    expect(ctx.positions).toEqual([]);
    expect(ctx.permissions).toEqual([]);
  });

  it('should default isSystem to false', () => {
    const ctx = ExecutionContextSchema.parse({});
    expect(ctx.isSystem).toBe(false);
  });

  it('should accept system context', () => {
    const ctx = ExecutionContextSchema.parse({ isSystem: true });
    expect(ctx.isSystem).toBe(true);
  });

  it('should accept transaction handle', () => {
    const mockTx = { id: 'tx1', commit: () => {} };
    const ctx = ExecutionContextSchema.parse({ transaction: mockTx });
    expect(ctx.transaction).toBeDefined();
  });
});

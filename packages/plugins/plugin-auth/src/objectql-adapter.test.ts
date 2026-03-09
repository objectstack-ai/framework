// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createObjectQLAdapter,
  AUTH_MODEL_TO_PROTOCOL,
  resolveProtocolName,
  toSnakeCase,
  toCamelCase,
} from './objectql-adapter';
import { SystemObjectName } from '@objectstack/spec/system';
import type { IDataEngine } from '@objectstack/core';

describe('toSnakeCase', () => {
  it('should convert camelCase to snake_case', () => {
    expect(toSnakeCase('providerId')).toBe('provider_id');
    expect(toSnakeCase('accountId')).toBe('account_id');
    expect(toSnakeCase('userId')).toBe('user_id');
    expect(toSnakeCase('accessToken')).toBe('access_token');
    expect(toSnakeCase('refreshToken')).toBe('refresh_token');
    expect(toSnakeCase('idToken')).toBe('id_token');
    expect(toSnakeCase('accessTokenExpiresAt')).toBe('access_token_expires_at');
    expect(toSnakeCase('emailVerified')).toBe('email_verified');
    expect(toSnakeCase('createdAt')).toBe('created_at');
    expect(toSnakeCase('updatedAt')).toBe('updated_at');
    expect(toSnakeCase('ipAddress')).toBe('ip_address');
    expect(toSnakeCase('userAgent')).toBe('user_agent');
  });

  it('should leave single-word and already snake_case strings unchanged', () => {
    expect(toSnakeCase('id')).toBe('id');
    expect(toSnakeCase('email')).toBe('email');
    expect(toSnakeCase('name')).toBe('name');
    expect(toSnakeCase('token')).toBe('token');
    expect(toSnakeCase('scope')).toBe('scope');
    expect(toSnakeCase('password')).toBe('password');
    expect(toSnakeCase('provider_id')).toBe('provider_id');
    expect(toSnakeCase('created_at')).toBe('created_at');
  });
});

describe('toCamelCase', () => {
  it('should convert snake_case to camelCase', () => {
    expect(toCamelCase('provider_id')).toBe('providerId');
    expect(toCamelCase('account_id')).toBe('accountId');
    expect(toCamelCase('user_id')).toBe('userId');
    expect(toCamelCase('access_token')).toBe('accessToken');
    expect(toCamelCase('refresh_token')).toBe('refreshToken');
    expect(toCamelCase('id_token')).toBe('idToken');
    expect(toCamelCase('access_token_expires_at')).toBe('accessTokenExpiresAt');
    expect(toCamelCase('email_verified')).toBe('emailVerified');
    expect(toCamelCase('created_at')).toBe('createdAt');
    expect(toCamelCase('updated_at')).toBe('updatedAt');
    expect(toCamelCase('ip_address')).toBe('ipAddress');
    expect(toCamelCase('user_agent')).toBe('userAgent');
  });

  it('should leave single-word and already camelCase strings unchanged', () => {
    expect(toCamelCase('id')).toBe('id');
    expect(toCamelCase('email')).toBe('email');
    expect(toCamelCase('name')).toBe('name');
    expect(toCamelCase('token')).toBe('token');
    expect(toCamelCase('providerId')).toBe('providerId');
    expect(toCamelCase('createdAt')).toBe('createdAt');
  });
});

describe('AUTH_MODEL_TO_PROTOCOL mapping', () => {
  it('should map all four core better-auth models to sys_ protocol names', () => {
    expect(AUTH_MODEL_TO_PROTOCOL.user).toBe('sys_user');
    expect(AUTH_MODEL_TO_PROTOCOL.session).toBe('sys_session');
    expect(AUTH_MODEL_TO_PROTOCOL.account).toBe('sys_account');
    expect(AUTH_MODEL_TO_PROTOCOL.verification).toBe('sys_verification');
  });

  it('should align with SystemObjectName constants', () => {
    expect(AUTH_MODEL_TO_PROTOCOL.user).toBe(SystemObjectName.USER);
    expect(AUTH_MODEL_TO_PROTOCOL.session).toBe(SystemObjectName.SESSION);
    expect(AUTH_MODEL_TO_PROTOCOL.account).toBe(SystemObjectName.ACCOUNT);
    expect(AUTH_MODEL_TO_PROTOCOL.verification).toBe(SystemObjectName.VERIFICATION);
  });
});

describe('resolveProtocolName', () => {
  it('should resolve core models to sys_ prefixed names', () => {
    expect(resolveProtocolName('user')).toBe('sys_user');
    expect(resolveProtocolName('session')).toBe('sys_session');
    expect(resolveProtocolName('account')).toBe('sys_account');
    expect(resolveProtocolName('verification')).toBe('sys_verification');
  });

  it('should fall back to original name for unknown models', () => {
    expect(resolveProtocolName('organization')).toBe('organization');
    expect(resolveProtocolName('custom_model')).toBe('custom_model');
  });
});

describe('createObjectQLAdapter – model name mapping', () => {
  let mockEngine: IDataEngine;

  beforeEach(() => {
    mockEngine = {
      insert: vi.fn().mockResolvedValue({ id: '1' }),
      findOne: vi.fn().mockResolvedValue({ id: '1' }),
      find: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({ id: '1' }),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as IDataEngine;
  });

  it('create: should call dataEngine.insert with sys_ protocol name', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    await adapter.create({ model: 'user', data: { email: 'a@b.com' } });
    expect(mockEngine.insert).toHaveBeenCalledWith('sys_user', { email: 'a@b.com' });
  });

  it('findOne: should call dataEngine.findOne with sys_ protocol name', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    await adapter.findOne({
      model: 'session',
      where: [{ field: 'token', value: 'abc', operator: 'eq', connector: 'AND' }],
    });
    expect(mockEngine.findOne).toHaveBeenCalledWith('sys_session', expect.objectContaining({
      filter: { token: 'abc' },
    }));
  });

  it('findMany: should call dataEngine.find with sys_ protocol name', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    await adapter.findMany({ model: 'account', limit: 10 });
    expect(mockEngine.find).toHaveBeenCalledWith('sys_account', expect.objectContaining({
      limit: 10,
    }));
  });

  it('count: should call dataEngine.count with sys_ protocol name', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    await adapter.count({ model: 'verification' });
    expect(mockEngine.count).toHaveBeenCalledWith('sys_verification', expect.anything());
  });

  it('update: should call dataEngine with sys_ protocol name', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    await adapter.update({
      model: 'user',
      where: [{ field: 'id', value: '1', operator: 'eq', connector: 'AND' }],
      update: { name: 'New' },
    });
    expect(mockEngine.findOne).toHaveBeenCalledWith('sys_user', expect.anything());
    expect(mockEngine.update).toHaveBeenCalledWith('sys_user', expect.objectContaining({ name: 'New', id: '1' }));
  });

  it('delete: should call dataEngine with sys_ protocol name', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    await adapter.delete({
      model: 'session',
      where: [{ field: 'id', value: '1', operator: 'eq', connector: 'AND' }],
    });
    expect(mockEngine.findOne).toHaveBeenCalledWith('sys_session', expect.anything());
    expect(mockEngine.delete).toHaveBeenCalledWith('sys_session', expect.anything());
  });

  it('should pass through unknown model names unchanged', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    await adapter.create({ model: 'organization', data: { name: 'Acme' } });
    expect(mockEngine.insert).toHaveBeenCalledWith('organization', { name: 'Acme' });
  });
});

describe('createObjectQLAdapter – camelCase ↔ snake_case field mapping', () => {
  let mockEngine: IDataEngine;

  beforeEach(() => {
    mockEngine = {
      insert: vi.fn().mockResolvedValue({ id: '1', provider_id: 'credential', account_id: 'u1', user_id: 'u1', created_at: '2026-01-01' }),
      findOne: vi.fn().mockResolvedValue({ id: '1', provider_id: 'credential', account_id: 'u1', user_id: 'u1', created_at: '2026-01-01' }),
      find: vi.fn().mockResolvedValue([
        { id: '1', provider_id: 'credential', account_id: 'u1', user_id: 'u1' },
        { id: '2', provider_id: 'google', account_id: 'u2', user_id: 'u2' },
      ]),
      count: vi.fn().mockResolvedValue(2),
      update: vi.fn().mockResolvedValue({ id: '1', provider_id: 'credential', account_id: 'u1', user_id: 'u1', updated_at: '2026-01-02' }),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as IDataEngine;
  });

  it('create: should convert camelCase data keys to snake_case and return camelCase result', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    const result = await adapter.create({
      model: 'account',
      data: { providerId: 'credential', accountId: 'u1', userId: 'u1' },
    });
    expect(mockEngine.insert).toHaveBeenCalledWith('sys_account', {
      provider_id: 'credential',
      account_id: 'u1',
      user_id: 'u1',
    });
    expect(result).toHaveProperty('providerId', 'credential');
    expect(result).toHaveProperty('accountId', 'u1');
    expect(result).toHaveProperty('userId', 'u1');
    expect(result).toHaveProperty('createdAt', '2026-01-01');
  });

  it('findOne: should convert camelCase where fields to snake_case and return camelCase result', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    const result = await adapter.findOne({
      model: 'account',
      where: [
        { field: 'providerId', value: 'credential', operator: 'eq', connector: 'AND' },
        { field: 'accountId', value: 'u1', operator: 'eq', connector: 'AND' },
      ],
    });
    expect(mockEngine.findOne).toHaveBeenCalledWith('sys_account', expect.objectContaining({
      filter: { provider_id: 'credential', account_id: 'u1' },
    }));
    expect(result).toHaveProperty('providerId', 'credential');
    expect(result).toHaveProperty('accountId', 'u1');
  });

  it('findMany: should convert camelCase sortBy field to snake_case and return camelCase results', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    const results = await adapter.findMany({
      model: 'account',
      where: [{ field: 'userId', value: 'u1', operator: 'eq', connector: 'AND' }],
      limit: 10,
      sortBy: { field: 'createdAt', direction: 'desc' },
    });
    expect(mockEngine.find).toHaveBeenCalledWith('sys_account', expect.objectContaining({
      filter: { user_id: 'u1' },
      sort: [{ field: 'created_at', order: 'desc' }],
    }));
    expect(results[0]).toHaveProperty('providerId', 'credential');
    expect(results[1]).toHaveProperty('providerId', 'google');
  });

  it('update: should convert camelCase update keys to snake_case and return camelCase result', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    const result = await adapter.update({
      model: 'account',
      where: [{ field: 'providerId', value: 'credential', operator: 'eq', connector: 'AND' }],
      update: { accessToken: 'new-token', refreshToken: 'new-refresh' },
    });
    expect(mockEngine.findOne).toHaveBeenCalledWith('sys_account', expect.objectContaining({
      filter: { provider_id: 'credential' },
    }));
    expect(mockEngine.update).toHaveBeenCalledWith('sys_account', expect.objectContaining({
      access_token: 'new-token',
      refresh_token: 'new-refresh',
      id: '1',
    }));
    expect(result).toHaveProperty('updatedAt', '2026-01-02');
  });

  it('findOne: should convert select fields from camelCase to snake_case', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    await adapter.findOne({
      model: 'account',
      where: [{ field: 'id', value: '1', operator: 'eq', connector: 'AND' }],
      select: ['providerId', 'accountId', 'userId'],
    });
    expect(mockEngine.findOne).toHaveBeenCalledWith('sys_account', expect.objectContaining({
      select: ['provider_id', 'account_id', 'user_id'],
    }));
  });

  it('count: should convert camelCase where fields to snake_case', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    await adapter.count({
      model: 'account',
      where: [{ field: 'providerId', value: 'credential', operator: 'eq', connector: 'AND' }],
    });
    expect(mockEngine.count).toHaveBeenCalledWith('sys_account', expect.objectContaining({
      filter: { provider_id: 'credential' },
    }));
  });

  it('should handle the exact sign-in scenario: findOne account by providerId + accountId', async () => {
    const adapter = createObjectQLAdapter(mockEngine);
    // This is the exact query pattern better-auth uses during sign-in
    const result = await adapter.findOne({
      model: 'account',
      where: [
        { field: 'providerId', value: 'credential', operator: 'eq', connector: 'AND' },
        { field: 'accountId', value: 'sys_user-1', operator: 'eq', connector: 'AND' },
      ],
    });
    expect(mockEngine.findOne).toHaveBeenCalledWith('sys_account', expect.objectContaining({
      filter: { provider_id: 'credential', account_id: 'sys_user-1' },
    }));
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('providerId', 'credential');
  });
});

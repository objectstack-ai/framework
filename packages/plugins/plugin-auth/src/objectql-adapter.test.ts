// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createObjectQLAdapter,
  createObjectQLAdapterFactory,
  AUTH_MODEL_TO_PROTOCOL,
  resolveProtocolName,
} from './objectql-adapter';
import {
  AUTH_USER_CONFIG,
  AUTH_SESSION_CONFIG,
  AUTH_ACCOUNT_CONFIG,
  AUTH_VERIFICATION_CONFIG,
} from './auth-schema-config';
import { SystemObjectName } from '@objectstack/spec/system';
import type { IDataEngine } from '@objectstack/core';

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

describe('AUTH_*_CONFIG schema mappings', () => {
  it('should define correct modelName for all core models', () => {
    expect(AUTH_USER_CONFIG.modelName).toBe('sys_user');
    expect(AUTH_SESSION_CONFIG.modelName).toBe('sys_session');
    expect(AUTH_ACCOUNT_CONFIG.modelName).toBe('sys_account');
    expect(AUTH_VERIFICATION_CONFIG.modelName).toBe('sys_verification');
  });

  it('should map user camelCase fields to snake_case', () => {
    expect(AUTH_USER_CONFIG.fields).toEqual({
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    });
  });

  it('should map session camelCase fields to snake_case', () => {
    expect(AUTH_SESSION_CONFIG.fields).toEqual({
      userId: 'user_id',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
    });
  });

  it('should map account camelCase fields to snake_case', () => {
    expect(AUTH_ACCOUNT_CONFIG.fields).toEqual({
      userId: 'user_id',
      providerId: 'provider_id',
      accountId: 'account_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    });
  });

  it('should map verification camelCase fields to snake_case', () => {
    expect(AUTH_VERIFICATION_CONFIG.fields).toEqual({
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    });
  });
});

describe('createObjectQLAdapterFactory', () => {
  it('should return a function (adapter factory)', () => {
    const mockEngine = {
      insert: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as IDataEngine;

    const factory = createObjectQLAdapterFactory(mockEngine);
    expect(typeof factory).toBe('function');
  });
});

describe('createObjectQLAdapter – legacy model name mapping', () => {
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

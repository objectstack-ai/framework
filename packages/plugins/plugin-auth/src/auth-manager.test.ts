// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthManager } from './auth-manager';

// Mock better-auth so we can control the handler behaviour
vi.mock('better-auth', () => ({
  betterAuth: vi.fn(() => ({
    handler: vi.fn(),
    api: {},
  })),
}));

// Mock plugin imports — we only need to verify they are called with the
// correct schema options; the actual plugin logic is tested by better-auth.
vi.mock('better-auth/plugins/organization', () => ({
  organization: vi.fn((opts: any) => ({ id: 'organization', _opts: opts })),
}));

vi.mock('better-auth/plugins/two-factor', () => ({
  twoFactor: vi.fn((opts: any) => ({ id: 'two-factor', _opts: opts })),
}));

vi.mock('better-auth/plugins/magic-link', () => ({
  magicLink: vi.fn((_opts?: any) => ({ id: 'magic-link' })),
}));

import { betterAuth } from 'better-auth';

describe('AuthManager', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('handleRequest – error response logging', () => {
    it('should log when better-auth returns a 500 response', async () => {
      const errorResponse = new Response(
        JSON.stringify({ error: 'Internal database error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );

      const mockHandler = vi.fn().mockResolvedValue(errorResponse);
      (betterAuth as any).mockReturnValue({ handler: mockHandler, api: {} });

      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });

      const request = new Request('http://localhost:3000/sign-up/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'pass' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await manager.handleRequest(request);

      expect(response.status).toBe(500);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AuthManager] better-auth returned error:',
        500,
        expect.stringContaining('Internal database error'),
      );
    });

    it('should NOT log for successful (2xx) responses', async () => {
      const okResponse = new Response(JSON.stringify({ user: {} }), {
        status: 200,
      });

      const mockHandler = vi.fn().mockResolvedValue(okResponse);
      (betterAuth as any).mockReturnValue({ handler: mockHandler, api: {} });

      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });

      const request = new Request('http://localhost:3000/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'pass' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await manager.handleRequest(request);

      expect(response.status).toBe(200);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should NOT log for 4xx responses', async () => {
      const badRequestResponse = new Response(
        JSON.stringify({ error: 'Bad request' }),
        { status: 400 },
      );

      const mockHandler = vi.fn().mockResolvedValue(badRequestResponse);
      (betterAuth as any).mockReturnValue({ handler: mockHandler, api: {} });

      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });

      const request = new Request('http://localhost:3000/sign-in/email', {
        method: 'POST',
      });

      const response = await manager.handleRequest(request);

      expect(response.status).toBe(400);
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('createDatabaseConfig – adapter wrapping', () => {
    it('should pass a function (AdapterFactory) to betterAuth when dataEngine is provided', () => {
      const mockDataEngine = {
        insert: vi.fn(),
        findOne: vi.fn(),
        find: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };

      new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        dataEngine: mockDataEngine as any,
      });

      // Trigger lazy initialization by calling getAuthInstance()
      // betterAuth should have been called with a database value that is a function
      // We need to trigger the lazy init first
    });

    it('should provide a factory function as database config', () => {
      const mockDataEngine = {
        insert: vi.fn().mockResolvedValue({ id: '1' }),
        findOne: vi.fn().mockResolvedValue({ id: '1' }),
        find: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({ id: '1' }),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      let capturedConfig: any;
      (betterAuth as any).mockImplementation((config: any) => {
        capturedConfig = config;
        return { handler: vi.fn(), api: {} };
      });

      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        dataEngine: mockDataEngine as any,
      });

      // Trigger lazy initialisation
      manager.getAuthInstance();

      // The database config should be a function (AdapterFactory)
      expect(typeof capturedConfig.database).toBe('function');
    });

    it('should include modelName and fields mapping for user, session, account, verification', () => {
      const mockDataEngine = {
        insert: vi.fn().mockResolvedValue({ id: '1' }),
        findOne: vi.fn().mockResolvedValue({ id: '1' }),
        find: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({ id: '1' }),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      let capturedConfig: any;
      (betterAuth as any).mockImplementation((config: any) => {
        capturedConfig = config;
        return { handler: vi.fn(), api: {} };
      });

      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        dataEngine: mockDataEngine as any,
      });

      manager.getAuthInstance();

      // Verify user model config
      expect(capturedConfig.user).toBeDefined();
      expect(capturedConfig.user.modelName).toBe('sys_user');
      expect(capturedConfig.user.fields).toEqual(expect.objectContaining({
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }));

      // Verify session model config (merged with session timing config)
      expect(capturedConfig.session).toBeDefined();
      expect(capturedConfig.session.modelName).toBe('sys_session');
      expect(capturedConfig.session.fields).toEqual(expect.objectContaining({
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
      }));

      // Verify account model config
      expect(capturedConfig.account).toBeDefined();
      expect(capturedConfig.account.modelName).toBe('sys_account');
      expect(capturedConfig.account.fields).toEqual(expect.objectContaining({
        userId: 'user_id',
        providerId: 'provider_id',
        accountId: 'account_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
      }));

      // Verify verification model config
      expect(capturedConfig.verification).toBeDefined();
      expect(capturedConfig.verification.modelName).toBe('sys_verification');
      expect(capturedConfig.verification.fields).toEqual(expect.objectContaining({
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }));
    });

    it('should return undefined (in-memory fallback) when no dataEngine is provided', () => {
      let capturedConfig: any;
      (betterAuth as any).mockImplementation((config: any) => {
        capturedConfig = config;
        return { handler: vi.fn(), api: {} };
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });

      manager.getAuthInstance();

      expect(capturedConfig.database).toBeUndefined();
      warnSpy.mockRestore();
    });
  });

  describe('plugin registration', () => {
    it('should not include any plugins when no plugin config is provided', () => {
      let capturedConfig: any;
      (betterAuth as any).mockImplementation((config: any) => {
        capturedConfig = config;
        return { handler: vi.fn(), api: {} };
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });
      manager.getAuthInstance();
      warnSpy.mockRestore();

      expect(capturedConfig.plugins).toEqual([]);
    });

    it('should register organization plugin with schema mapping when enabled', () => {
      let capturedConfig: any;
      (betterAuth as any).mockImplementation((config: any) => {
        capturedConfig = config;
        return { handler: vi.fn(), api: {} };
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        plugins: { organization: true },
      });
      manager.getAuthInstance();
      warnSpy.mockRestore();

      const orgPlugin = capturedConfig.plugins.find((p: any) => p.id === 'organization');
      expect(orgPlugin).toBeDefined();
      // Verify schema was passed to organization() call
      expect(orgPlugin._opts.schema.organization.modelName).toBe('sys_organization');
      expect(orgPlugin._opts.schema.member.modelName).toBe('sys_member');
      expect(orgPlugin._opts.schema.invitation.modelName).toBe('sys_invitation');
      expect(orgPlugin._opts.schema.team.modelName).toBe('sys_team');
      expect(orgPlugin._opts.schema.teamMember.modelName).toBe('sys_team_member');
      expect(orgPlugin._opts.schema.session.fields.activeOrganizationId).toBe('active_organization_id');
    });

    it('should register twoFactor plugin with schema mapping when enabled', () => {
      let capturedConfig: any;
      (betterAuth as any).mockImplementation((config: any) => {
        capturedConfig = config;
        return { handler: vi.fn(), api: {} };
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        plugins: { twoFactor: true },
      });
      manager.getAuthInstance();
      warnSpy.mockRestore();

      const tfPlugin = capturedConfig.plugins.find((p: any) => p.id === 'two-factor');
      expect(tfPlugin).toBeDefined();
      expect(tfPlugin._opts.schema.twoFactor.modelName).toBe('sys_two_factor');
      expect(tfPlugin._opts.schema.twoFactor.fields.backupCodes).toBe('backup_codes');
      expect(tfPlugin._opts.schema.twoFactor.fields.userId).toBe('user_id');
      expect(tfPlugin._opts.schema.user.fields.twoFactorEnabled).toBe('two_factor_enabled');
    });

    it('should register magicLink plugin when enabled', () => {
      let capturedConfig: any;
      (betterAuth as any).mockImplementation((config: any) => {
        capturedConfig = config;
        return { handler: vi.fn(), api: {} };
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        plugins: { magicLink: true },
      });
      manager.getAuthInstance();
      warnSpy.mockRestore();

      const mlPlugin = capturedConfig.plugins.find((p: any) => p.id === 'magic-link');
      expect(mlPlugin).toBeDefined();
    });

    it('should register multiple plugins when multiple flags are enabled', () => {
      let capturedConfig: any;
      (betterAuth as any).mockImplementation((config: any) => {
        capturedConfig = config;
        return { handler: vi.fn(), api: {} };
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        plugins: { organization: true, twoFactor: true, magicLink: true },
      });
      manager.getAuthInstance();
      warnSpy.mockRestore();

      expect(capturedConfig.plugins).toHaveLength(3);
      expect(capturedConfig.plugins.map((p: any) => p.id).sort()).toEqual(
        ['magic-link', 'organization', 'two-factor'],
      );
    });
  });
});

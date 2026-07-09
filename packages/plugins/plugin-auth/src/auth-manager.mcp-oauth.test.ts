// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MCP OAuth 2.1 track (#2698) — authorization-server wiring + the
 * resource-server half that lives on AuthManager.
 *
 * Token verification tests use REAL jose-signed JWTs against a locally
 * generated JWKS (mocked `getApi().getJwks`), so the crypto path — signature,
 * issuer, audience, expiry — is exercised for real, fail-closed on each axis.
 * The full discovery → DCR → PKCE browser flow is covered end-to-end against
 * a live dev server (see the PR's verification notes); better-auth's own
 * endpoint behavior is not re-tested here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import { MCP_OAUTH_SCOPES } from '@objectstack/spec/ai';

import {
  AuthManager,
  resolveOidcProviderEnabled,
  resolveDcrEnabled,
  isOAuthEligibleBaseUrl,
} from './auth-manager';

// Mock better-auth so plugin-registration tests can capture the config
// without booting a real instance (same pattern as auth-manager.test.ts).
vi.mock('better-auth', () => ({
  betterAuth: vi.fn(() => ({ handler: vi.fn(), api: {} })),
}));
vi.mock('@better-auth/oauth-provider', () => ({
  oauthProvider: vi.fn((opts: any) => ({ id: 'oauth-provider', _opts: opts })),
}));

import { betterAuth } from 'better-auth';
import { oauthProvider } from '@better-auth/oauth-provider';

const ENV_KEYS = ['OS_MCP_SERVER_ENABLED', 'OS_OIDC_PROVIDER_ENABLED', 'OS_OIDC_DCR_ENABLED'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('isOAuthEligibleBaseUrl (OAuth 2.1 TLS rule, loopback exempt)', () => {
  it.each([
    ['https://acme.example.com', true],
    ['https://intranet.corp', true],
    ['http://localhost:3000', true],
    ['http://127.0.0.1:8080', true],
    ['http://[::1]:3000', true],
    ['http://myapp.localhost:3000', true],
    ['http://intranet.corp:3000', false],
    ['http://10.0.0.5', false],
    ['ftp://localhost', false],
    ['not a url', false],
  ])('%s → %s', (url, expected) => {
    expect(isOAuthEligibleBaseUrl(url)).toBe(expected);
  });
});

describe('enable-flag resolution (env → config → follows MCP surface)', () => {
  it('defaults OFF when neither env nor config nor MCP is on', () => {
    expect(resolveOidcProviderEnabled({})).toBe(false);
    expect(resolveDcrEnabled({})).toBe(false);
  });

  it('follows OS_MCP_SERVER_ENABLED (the self-serve MCP connect default)', () => {
    process.env.OS_MCP_SERVER_ENABLED = 'true';
    expect(resolveOidcProviderEnabled({})).toBe(true);
    expect(resolveDcrEnabled({})).toBe(true);
  });

  it('explicit env override wins over the MCP default (operator can force off)', () => {
    process.env.OS_MCP_SERVER_ENABLED = 'true';
    process.env.OS_OIDC_PROVIDER_ENABLED = 'false';
    process.env.OS_OIDC_DCR_ENABLED = 'false';
    expect(resolveOidcProviderEnabled({})).toBe(false);
    expect(resolveDcrEnabled({})).toBe(false);
  });

  it('config file wins over the MCP default but loses to env', () => {
    expect(resolveOidcProviderEnabled({ oidcProvider: true })).toBe(true);
    expect(resolveDcrEnabled({ dynamicClientRegistration: true } as any)).toBe(true);
    process.env.OS_OIDC_PROVIDER_ENABLED = 'false';
    expect(resolveOidcProviderEnabled({ oidcProvider: true })).toBe(false);
  });
});

describe('canonical issuer / resource URLs', () => {
  const manager = () =>
    new AuthManager({
      secret: 'test-secret-at-least-32-chars-long',
      baseUrl: 'https://acme.example.com',
    });

  it('issuer = baseUrl + auth basePath (matches the jwt plugin iss claim)', () => {
    expect(manager().getAuthIssuer()).toBe('https://acme.example.com/api/v1/auth');
  });

  it('MCP resource = baseUrl + api prefix + /mcp (derived from the auth basePath)', () => {
    expect(manager().getMcpResourceUrl()).toBe('https://acme.example.com/api/v1/mcp');
  });

  it('protected-resource metadata points at THIS deployment as the AS and lists the MCP scopes', () => {
    process.env.OS_MCP_SERVER_ENABLED = 'true';
    const md = manager().getMcpProtectedResourceMetadata() as any;
    expect(md.resource).toBe('https://acme.example.com/api/v1/mcp');
    expect(md.authorization_servers).toEqual(['https://acme.example.com/api/v1/auth']);
    for (const scope of MCP_OAUTH_SCOPES) expect(md.scopes_supported).toContain(scope);
    expect(md.scopes_supported).toContain('offline_access');
    expect(md.bearer_methods_supported).toEqual(['header']);
  });

  it('resource metadata URL is null when the AS is off (nothing advertised, fail-closed)', () => {
    expect(manager().getMcpResourceMetadataUrl()).toBeNull();
  });

  it('resource metadata URL is null on plain-HTTP non-loopback even with the AS on (TLS rule)', () => {
    process.env.OS_MCP_SERVER_ENABLED = 'true';
    const m = new AuthManager({
      secret: 'test-secret-at-least-32-chars-long',
      baseUrl: 'http://intranet.corp:3000',
    });
    expect(m.isMcpOAuthEnabled()).toBe(false);
    expect(m.getMcpResourceMetadataUrl()).toBeNull();
  });

  it('advertises the metadata URL when MCP + AS are on over an eligible origin', () => {
    process.env.OS_MCP_SERVER_ENABLED = 'true';
    expect(manager().getMcpResourceMetadataUrl()).toBe(
      'https://acme.example.com/.well-known/oauth-protected-resource',
    );
  });
});

describe('verifyMcpAccessToken (local JWKS verification, fail-closed)', () => {
  const ISSUER = 'https://acme.example.com/api/v1/auth';
  const AUDIENCE = 'https://acme.example.com/api/v1/mcp';

  let privateKey: CryptoKey;
  let jwks: { keys: any[] };

  beforeEach(async () => {
    process.env.OS_MCP_SERVER_ENABLED = 'true';
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey as CryptoKey;
    const jwk = await exportJWK(pair.publicKey);
    jwks = { keys: [{ ...jwk, alg: 'RS256', kid: 'test-key' }] };
  });

  function manager(): AuthManager {
    const m = new AuthManager({
      secret: 'test-secret-at-least-32-chars-long',
      baseUrl: 'https://acme.example.com',
    });
    vi.spyOn(m, 'getApi').mockResolvedValue({ getJwks: async () => jwks } as any);
    return m;
  }

  function signToken(overrides: Record<string, unknown> = {}, opts: { expired?: boolean } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const jwt = new SignJWT({
      scope: 'data:read data:write',
      azp: 'client-abc',
      ...overrides,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer((overrides.iss as string) ?? ISSUER)
      .setAudience((overrides.aud as string) ?? AUDIENCE)
      .setSubject((overrides.sub as string) ?? 'user-1')
      .setIssuedAt(opts.expired ? now - 7200 : now)
      .setExpirationTime(opts.expired ? now - 3600 : now + 3600);
    return jwt.sign(privateKey);
  }

  it('resolves the principal + scopes + client from a valid token', async () => {
    const token = await signToken();
    const res = await manager().verifyMcpAccessToken(token);
    expect(res).toEqual({ userId: 'user-1', scopes: ['data:read', 'data:write'], clientId: 'client-abc' });
  });

  it('rejects an expired token', async () => {
    const token = await signToken({}, { expired: true });
    expect(await manager().verifyMcpAccessToken(token)).toBeNull();
  });

  it('rejects a token minted for a DIFFERENT audience (no cross-resource replay)', async () => {
    const token = await signToken({ aud: 'https://acme.example.com/api/v1/auth/oauth2/userinfo' });
    expect(await manager().verifyMcpAccessToken(token)).toBeNull();
  });

  it('rejects a token from a different issuer', async () => {
    const token = await signToken({ iss: 'https://evil.example.com/api/v1/auth' });
    expect(await manager().verifyMcpAccessToken(token)).toBeNull();
  });

  it('rejects a token signed by an UNKNOWN key (signature check is real)', async () => {
    const rogue = await generateKeyPair('RS256');
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ scope: 'data:read' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject('user-1')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(rogue.privateKey as CryptoKey);
    expect(await manager().verifyMcpAccessToken(token)).toBeNull();
  });

  it('rejects a sub-less (client-credentials / M2M) token — MCP is principal-bound', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ scope: 'data:read' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);
    expect(await manager().verifyMcpAccessToken(token)).toBeNull();
  });

  it('rejects garbage / non-JWT input without touching the JWKS', async () => {
    const m = manager();
    expect(await m.verifyMcpAccessToken('')).toBeNull();
    expect(await m.verifyMcpAccessToken('osk_not_a_jwt')).toBeNull();
    expect(await m.verifyMcpAccessToken('a.b')).toBeNull();
    expect(m.getApi).not.toHaveBeenCalled();
  });

  it('rejects every token when the OAuth track is off (provider disabled)', async () => {
    delete process.env.OS_MCP_SERVER_ENABLED;
    const token = await signToken();
    expect(await manager().verifyMcpAccessToken(token)).toBeNull();
  });
});

describe('oauthProvider plugin wiring (DCR + scopes + audiences)', () => {
  async function capturePluginOpts(env: Record<string, string>): Promise<any> {
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    (betterAuth as any).mockImplementation((config: any) => ({ handler: vi.fn(), api: {}, _cfg: config }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const manager = new AuthManager({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'https://acme.example.com',
      });
      await manager.getAuthInstance();
    } finally {
      warnSpy.mockRestore();
    }
    const call = (oauthProvider as any).mock.calls.at(-1);
    return call?.[0];
  }

  it('enables DCR (incl. unauthenticated) and advertises MCP scopes when the MCP surface is on', async () => {
    const opts = await capturePluginOpts({ OS_MCP_SERVER_ENABLED: 'true' });
    expect(opts).toBeDefined();
    expect(opts.allowDynamicClientRegistration).toBe(true);
    expect(opts.allowUnauthenticatedClientRegistration).toBe(true);
    for (const scope of MCP_OAUTH_SCOPES) expect(opts.scopes).toContain(scope);
    expect(opts.scopes).toEqual(expect.arrayContaining(['openid', 'profile', 'email', 'offline_access']));
    // RFC 8707: the MCP resource must be a valid audience or token minting fails.
    expect(opts.validAudiences).toContain('https://acme.example.com/api/v1/mcp');
    expect(opts.validAudiences).toContain('https://acme.example.com/api/v1/auth');
  });

  it('OS_OIDC_DCR_ENABLED=false forces DCR off even with MCP on', async () => {
    const opts = await capturePluginOpts({ OS_MCP_SERVER_ENABLED: 'true', OS_OIDC_DCR_ENABLED: 'false' });
    expect(opts.allowDynamicClientRegistration).toBe(false);
    expect(opts.allowUnauthenticatedClientRegistration).toBe(false);
  });

  it('does not register the oauthProvider plugin at all when nothing enables it', async () => {
    await capturePluginOpts({});
    expect((oauthProvider as any).mock.calls.length).toBe(0);
  });
});

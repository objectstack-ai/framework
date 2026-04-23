// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Better-Auth Configuration Protocol
 * 
 * Defines the configuration required to initialize the Better-Auth kernel.
 * Used in server-side configuration injection.
 */

export const AuthProviderConfigSchema = z.object({
  id: z.string().describe('Provider ID (github, google)'),
  clientId: z.string().describe('OAuth Client ID'),
  clientSecret: z.string().describe('OAuth Client Secret'),
  scope: z.array(z.string()).optional().describe('Requested permissions'),
});

export const AuthPluginConfigSchema = z.object({
  organization: z.boolean().default(false).describe('Enable Organization/Teams support'),
  twoFactor: z.boolean().default(false).describe('Enable 2FA'),
  passkeys: z.boolean().default(false).describe('Enable Passkey support'),
  magicLink: z.boolean().default(false).describe('Enable Magic Link login'),
});

/**
 * Mutual TLS (mTLS) Configuration Schema
 * 
 * Enables client certificate authentication for zero-trust architectures.
 */
export const MutualTLSConfigSchema = z.object({
  /** Enable mutual TLS authentication */
  enabled: z.boolean()
    .default(false)
    .describe('Enable mutual TLS authentication'),

  /** Require client certificates for all connections */
  clientCertRequired: z.boolean()
    .default(false)
    .describe('Require client certificates for all connections'),

  /** PEM-encoded CA certificates or file paths for trust validation */
  trustedCAs: z.array(z.string())
    .describe('PEM-encoded CA certificates or file paths'),

  /** Certificate Revocation List URL */
  crlUrl: z.string()
    .optional()
    .describe('Certificate Revocation List (CRL) URL'),

  /** Online Certificate Status Protocol URL */
  ocspUrl: z.string()
    .optional()
    .describe('Online Certificate Status Protocol (OCSP) URL'),

  /** Certificate validation strictness level */
  certificateValidation: z.enum(['strict', 'relaxed', 'none'])
    .describe('Certificate validation strictness level'),

  /** Allowed Common Names on client certificates */
  allowedCNs: z.array(z.string())
    .optional()
    .describe('Allowed Common Names (CN) on client certificates'),

  /** Allowed Organizational Units on client certificates */
  allowedOUs: z.array(z.string())
    .optional()
    .describe('Allowed Organizational Units (OU) on client certificates'),

  /** Certificate pinning configuration */
  pinning: z.object({
    /** Enable certificate pinning */
    enabled: z.boolean().describe('Enable certificate pinning'),
    /** Array of pinned certificate hashes */
    pins: z.array(z.string()).describe('Pinned certificate hashes'),
  })
    .optional()
    .describe('Certificate pinning configuration'),
});

export type MutualTLSConfig = z.infer<typeof MutualTLSConfigSchema>;

/**
 * Social / OAuth Provider Configuration
 *
 * Maps provider id → { clientId, clientSecret, ... }.
 * Keys must match Better-Auth built-in provider names (google, github, etc.).
 */
export const SocialProviderConfigSchema = z.record(
  z.string(),
  z.object({
    clientId: z.string().describe('OAuth Client ID'),
    clientSecret: z.string().describe('OAuth Client Secret'),
    enabled: z.boolean().optional().describe('Enable this provider (default: true)'),
    scope: z.array(z.string()).optional().describe('Additional OAuth scopes'),
  }).catchall(z.unknown()),
).optional().describe(
  'Social/OAuth provider map forwarded to better-auth socialProviders. ' +
  'Keys are provider ids (google, github, apple, …).'
);

/**
 * OIDC / Generic OAuth2 Provider Configuration
 *
 * Used for enterprise SSO via better-auth's genericOAuth plugin.
 * Supports any OIDC-compliant provider (Okta, Azure AD, Keycloak, etc.)
 * by specifying a discovery URL.
 */
export const OidcProviderConfigSchema = z.object({
  providerId: z.string().describe('Unique identifier for this provider (e.g., okta, azure-ad)'),
  name: z.string().optional().describe('Display name shown in the UI (defaults to providerId)'),
  discoveryUrl: z.string().optional().describe(
    'OIDC discovery URL (.well-known/openid-configuration). ' +
    'When provided, authorizationUrl/tokenUrl/userInfoUrl are fetched automatically.'
  ),
  issuer: z.string().optional().describe('Expected issuer identifier for token validation'),
  authorizationUrl: z.string().optional().describe('OAuth2 authorization endpoint (optional if discoveryUrl is set)'),
  tokenUrl: z.string().optional().describe('OAuth2 token endpoint (optional if discoveryUrl is set)'),
  userInfoUrl: z.string().optional().describe('OAuth2 userinfo endpoint (optional if discoveryUrl is set)'),
  clientId: z.string().describe('OAuth2 client ID'),
  clientSecret: z.string().describe('OAuth2 client secret'),
  scopes: z.array(z.string()).optional().describe('Requested scopes (default: openid email profile)'),
  pkce: z.boolean().optional().describe('Enable PKCE (recommended for public clients)'),
}).describe('OIDC / Generic OAuth2 provider configuration for enterprise SSO');

export const OidcProvidersConfigSchema = z.array(OidcProviderConfigSchema).optional().describe(
  'List of OIDC/OAuth2 providers for enterprise SSO. ' +
  'Can also be provided via OIDC_PROVIDERS env var as a JSON array.'
);

export type OidcProviderConfig = z.infer<typeof OidcProviderConfigSchema>;
export type OidcProvidersConfig = z.infer<typeof OidcProvidersConfigSchema>;


export const EmailAndPasswordConfigSchema = z.object({
  enabled: z.boolean().default(true).describe('Enable email/password auth'),
  disableSignUp: z.boolean().optional().describe('Disable new user registration via email/password'),
  requireEmailVerification: z.boolean().optional().describe(
    'Require email verification before creating a session'
  ),
  minPasswordLength: z.number().optional().describe('Minimum password length (default 8)'),
  maxPasswordLength: z.number().optional().describe('Maximum password length (default 128)'),
  resetPasswordTokenExpiresIn: z.number().optional().describe(
    'Reset-password token TTL in seconds (default 3600)'
  ),
  autoSignIn: z.boolean().optional().describe('Auto sign-in after sign-up (default true)'),
  revokeSessionsOnPasswordReset: z.boolean().optional().describe(
    'Revoke all other sessions on password reset'
  ),
}).optional().describe('Email and password authentication options forwarded to better-auth');

/**
 * Email Verification Configuration
 */
export const EmailVerificationConfigSchema = z.object({
  sendOnSignUp: z.boolean().optional().describe(
    'Automatically send verification email after sign-up'
  ),
  sendOnSignIn: z.boolean().optional().describe(
    'Send verification email on sign-in when not yet verified'
  ),
  autoSignInAfterVerification: z.boolean().optional().describe(
    'Auto sign-in the user after email verification'
  ),
  expiresIn: z.number().optional().describe(
    'Verification token TTL in seconds (default 3600)'
  ),
}).optional().describe('Email verification options forwarded to better-auth');

/**
 * Advanced / Low-level Better-Auth Options
 */
export const AdvancedAuthConfigSchema = z.object({
  crossSubDomainCookies: z.object({
    enabled: z.boolean().describe('Enable cross-subdomain cookies'),
    additionalCookies: z.array(z.string()).optional().describe('Extra cookies shared across subdomains'),
    domain: z.string().optional().describe(
      'Cookie domain override — defaults to root domain derived from baseUrl'
    ),
  }).optional().describe(
    'Share auth cookies across subdomains (critical for *.example.com multi-tenant)'
  ),
  useSecureCookies: z.boolean().optional().describe('Force Secure flag on cookies'),
  disableCSRFCheck: z.boolean().optional().describe(
    '⚠ Disable CSRF check — security risk, use with caution'
  ),
  cookiePrefix: z.string().optional().describe('Prefix for auth cookie names'),
}).optional().describe('Advanced / low-level Better-Auth options');

export const AuthConfigSchema = z.object({
  secret: z.string().optional().describe('Encryption secret'),
  baseUrl: z.string().optional().describe('Base URL for auth routes'),
  databaseUrl: z.string().optional().describe('Database connection string'),
  providers: z.array(AuthProviderConfigSchema).optional(),
  plugins: AuthPluginConfigSchema.optional(),
  session: z.object({
    expiresIn: z.number().default(60 * 60 * 24 * 7).describe('Session duration in seconds'),
    updateAge: z.number().default(60 * 60 * 24).describe('Session update frequency'),
  }).optional(),
  trustedOrigins: z.array(z.string()).optional().describe(
    'Trusted origins for CSRF protection. Supports wildcards (e.g. "https://*.example.com"). ' +
    'The baseUrl origin is always trusted implicitly.'
  ),
  socialProviders: SocialProviderConfigSchema,
  oidcProviders: OidcProvidersConfigSchema,
  emailAndPassword: EmailAndPasswordConfigSchema,
  emailVerification: EmailVerificationConfigSchema,
  advanced: AdvancedAuthConfigSchema,
  mutualTls: MutualTLSConfigSchema.optional().describe('Mutual TLS (mTLS) configuration'),
}).catchall(z.unknown());

export type AuthProviderConfig = z.infer<typeof AuthProviderConfigSchema>;
export type AuthPluginConfig = z.infer<typeof AuthPluginConfigSchema>;
export type SocialProviderConfig = z.infer<typeof SocialProviderConfigSchema>;
export type EmailAndPasswordConfig = z.infer<typeof EmailAndPasswordConfigSchema>;
export type EmailVerificationConfig = z.infer<typeof EmailVerificationConfigSchema>;
export type AdvancedAuthConfig = z.infer<typeof AdvancedAuthConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IAuthService - Authentication Service Contract
 *
 * Defines the interface for authentication and session management in ObjectStack.
 * Concrete implementations (better-auth, custom, LDAP, etc.)
 * should implement this interface.
 *
 * Follows Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete auth provider implementations.
 *
 * Aligned with CoreServiceName 'auth' in core-services.zod.ts.
 */

/**
 * Authenticated session user information
 */
export interface AuthUser {
    /** User identifier */
    id: string;
    /** Email address */
    email: string;
    /** Display name */
    name: string;
    /** Assigned position identifiers */
    positions?: string[];
    /** Current tenant identifier (multi-tenant) */
    tenantId?: string;
}

/**
 * Active session information
 */
export interface AuthSession {
    /** Session identifier */
    id: string;
    /** Associated user identifier */
    userId: string;
    /** Session expiry (ISO 8601) */
    expiresAt: string;
    /** Bearer token (if not using cookies) */
    token?: string;
}

/**
 * Authentication result returned by login/verify operations
 */
export interface AuthResult {
    /** Whether authentication succeeded */
    success: boolean;
    /** Authenticated user (if success) */
    user?: AuthUser;
    /** Active session (if success) */
    session?: AuthSession;
    /** Error message (if failure) */
    error?: string;
}

export interface IAuthService {
    /**
     * Handle an incoming HTTP authentication request
     * @param request - Standard Request object
     * @returns Standard Response object
     */
    handleRequest(request: Request): Promise<Response>;

    /**
     * Verify a session token or cookie and return the user
     * @param token - Bearer token or session identifier
     * @returns Auth result with user and session if valid
     */
    verify(token: string): Promise<AuthResult>;

    /**
     * Invalidate a session (logout)
     * @param sessionId - Session identifier to invalidate
     */
    logout?(sessionId: string): Promise<void>;

    /**
     * Get the current user from a request
     * @param request - Standard Request object
     * @returns Authenticated user or undefined
     */
    getCurrentUser?(request: Request): Promise<AuthUser | undefined>;
}

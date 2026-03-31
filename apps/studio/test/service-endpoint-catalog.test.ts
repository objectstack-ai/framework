import { describe, it, expect } from 'vitest';
import { buildServiceEndpoints, SERVICE_ENDPOINT_CATALOG } from '../src/hooks/use-api-discovery';

// ─── Unit tests for service endpoint catalog & builder ──────────────

describe('SERVICE_ENDPOINT_CATALOG', () => {
    it('should include AI service with expected endpoints', () => {
        const ai = SERVICE_ENDPOINT_CATALOG.ai;
        expect(ai).toBeDefined();
        expect(ai.group).toBe('AI');
        expect(ai.defaultRoute).toBe('/api/v1/ai');

        const paths = ai.endpoints.map(e => e.path);
        expect(paths).toContain('/chat');
        expect(paths).toContain('/chat/stream');
        expect(paths).toContain('/complete');
        expect(paths).toContain('/models');
        expect(paths).toContain('/nlq');
        expect(paths).toContain('/suggest');
        expect(paths).toContain('/insights');
        expect(paths).toContain('/conversations');
        expect(paths).toContain('/conversations/:id/messages');
        expect(paths).toContain('/conversations/:id');
    });

    it('should include all expected service keys', () => {
        const serviceKeys = Object.keys(SERVICE_ENDPOINT_CATALOG);
        expect(serviceKeys).toContain('ai');
        expect(serviceKeys).toContain('workflow');
        expect(serviceKeys).toContain('realtime');
        expect(serviceKeys).toContain('notification');
        expect(serviceKeys).toContain('analytics');
        expect(serviceKeys).toContain('automation');
        expect(serviceKeys).toContain('i18n');
        expect(serviceKeys).toContain('ui');
        expect(serviceKeys).toContain('feed');
        expect(serviceKeys).toContain('storage');
    });

    it('should have a defaultRoute for every service', () => {
        for (const [key, catalog] of Object.entries(SERVICE_ENDPOINT_CATALOG)) {
            expect(catalog.defaultRoute, `${key} should have a defaultRoute`).toBeTruthy();
            expect(catalog.defaultRoute).toMatch(/^\/api\/v1\//);
        }
    });

    it('should have at least one endpoint per service', () => {
        for (const [key, catalog] of Object.entries(SERVICE_ENDPOINT_CATALOG)) {
            expect(catalog.endpoints.length, `${key} should have at least one endpoint`).toBeGreaterThan(0);
        }
    });
});

describe('buildServiceEndpoints', () => {
    it('should build AI endpoints with the given route prefix', () => {
        const endpoints = buildServiceEndpoints('ai', '/api/v1/ai');
        expect(endpoints.length).toBeGreaterThan(0);

        // All endpoints should belong to the AI group
        for (const ep of endpoints) {
            expect(ep.group).toBe('AI');
            expect(ep.path).toMatch(/^\/api\/v1\/ai/);
        }

        // Should include the chat endpoint
        const chatEndpoint = endpoints.find(e => e.path === '/api/v1/ai/chat');
        expect(chatEndpoint).toBeDefined();
        expect(chatEndpoint!.method).toBe('POST');
        expect(chatEndpoint!.bodyTemplate).toBeDefined();
    });

    it('should use a custom route prefix from discovery', () => {
        const endpoints = buildServiceEndpoints('ai', '/custom/ai');
        const chatEndpoint = endpoints.find(e => e.path === '/custom/ai/chat');
        expect(chatEndpoint).toBeDefined();
        expect(chatEndpoint!.desc).toBe('Chat completion');
    });

    it('should return empty array for unknown service', () => {
        const endpoints = buildServiceEndpoints('unknown_service', '/api/v1/unknown');
        expect(endpoints).toEqual([]);
    });

    it('should build workflow endpoints correctly', () => {
        const endpoints = buildServiceEndpoints('workflow', '/api/v1/workflow');
        expect(endpoints.length).toBeGreaterThanOrEqual(5);

        const methods = endpoints.map(e => e.method);
        expect(methods).toContain('GET');
        expect(methods).toContain('POST');

        const paths = endpoints.map(e => e.path);
        expect(paths).toContain('/api/v1/workflow/:object/config');
        expect(paths).toContain('/api/v1/workflow/:object/:recordId/transition');
    });

    it('should build notification endpoints correctly', () => {
        const endpoints = buildServiceEndpoints('notification', '/api/v1/notifications');
        expect(endpoints.length).toBeGreaterThanOrEqual(7);

        // Should include list notifications at base path
        const listEp = endpoints.find(e => e.path === '/api/v1/notifications' && e.method === 'GET');
        expect(listEp).toBeDefined();
        expect(listEp!.desc).toBe('List notifications');
    });

    it('should include bodyTemplate where defined', () => {
        const endpoints = buildServiceEndpoints('automation', '/api/v1/automation');
        const triggerEp = endpoints.find(e => e.path === '/api/v1/automation/trigger');
        expect(triggerEp).toBeDefined();
        expect(triggerEp!.bodyTemplate).toEqual({ name: '', params: {} });
    });

    it('should not include bodyTemplate for GET endpoints', () => {
        const endpoints = buildServiceEndpoints('analytics', '/api/v1/analytics');
        const metaEp = endpoints.find(e => e.path === '/api/v1/analytics/meta');
        expect(metaEp).toBeDefined();
        expect(metaEp!.method).toBe('GET');
        expect(metaEp!.bodyTemplate).toBeUndefined();
    });
});

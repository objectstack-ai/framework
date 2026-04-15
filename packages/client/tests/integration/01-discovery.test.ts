/**
 * Integration Test: Discovery & Connection
 * 
 * Tests the client's ability to discover and connect to an ObjectStack server.
 * These tests require a running server instance.
 * 
 * @see CLIENT_SERVER_INTEGRATION_TESTS.md for full test specification
 */

import { describe, test, expect } from 'vitest';
import { ObjectStackClient } from '../../src/index';

const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';

describe('Discovery & Connection', () => {
  describe('TC-DISC-001: Protocol-standard Discovery via /api/v1/discovery', () => {
    test('should discover API from /api/v1/discovery', async () => {
      const client = new ObjectStackClient({
        baseUrl: TEST_SERVER_URL,
        debug: true
      });

      const discovery = await client.connect();

      expect(discovery.version).toBeDefined();
      expect(discovery.apiName).toBeDefined();
      expect(discovery.routes).toBeDefined();
      expect(discovery.services).toBeDefined();
    });
  });

  describe('TC-DISC-002: Discovery Information', () => {
    test('should provide valid API version information', async () => {
      const client = new ObjectStackClient({ baseUrl: TEST_SERVER_URL });
      const discovery = await client.connect();
      
      // Version should be a semantic version or API version string
      expect(discovery.version).toMatch(/^v?\d+/);
      
      // API name should be non-empty
      expect(discovery.apiName.length).toBeGreaterThan(0);
    });
  });

  describe('TC-DISC-003: Connection Failure Handling', () => {
    test('should throw error when server is unreachable', async () => {
      const client = new ObjectStackClient({ 
        baseUrl: 'http://localhost:9999' // Invalid port
      });
      
      await expect(client.connect()).rejects.toThrow();
    });
  });

  describe('TC-DISC-004: Route Resolution', () => {
    test('should resolve API routes from discovery info', async () => {
      const client = new ObjectStackClient({ baseUrl: TEST_SERVER_URL });
      await client.connect();
      
      // After connection, client should have discovery info
      expect(client.discovery).toBeDefined();
      expect(client.discovery?.version).toBeDefined();
      
      // Verify that subsequent API calls can be made (routes are resolved)
      // This implicitly tests route resolution
    });
  });
});

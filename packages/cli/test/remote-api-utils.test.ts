import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient, requireAuth } from '../src/utils/api-client';
import { readAuthConfig, writeAuthConfig, deleteAuthConfig, getCredentialsPath } from '../src/utils/auth-config';
import { formatOutput } from '../src/utils/output-formatter';
import * as fs from 'node:fs/promises';

// Mock fs module
vi.mock('node:fs/promises');

describe('API Client Utilities', () => {
  describe('createApiClient', () => {
    it('should use provided URL and token', async () => {
      const client = await createApiClient({
        url: 'https://test.example.com',
        token: 'test-token',
      });

      expect(client).toBeDefined();
      expect((client as any).baseUrl).toBe('https://test.example.com');
      expect((client as any).token).toBe('test-token');
    });

    it('should default to localhost when no URL provided', async () => {
      const client = await createApiClient({});

      expect(client).toBeDefined();
      expect((client as any).baseUrl).toBe('http://localhost:3000');
    });

    it('should use environment variables if no options provided', async () => {
      const originalUrl = process.env.OBJECTSTACK_URL;
      const originalToken = process.env.OBJECTSTACK_TOKEN;

      process.env.OBJECTSTACK_URL = 'https://env.example.com';
      process.env.OBJECTSTACK_TOKEN = 'env-token';

      const client = await createApiClient({});

      expect((client as any).baseUrl).toBe('https://env.example.com');
      expect((client as any).token).toBe('env-token');

      // Restore
      process.env.OBJECTSTACK_URL = originalUrl;
      process.env.OBJECTSTACK_TOKEN = originalToken;
    });
  });

  describe('requireAuth', () => {
    it('should not throw when token is provided', () => {
      expect(() => requireAuth('valid-token')).not.toThrow();
    });

    it('should throw when token is missing', () => {
      expect(() => requireAuth(undefined)).toThrow(/Authentication required/);
    });

    it('should throw when token is empty string', () => {
      expect(() => requireAuth('')).toThrow(/Authentication required/);
    });
  });
});

describe('Auth Config Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCredentialsPath', () => {
    it('should return path to credentials file', () => {
      const path = getCredentialsPath();
      expect(path).toContain('.objectstack');
      expect(path).toContain('credentials.json');
    });
  });

  describe('writeAuthConfig', () => {
    it('should write credentials to file with correct permissions', async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);

      const config = {
        url: 'https://test.example.com',
        token: 'test-token',
        email: 'user@example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      await writeAuthConfig(config);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('.objectstack'),
        { recursive: true }
      );

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('credentials.json'),
        expect.stringContaining('test-token'),
        { mode: 0o600 }
      );
    });
  });

  describe('readAuthConfig', () => {
    it('should read and parse credentials file', async () => {
      const mockConfig = {
        url: 'https://test.example.com',
        token: 'test-token',
        email: 'user@example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

      const config = await readAuthConfig();

      expect(config).toEqual(mockConfig);
    });

    it('should throw helpful error when file does not exist', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockRejectedValue({ code: 'ENOENT' });

      await expect(readAuthConfig()).rejects.toThrow(/No stored credentials/);
    });
  });

  describe('deleteAuthConfig', () => {
    it('should delete credentials file', async () => {
      const mockUnlink = vi.fn().mockResolvedValue(undefined);
      vi.doMock('node:fs/promises', () => ({
        unlink: mockUnlink,
      }));

      await deleteAuthConfig();

      // Should not throw
    });

    it('should not throw if file does not exist', async () => {
      const mockUnlink = vi.fn().mockRejectedValue({ code: 'ENOENT' });
      vi.doMock('node:fs/promises', () => ({
        unlink: mockUnlink,
      }));

      await expect(deleteAuthConfig()).resolves.not.toThrow();
    });
  });
});

describe('Output Formatter Utilities', () => {
  beforeEach(() => {
    // Spy on console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should format JSON output', () => {
    const data = { name: 'test', value: 123 };
    formatOutput(data, 'json');

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"name": "test"')
    );
  });

  it('should format YAML output', () => {
    const data = { name: 'test', value: 123 };
    formatOutput(data, 'yaml');

    expect(console.log).toHaveBeenCalled();
  });

  it('should format table output for arrays', () => {
    const data = [
      { name: 'item1', value: 1 },
      { name: 'item2', value: 2 },
    ];
    formatOutput(data, 'table');

    expect(console.log).toHaveBeenCalled();
  });

  it('should format table output for single object', () => {
    const data = { name: 'test', value: 123 };
    formatOutput(data, 'table');

    expect(console.log).toHaveBeenCalled();
  });

  it('should handle empty arrays', () => {
    const data: any[] = [];
    formatOutput(data, 'table');

    expect(console.log).toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryDriver } from '../memory-driver.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TEST_DATA_DIR = path.join('/tmp', 'objectstack-test-persistence');
const TEST_FILE_PATH = path.join(TEST_DATA_DIR, 'test-db.json');

describe('InMemoryDriver Persistence', () => {
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  describe('File Persistence', () => {
    it('should persist and restore data via file adapter', async () => {
      // Create and populate driver with file persistence
      const driver1 = new InMemoryDriver({
        persistence: { type: 'file', path: TEST_FILE_PATH, autoSaveInterval: 100 },
      });
      await driver1.connect();
      await driver1.create('users', { id: '1', name: 'Alice' });
      await driver1.create('users', { id: '2', name: 'Bob' });

      // Flush and disconnect
      await driver1.flush();
      await driver1.disconnect();

      // Verify file was created
      expect(fs.existsSync(TEST_FILE_PATH)).toBe(true);

      // Create a new driver and verify data is restored
      const driver2 = new InMemoryDriver({
        persistence: { type: 'file', path: TEST_FILE_PATH, autoSaveInterval: 100 },
      });
      await driver2.connect();

      const users = await driver2.find('users', { object: 'users' });
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('Alice');
      expect(users[1].name).toBe('Bob');

      await driver2.disconnect();
    });

    it('should support shorthand "file" persistence string', async () => {
      // Use shorthand — just verifies no error is thrown with 'file'
      const driver = new InMemoryDriver({ persistence: 'file' });
      await driver.connect();
      await driver.create('items', { id: '1', name: 'Widget' });
      await driver.disconnect();
    });

    it('should persist updates and deletes', async () => {
      const driver1 = new InMemoryDriver({
        persistence: { type: 'file', path: TEST_FILE_PATH, autoSaveInterval: 100 },
      });
      await driver1.connect();

      // Create, update, and delete
      await driver1.create('tasks', { id: '1', title: 'Task A', done: false });
      await driver1.create('tasks', { id: '2', title: 'Task B', done: false });
      await driver1.update('tasks', '1', { done: true });
      await driver1.delete('tasks', '2');

      await driver1.flush();
      await driver1.disconnect();

      // Restore
      const driver2 = new InMemoryDriver({
        persistence: { type: 'file', path: TEST_FILE_PATH, autoSaveInterval: 100 },
      });
      await driver2.connect();

      const tasks = await driver2.find('tasks', { object: 'tasks' });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('1');
      expect(tasks[0].done).toBe(true);

      await driver2.disconnect();
    });

    it('should handle missing persistence file gracefully', async () => {
      const driver = new InMemoryDriver({
        persistence: { type: 'file', path: '/tmp/nonexistent/path/db.json' },
      });
      await driver.connect();

      const users = await driver.find('users', { object: 'users' });
      expect(users).toHaveLength(0);

      await driver.disconnect();
    });
  });

  describe('Custom Adapter Persistence', () => {
    it('should use a custom adapter for persistence', async () => {
      const stored: Record<string, any[]> = {};
      const customAdapter = {
        load: async () => Object.keys(stored).length > 0 ? { ...stored } : null,
        save: async (db: Record<string, any[]>) => {
          for (const [k, v] of Object.entries(db)) {
            stored[k] = [...v];
          }
        },
        flush: async () => {},
      };

      const driver1 = new InMemoryDriver({
        persistence: { adapter: customAdapter },
      });
      await driver1.connect();
      await driver1.create('projects', { id: '1', name: 'Alpha' });
      await driver1.disconnect();

      // Verify data was saved via custom adapter
      expect(stored.projects).toBeDefined();
      expect(stored.projects).toHaveLength(1);

      // Restore from custom adapter
      const driver2 = new InMemoryDriver({
        persistence: { adapter: customAdapter },
      });
      await driver2.connect();
      const projects = await driver2.find('projects', { object: 'projects' });
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Alpha');

      await driver2.disconnect();
    });
  });

  describe('Pure Memory (No Persistence)', () => {
    it('should work without persistence when explicitly disabled', async () => {
      const driver = new InMemoryDriver({ persistence: false });
      await driver.connect();

      await driver.create('items', { id: '1', name: 'Widget' });
      const items = await driver.find('items', { object: 'items' });
      expect(items).toHaveLength(1);

      await driver.disconnect();

      // After disconnect, data is gone
      const itemsAfter = await driver.find('items', { object: 'items' });
      expect(itemsAfter).toHaveLength(0);
    });
  });

  describe('Auto Persistence', () => {
    it('should auto-detect Node.js environment and use file persistence with shorthand', async () => {
      // In Node.js, 'auto' should select file persistence
      const driver = new InMemoryDriver({ persistence: 'auto' });
      await driver.connect();
      await driver.create('items', { id: '1', name: 'Widget' });
      await driver.disconnect();
    });

    it('should auto-detect Node.js environment and use file persistence with object config', async () => {
      const filePath = path.join(TEST_DATA_DIR, 'auto-test-db.json');
      const driver1 = new InMemoryDriver({
        persistence: { type: 'auto', path: filePath, autoSaveInterval: 100 },
      });
      await driver1.connect();
      await driver1.create('users', { id: '1', name: 'Alice' });
      await driver1.flush();
      await driver1.disconnect();

      // Verify file was created (Node.js env selects file adapter)
      expect(fs.existsSync(filePath)).toBe(true);

      // Restore from file
      const driver2 = new InMemoryDriver({
        persistence: { type: 'auto', path: filePath, autoSaveInterval: 100 },
      });
      await driver2.connect();
      const users = await driver2.find('users', { object: 'users' });
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
      await driver2.disconnect();
    });
  });

  describe('Bulk Operations with Persistence', () => {
    it('should persist bulk creates', async () => {
      const driver1 = new InMemoryDriver({
        persistence: { type: 'file', path: TEST_FILE_PATH, autoSaveInterval: 100 },
      });
      await driver1.connect();
      await driver1.bulkCreate('items', [
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
        { id: '3', name: 'C' },
      ]);
      await driver1.flush();
      await driver1.disconnect();

      const driver2 = new InMemoryDriver({
        persistence: { type: 'file', path: TEST_FILE_PATH, autoSaveInterval: 100 },
      });
      await driver2.connect();
      const items = await driver2.find('items', { object: 'items' });
      expect(items).toHaveLength(3);
      await driver2.disconnect();
    });
  });
});

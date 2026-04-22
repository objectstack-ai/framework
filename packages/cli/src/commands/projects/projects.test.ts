// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import ProjectsList from './list.js';
import ProjectsShow from './show.js';
import ProjectsCreate from './create.js';
import ProjectsSwitch from './switch.js';

/**
 * Metadata-only smoke tests for the `os projects ...` commands. We do
 * not run the commands end-to-end (that would require an oclif Config
 * with hooks wired up); instead we assert that each command is a
 * well-formed oclif Command class with the flags / args we expect.
 *
 * This catches typos and missing-arg regressions without the heavy
 * lifting of a full oclif harness. Full runtime coverage lives in
 * `client.project-scoping.test.ts` (which exercises the HTTP surface)
 * and the Chrome DevTools MCP smoke test in the PR description.
 */

describe('os projects commands', () => {
  describe('list', () => {
    it('has the expected description and flags', () => {
      expect(ProjectsList.description).toMatch(/list/i);
      expect(ProjectsList.flags).toHaveProperty('org');
      expect(ProjectsList.flags).toHaveProperty('status');
      expect(ProjectsList.flags).toHaveProperty('format');
    });
  });

  describe('show', () => {
    it('requires an id arg', () => {
      expect(ProjectsShow.args).toHaveProperty('id');
      expect((ProjectsShow.args as any).id.required).toBe(true);
    });
  });

  describe('create', () => {
    it('requires --org and --name', () => {
      expect((ProjectsCreate.flags as any).org.required).toBe(true);
      expect((ProjectsCreate.flags as any).name.required).toBe(true);
    });

    it('activates by default with --no-activate opt-out', () => {
      const flag = (ProjectsCreate.flags as any).activate;
      expect(flag.default).toBe(true);
      expect(flag.allowNo).toBe(true);
    });
  });

  describe('switch', () => {
    it('requires an id arg', () => {
      expect(ProjectsSwitch.args).toHaveProperty('id');
      expect((ProjectsSwitch.args as any).id.required).toBe(true);
    });

    it('calls the activate endpoint by default with --no-remote opt-out', () => {
      const flag = (ProjectsSwitch.flags as any).remote;
      expect(flag.default).toBe(true);
      expect(flag.allowNo).toBe(true);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { metadataManagementSkill } from './metadata-skill.zod';
import { SkillSchema } from './skill.zod';
import { METADATA_TOOL_NAMES } from './metadata-tools.zod';

describe('metadataManagementSkill', () => {
  it('should pass SkillSchema validation', () => {
    expect(() => SkillSchema.parse(metadataManagementSkill)).not.toThrow();
  });

  it('should have correct identity', () => {
    expect(metadataManagementSkill.name).toBe('metadata_management');
    expect(metadataManagementSkill.label).toBe('Metadata Management');
    expect(metadataManagementSkill.active).toBe(true);
  });

  it('should have description and instructions', () => {
    expect(metadataManagementSkill.description).toBeDefined();
    expect(metadataManagementSkill.description!.length).toBeGreaterThan(20);
    expect(metadataManagementSkill.instructions).toBeDefined();
    expect(metadataManagementSkill.instructions!.length).toBeGreaterThan(20);
  });

  it('should reference all metadata tool names', () => {
    expect(metadataManagementSkill.tools).toHaveLength(METADATA_TOOL_NAMES.length);
    METADATA_TOOL_NAMES.forEach(toolName => {
      expect(metadataManagementSkill.tools).toContain(toolName);
    });
  });

  it('should have trigger phrases for intent matching', () => {
    expect(metadataManagementSkill.triggerPhrases).toBeDefined();
    expect(metadataManagementSkill.triggerPhrases!.length).toBeGreaterThan(5);

    // Should cover core operations
    const phrases = metadataManagementSkill.triggerPhrases!.join(' ');
    expect(phrases).toContain('create');
    expect(phrases).toContain('add');
    expect(phrases).toContain('delete');
    expect(phrases).toContain('list');
    expect(phrases).toContain('describe');
  });

  it('should have trigger conditions for programmatic activation', () => {
    expect(metadataManagementSkill.triggerConditions).toBeDefined();
    expect(metadataManagementSkill.triggerConditions!.length).toBeGreaterThan(0);

    const intentCondition = metadataManagementSkill.triggerConditions!.find(c => c.field === 'intent');
    expect(intentCondition).toBeDefined();
    expect(intentCondition!.operator).toBe('in');
    expect(intentCondition!.value).toContain('metadata_management');
  });

  it('should have permissions covering all CRUD operations', () => {
    expect(metadataManagementSkill.permissions).toBeDefined();
    const perms = metadataManagementSkill.permissions!;
    expect(perms).toContain('metadata.object.read');
    expect(perms).toContain('metadata.object.create');
    expect(perms).toContain('metadata.field.create');
    expect(perms).toContain('metadata.field.update');
    expect(perms).toContain('metadata.field.delete');
  });

  it('should follow snake_case for name', () => {
    expect(metadataManagementSkill.name).toMatch(/^[a-z_][a-z0-9_]*$/);
  });

  it('tool references should all follow snake_case', () => {
    metadataManagementSkill.tools.forEach(toolName => {
      expect(toolName).toMatch(/^[a-z_][a-z0-9_]*$/);
    });
  });
});

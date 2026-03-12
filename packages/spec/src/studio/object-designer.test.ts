import { describe, it, expect } from 'vitest';
import {
  FieldPropertySectionSchema,
  FieldGroupSchema,
  FieldEditorConfigSchema,
  RelationshipDisplaySchema,
  RelationshipMapperConfigSchema,
  ERLayoutAlgorithmSchema,
  ERNodeDisplaySchema,
  ERDiagramConfigSchema,
  ObjectListDisplayModeSchema,
  ObjectSortFieldSchema,
  ObjectFilterSchema,
  ObjectManagerConfigSchema,
  ObjectPreviewTabSchema,
  ObjectPreviewConfigSchema,
  ObjectDesignerDefaultViewSchema,
  ObjectDesignerConfigSchema,
  defineObjectDesignerConfig,
} from './object-designer.zod';

// ─── Field Property Section ──────────────────────────────────────────

describe('FieldPropertySectionSchema', () => {
  it('should accept minimal section with defaults', () => {
    const section = { key: 'basics', label: 'Basic Properties' };
    const result = FieldPropertySectionSchema.parse(section);
    expect(result.defaultExpanded).toBe(true);
    expect(result.order).toBe(0);
    expect(result.icon).toBeUndefined();
  });

  it('should accept full section', () => {
    const section = {
      key: 'security',
      label: 'Security & Compliance',
      icon: 'shield',
      defaultExpanded: false,
      order: 40,
    };
    const result = FieldPropertySectionSchema.parse(section);
    expect(result.key).toBe('security');
    expect(result.defaultExpanded).toBe(false);
    expect(result.order).toBe(40);
  });

  it('should reject missing key', () => {
    expect(() => FieldPropertySectionSchema.parse({ label: 'Test' })).toThrow();
  });

  it('should reject missing label', () => {
    expect(() => FieldPropertySectionSchema.parse({ key: 'test' })).toThrow();
  });
});

// ─── Field Group ─────────────────────────────────────────────────────

describe('FieldGroupSchema', () => {
  it('should accept minimal group with defaults', () => {
    const group = { key: 'contact_info', label: 'Contact Info' };
    const result = FieldGroupSchema.parse(group);
    expect(result.defaultExpanded).toBe(true);
    expect(result.order).toBe(0);
  });

  it('should accept full group', () => {
    const group = {
      key: 'billing',
      label: 'Billing',
      icon: 'credit-card',
      defaultExpanded: false,
      order: 20,
    };
    expect(() => FieldGroupSchema.parse(group)).not.toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => FieldGroupSchema.parse({})).toThrow();
    expect(() => FieldGroupSchema.parse({ key: 'x' })).toThrow();
  });
});

// ─── Field Editor Config ─────────────────────────────────────────────

describe('FieldEditorConfigSchema', () => {
  it('should accept empty object with all defaults', () => {
    const result = FieldEditorConfigSchema.parse({});
    expect(result.inlineEditing).toBe(true);
    expect(result.dragReorder).toBe(true);
    expect(result.showFieldGroups).toBe(true);
    expect(result.showPropertyPanel).toBe(true);
    expect(result.paginationThreshold).toBe(50);
    expect(result.batchOperations).toBe(true);
    expect(result.showUsageStats).toBe(false);
    expect(result.propertySections.length).toBe(6);
    expect(result.fieldGroups).toEqual([]);
  });

  it('should accept custom config', () => {
    const config = {
      inlineEditing: false,
      dragReorder: false,
      paginationThreshold: 100,
      propertySections: [
        { key: 'basics', label: 'Basics' },
      ],
    };
    const result = FieldEditorConfigSchema.parse(config);
    expect(result.inlineEditing).toBe(false);
    expect(result.propertySections.length).toBe(1);
    expect(result.propertySections[0].key).toBe('basics');
  });

  it('should accept with custom field groups', () => {
    const config = {
      fieldGroups: [
        { key: 'contact_info', label: 'Contact Information', order: 0 },
        { key: 'billing', label: 'Billing Details', order: 10 },
      ],
    };
    const result = FieldEditorConfigSchema.parse(config);
    expect(result.fieldGroups.length).toBe(2);
  });
});

// ─── Relationship Display ────────────────────────────────────────────

describe('RelationshipDisplaySchema', () => {
  it('should accept minimal config with defaults', () => {
    const config = { type: 'lookup' };
    const result = RelationshipDisplaySchema.parse(config);
    expect(result.lineStyle).toBe('solid');
    expect(result.color).toBe('#94a3b8');
    expect(result.cardinalityLabel).toBe('1:N');
  });

  it('should accept full config', () => {
    const config = {
      type: 'master_detail',
      lineStyle: 'dashed',
      color: '#ea580c',
      highlightColor: '#f97316',
      cardinalityLabel: '1:N',
    };
    expect(() => RelationshipDisplaySchema.parse(config)).not.toThrow();
  });

  it('should reject invalid type', () => {
    expect(() => RelationshipDisplaySchema.parse({ type: 'invalid' })).toThrow();
  });

  it('should accept tree type', () => {
    const result = RelationshipDisplaySchema.parse({ type: 'tree' });
    expect(result.type).toBe('tree');
  });
});

// ─── Relationship Mapper Config ──────────────────────────────────────

describe('RelationshipMapperConfigSchema', () => {
  it('should accept empty object with all defaults', () => {
    const result = RelationshipMapperConfigSchema.parse({});
    expect(result.visualCreation).toBe(true);
    expect(result.showReverseRelationships).toBe(true);
    expect(result.showCascadeWarnings).toBe(true);
    expect(result.displayConfig.length).toBe(3);
  });

  it('should accept custom display config', () => {
    const config = {
      displayConfig: [
        { type: 'lookup', lineStyle: 'dotted', color: '#ff0000' },
      ],
    };
    const result = RelationshipMapperConfigSchema.parse(config);
    expect(result.displayConfig.length).toBe(1);
  });
});

// ─── ER Layout Algorithm ─────────────────────────────────────────────

describe('ERLayoutAlgorithmSchema', () => {
  it('should accept all valid algorithms', () => {
    const algorithms = ['force', 'hierarchy', 'grid', 'circular'];
    algorithms.forEach(algo => {
      expect(() => ERLayoutAlgorithmSchema.parse(algo)).not.toThrow();
    });
  });

  it('should reject invalid algorithm', () => {
    expect(() => ERLayoutAlgorithmSchema.parse('random')).toThrow();
  });
});

// ─── ER Node Display ─────────────────────────────────────────────────

describe('ERNodeDisplaySchema', () => {
  it('should accept empty object with all defaults', () => {
    const result = ERNodeDisplaySchema.parse({});
    expect(result.showFields).toBe(true);
    expect(result.maxFieldsVisible).toBe(8);
    expect(result.showFieldTypes).toBe(true);
    expect(result.showRequiredIndicator).toBe(true);
    expect(result.showRecordCount).toBe(false);
    expect(result.showIcon).toBe(true);
    expect(result.showDescription).toBe(true);
  });

  it('should accept custom config', () => {
    const config = {
      showFields: false,
      maxFieldsVisible: 5,
      showRecordCount: true,
    };
    const result = ERNodeDisplaySchema.parse(config);
    expect(result.showFields).toBe(false);
    expect(result.maxFieldsVisible).toBe(5);
    expect(result.showRecordCount).toBe(true);
  });
});

// ─── ER Diagram Config ───────────────────────────────────────────────

describe('ERDiagramConfigSchema', () => {
  it('should accept empty object with all defaults', () => {
    const result = ERDiagramConfigSchema.parse({});
    expect(result.enabled).toBe(true);
    expect(result.layout).toBe('force');
    expect(result.showMinimap).toBe(true);
    expect(result.zoomControls).toBe(true);
    expect(result.minZoom).toBe(0.1);
    expect(result.maxZoom).toBe(3);
    expect(result.showEdgeLabels).toBe(true);
    expect(result.highlightOnHover).toBe(true);
    expect(result.clickToNavigate).toBe(true);
    expect(result.dragToConnect).toBe(true);
    expect(result.hideOrphans).toBe(false);
    expect(result.autoFit).toBe(true);
    expect(result.exportFormats).toEqual(['png', 'svg']);
  });

  it('should accept custom config', () => {
    const config = {
      layout: 'hierarchy',
      showMinimap: false,
      hideOrphans: true,
      exportFormats: ['png', 'svg', 'json'],
    };
    const result = ERDiagramConfigSchema.parse(config);
    expect(result.layout).toBe('hierarchy');
    expect(result.hideOrphans).toBe(true);
    expect(result.exportFormats).toEqual(['png', 'svg', 'json']);
  });

  it('should accept disabled config', () => {
    const result = ERDiagramConfigSchema.parse({ enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('should accept nested nodeDisplay overrides', () => {
    const config = {
      nodeDisplay: {
        showFields: false,
        maxFieldsVisible: 3,
      },
    };
    const result = ERDiagramConfigSchema.parse(config);
    expect(result.nodeDisplay.showFields).toBe(false);
    expect(result.nodeDisplay.maxFieldsVisible).toBe(3);
    // Defaults preserved
    expect(result.nodeDisplay.showFieldTypes).toBe(true);
  });
});

// ─── Object List Display Mode ────────────────────────────────────────

describe('ObjectListDisplayModeSchema', () => {
  it('should accept all valid modes', () => {
    const modes = ['table', 'cards', 'tree'];
    modes.forEach(mode => {
      expect(() => ObjectListDisplayModeSchema.parse(mode)).not.toThrow();
    });
  });

  it('should reject invalid mode', () => {
    expect(() => ObjectListDisplayModeSchema.parse('gallery')).toThrow();
  });
});

// ─── Object Sort Field ───────────────────────────────────────────────

describe('ObjectSortFieldSchema', () => {
  it('should accept all valid sort fields', () => {
    const fields = ['name', 'label', 'fieldCount', 'updatedAt'];
    fields.forEach(field => {
      expect(() => ObjectSortFieldSchema.parse(field)).not.toThrow();
    });
  });

  it('should reject invalid sort field', () => {
    expect(() => ObjectSortFieldSchema.parse('created')).toThrow();
  });
});

// ─── Object Filter ───────────────────────────────────────────────────

describe('ObjectFilterSchema', () => {
  it('should accept empty object with defaults', () => {
    const result = ObjectFilterSchema.parse({});
    expect(result.includeSystem).toBe(true);
    expect(result.includeAbstract).toBe(false);
    expect(result.package).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  it('should accept full filter', () => {
    const filter = {
      package: 'app-crm',
      tags: ['sales', 'core'],
      includeSystem: true,
      includeAbstract: true,
      hasFieldType: 'lookup',
      hasRelationships: true,
      searchQuery: 'account',
    };
    const result = ObjectFilterSchema.parse(filter);
    expect(result.package).toBe('app-crm');
    expect(result.tags).toEqual(['sales', 'core']);
    expect(result.hasRelationships).toBe(true);
  });
});

// ─── Object Manager Config ───────────────────────────────────────────

describe('ObjectManagerConfigSchema', () => {
  it('should accept empty object with all defaults', () => {
    const result = ObjectManagerConfigSchema.parse({});
    expect(result.defaultDisplayMode).toBe('table');
    expect(result.defaultSortField).toBe('label');
    expect(result.defaultSortDirection).toBe('asc');
    expect(result.showFieldCount).toBe(true);
    expect(result.showRelationshipCount).toBe(true);
    expect(result.showQuickPreview).toBe(true);
    expect(result.enableComparison).toBe(false);
    expect(result.showERDiagramToggle).toBe(true);
    expect(result.showCreateAction).toBe(true);
    expect(result.showStatsSummary).toBe(true);
  });

  it('should accept custom config', () => {
    const config = {
      defaultDisplayMode: 'cards',
      defaultSortField: 'fieldCount',
      defaultSortDirection: 'desc',
      enableComparison: true,
    };
    const result = ObjectManagerConfigSchema.parse(config);
    expect(result.defaultDisplayMode).toBe('cards');
    expect(result.enableComparison).toBe(true);
  });
});

// ─── Object Preview Tab ──────────────────────────────────────────────

describe('ObjectPreviewTabSchema', () => {
  it('should accept minimal tab with defaults', () => {
    const tab = { key: 'fields', label: 'Fields' };
    const result = ObjectPreviewTabSchema.parse(tab);
    expect(result.enabled).toBe(true);
    expect(result.order).toBe(0);
    expect(result.icon).toBeUndefined();
  });

  it('should accept full tab', () => {
    const tab = {
      key: 'relationships',
      label: 'Relationships',
      icon: 'link',
      enabled: true,
      order: 10,
    };
    expect(() => ObjectPreviewTabSchema.parse(tab)).not.toThrow();
  });

  it('should accept disabled tab', () => {
    const tab = { key: 'code', label: 'Code', enabled: false };
    const result = ObjectPreviewTabSchema.parse(tab);
    expect(result.enabled).toBe(false);
  });

  it('should reject missing required fields', () => {
    expect(() => ObjectPreviewTabSchema.parse({})).toThrow();
    expect(() => ObjectPreviewTabSchema.parse({ key: 'x' })).toThrow();
  });
});

// ─── Object Preview Config ───────────────────────────────────────────

describe('ObjectPreviewConfigSchema', () => {
  it('should accept empty object with all defaults', () => {
    const result = ObjectPreviewConfigSchema.parse({});
    expect(result.tabs.length).toBe(8);
    expect(result.defaultTab).toBe('fields');
    expect(result.showHeader).toBe(true);
    expect(result.showBreadcrumbs).toBe(true);
  });

  it('should accept custom tabs', () => {
    const config = {
      tabs: [
        { key: 'fields', label: 'Fields', order: 0 },
        { key: 'data', label: 'Data', order: 10 },
      ],
      defaultTab: 'data',
    };
    const result = ObjectPreviewConfigSchema.parse(config);
    expect(result.tabs.length).toBe(2);
    expect(result.defaultTab).toBe('data');
  });
});

// ─── Object Designer Default View ────────────────────────────────────

describe('ObjectDesignerDefaultViewSchema', () => {
  it('should accept all valid default views', () => {
    const views = ['field-editor', 'relationship-mapper', 'er-diagram', 'object-manager'];
    views.forEach(view => {
      expect(() => ObjectDesignerDefaultViewSchema.parse(view)).not.toThrow();
    });
  });

  it('should reject invalid view', () => {
    expect(() => ObjectDesignerDefaultViewSchema.parse('schema')).toThrow();
  });
});

// ─── Object Designer Config (Top-Level) ──────────────────────────────

describe('ObjectDesignerConfigSchema', () => {
  it('should accept empty object with all defaults', () => {
    const result = ObjectDesignerConfigSchema.parse({});
    expect(result.defaultView).toBe('field-editor');
    expect(result.fieldEditor).toBeDefined();
    expect(result.fieldEditor.inlineEditing).toBe(true);
    expect(result.relationshipMapper).toBeDefined();
    expect(result.relationshipMapper.visualCreation).toBe(true);
    expect(result.erDiagram).toBeDefined();
    expect(result.erDiagram.enabled).toBe(true);
    expect(result.objectManager).toBeDefined();
    expect(result.objectManager.defaultDisplayMode).toBe('table');
    expect(result.objectManager.defaultFilter.includeSystem).toBe(true);
    expect(result.objectPreview).toBeDefined();
    expect(result.objectPreview.tabs.length).toBe(8);
  });

  it('should accept partial overrides', () => {
    const config = {
      defaultView: 'er-diagram',
      erDiagram: {
        layout: 'hierarchy',
        hideOrphans: true,
      },
    };
    const result = ObjectDesignerConfigSchema.parse(config);
    expect(result.defaultView).toBe('er-diagram');
    expect(result.erDiagram.layout).toBe('hierarchy');
    expect(result.erDiagram.hideOrphans).toBe(true);
    // Other defaults still applied
    expect(result.erDiagram.showMinimap).toBe(true);
    expect(result.fieldEditor.inlineEditing).toBe(true);
  });

  it('should accept full config with all sub-configs', () => {
    const config = {
      defaultView: 'object-manager',
      fieldEditor: {
        inlineEditing: false,
        dragReorder: false,
        showFieldGroups: false,
        showPropertyPanel: false,
        paginationThreshold: 100,
        batchOperations: false,
        showUsageStats: true,
      },
      relationshipMapper: {
        visualCreation: false,
        showReverseRelationships: false,
        showCascadeWarnings: false,
      },
      erDiagram: {
        enabled: false,
      },
      objectManager: {
        defaultDisplayMode: 'cards',
        defaultSortField: 'name',
        defaultSortDirection: 'desc',
        enableComparison: true,
      },
      objectPreview: {
        defaultTab: 'data',
        showBreadcrumbs: false,
      },
    };
    const result = ObjectDesignerConfigSchema.parse(config);
    expect(result.defaultView).toBe('object-manager');
    expect(result.fieldEditor.inlineEditing).toBe(false);
    expect(result.fieldEditor.showUsageStats).toBe(true);
    expect(result.erDiagram.enabled).toBe(false);
    expect(result.objectManager.enableComparison).toBe(true);
    expect(result.objectPreview.defaultTab).toBe('data');
  });
});

// ─── defineObjectDesignerConfig ──────────────────────────────────────

describe('defineObjectDesignerConfig', () => {
  it('should return a fully parsed config with defaults', () => {
    const result = defineObjectDesignerConfig({});
    expect(result.defaultView).toBe('field-editor');
    expect(result.fieldEditor).toBeDefined();
    expect(result.erDiagram.enabled).toBe(true);
    expect(result.objectManager.defaultDisplayMode).toBe('table');
  });

  it('should accept partial overrides', () => {
    const result = defineObjectDesignerConfig({
      defaultView: 'er-diagram',
      erDiagram: { layout: 'grid' },
    });
    expect(result.defaultView).toBe('er-diagram');
    expect(result.erDiagram.layout).toBe('grid');
  });

  it('should throw on invalid input', () => {
    expect(() => defineObjectDesignerConfig({
      defaultView: 'invalid' as any,
    })).toThrow();
  });
});

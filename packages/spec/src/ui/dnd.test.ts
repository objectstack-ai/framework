import { describe, it, expect } from 'vitest';
import {
  DragHandleSchema,
  DropEffectSchema,
  DragConstraintSchema,
  DropZoneSchema,
  DragItemSchema,
  DndConfigSchema,
  type DragHandle,
  type DropEffect,
  type DragConstraint,
  type DropZone,
  type DragItem,
  type DndConfig,
} from './dnd.zod';

describe('DragHandleSchema', () => {
  it('should accept all valid drag handle values', () => {
    const handles = ['element', 'handle', 'grip_icon'] as const;
    handles.forEach(handle => {
      expect(() => DragHandleSchema.parse(handle)).not.toThrow();
    });
  });

  it('should reject invalid drag handle values', () => {
    expect(() => DragHandleSchema.parse('button')).toThrow();
    expect(() => DragHandleSchema.parse('')).toThrow();
  });
});

describe('DropEffectSchema', () => {
  it('should accept all valid drop effect values', () => {
    const effects = ['move', 'copy', 'link', 'none'] as const;
    effects.forEach(effect => {
      expect(() => DropEffectSchema.parse(effect)).not.toThrow();
    });
  });

  it('should reject invalid drop effect values', () => {
    expect(() => DropEffectSchema.parse('delete')).toThrow();
    expect(() => DropEffectSchema.parse('')).toThrow();
  });
});

describe('DragConstraintSchema', () => {
  it('should apply defaults for empty config', () => {
    const result = DragConstraintSchema.parse({});
    expect(result.axis).toBe('both');
    expect(result.bounds).toBe('none');
  });

  it('should accept grid tuple', () => {
    const result = DragConstraintSchema.parse({ grid: [10, 10] });
    expect(result.grid).toEqual([10, 10]);
  });

  it('should accept all valid axis values', () => {
    const axes = ['x', 'y', 'both'] as const;
    axes.forEach(axis => {
      expect(() => DragConstraintSchema.parse({ axis })).not.toThrow();
    });
  });

  it('should reject invalid axis value', () => {
    expect(() => DragConstraintSchema.parse({ axis: 'z' })).toThrow();
  });

  it('should accept all valid bounds values', () => {
    const bounds = ['parent', 'viewport', 'none'] as const;
    bounds.forEach(b => {
      expect(() => DragConstraintSchema.parse({ bounds: b })).not.toThrow();
    });
  });
});

describe('DropZoneSchema', () => {
  it('should accept valid config with accept array', () => {
    const config: DropZone = { accept: ['card', 'item'], highlightOnDragOver: true, dropEffect: 'move' };
    const result = DropZoneSchema.parse(config);
    expect(result.accept).toEqual(['card', 'item']);
  });

  it('should reject missing accept', () => {
    expect(() => DropZoneSchema.parse({})).toThrow();
  });

  it('should apply defaults for optional fields', () => {
    const result = DropZoneSchema.parse({ accept: ['task'] });
    expect(result.highlightOnDragOver).toBe(true);
    expect(result.dropEffect).toBe('move');
  });

  it('should accept maxItems', () => {
    const result = DropZoneSchema.parse({ accept: ['card'], maxItems: 5 });
    expect(result.maxItems).toBe(5);
  });
});

describe('DragItemSchema', () => {
  it('should accept valid config with type', () => {
    const result = DragItemSchema.parse({ type: 'card' });
    expect(result.type).toBe('card');
  });

  it('should apply defaults for handle, preview, and disabled', () => {
    const result = DragItemSchema.parse({ type: 'task' });
    expect(result.handle).toBe('element');
    expect(result.preview).toBe('element');
    expect(result.disabled).toBe(false);
  });

  it('should reject missing type', () => {
    expect(() => DragItemSchema.parse({})).toThrow();
  });

  it('should accept constraint configuration', () => {
    const result = DragItemSchema.parse({
      type: 'widget',
      constraint: { axis: 'x', bounds: 'parent', grid: [20, 20] },
    });
    expect(result.constraint?.axis).toBe('x');
    expect(result.constraint?.bounds).toBe('parent');
    expect(result.constraint?.grid).toEqual([20, 20]);
  });

  it('should accept custom preview', () => {
    const result = DragItemSchema.parse({ type: 'item', preview: 'custom' });
    expect(result.preview).toBe('custom');
  });
});

describe('DndConfigSchema', () => {
  it('should accept empty config with defaults', () => {
    const result = DndConfigSchema.parse({});
    expect(result.enabled).toBe(false);
    expect(result.sortable).toBe(false);
    expect(result.autoScroll).toBe(true);
    expect(result.touchDelay).toBe(200);
  });

  it('should accept full config with dragItem and dropZone', () => {
    const config: DndConfig = {
      enabled: true,
      dragItem: { type: 'card', handle: 'handle', preview: 'custom', disabled: false },
      dropZone: { accept: ['card'], maxItems: 10, highlightOnDragOver: true, dropEffect: 'copy' },
      sortable: true,
      autoScroll: false,
      touchDelay: 300,
    };
    const result = DndConfigSchema.parse(config);
    expect(result.enabled).toBe(true);
    expect(result.dragItem?.type).toBe('card');
    expect(result.dropZone?.accept).toEqual(['card']);
    expect(result.sortable).toBe(true);
    expect(result.autoScroll).toBe(false);
    expect(result.touchDelay).toBe(300);
  });

  it('should leave dragItem and dropZone undefined when not provided', () => {
    const result = DndConfigSchema.parse({});
    expect(result.dragItem).toBeUndefined();
    expect(result.dropZone).toBeUndefined();
  });

  it('should accept config with only dragItem', () => {
    const result = DndConfigSchema.parse({
      enabled: true,
      dragItem: { type: 'row' },
    });
    expect(result.dragItem?.type).toBe('row');
    expect(result.dropZone).toBeUndefined();
  });
});

describe('Type exports', () => {
  it('should have valid type exports', () => {
    const handle: DragHandle = 'grip_icon';
    const effect: DropEffect = 'copy';
    const constraint: DragConstraint = { axis: 'both', bounds: 'none' };
    const zone: DropZone = { accept: ['card'], highlightOnDragOver: true, dropEffect: 'move' };
    const item: DragItem = { type: 'card', handle: 'element', preview: 'element', disabled: false };
    const config: DndConfig = { enabled: false, sortable: false, autoScroll: true, touchDelay: 200 };
    expect(handle).toBeDefined();
    expect(effect).toBeDefined();
    expect(constraint).toBeDefined();
    expect(zone).toBeDefined();
    expect(item).toBeDefined();
    expect(config).toBeDefined();
  });
});

describe('I18n and ARIA integration', () => {
  it('should reject I18n label on DropZoneSchema', () => {
    expect(() => DropZoneSchema.parse({
      accept: ['card'],
      label: { key: 'dnd.drop_zone', defaultValue: 'Drop items here' },
    })).toThrow();
  });

  it('should accept ARIA props on DropZoneSchema', () => {
    const result = DropZoneSchema.parse({
      accept: ['task'],
      ariaLabel: 'Task drop zone',
      role: 'region',
    });
    expect(result.ariaLabel).toBe('Task drop zone');
    expect(result.role).toBe('region');
  });

  it('should accept I18n label on DragItemSchema', () => {
    const result = DragItemSchema.parse({
      type: 'card',
      label: 'Drag this card',
    });
    expect(result.label).toBe('Drag this card');
  });

  it('should reject ARIA props on DragItemSchema', () => {
    expect(() => DragItemSchema.parse({
      type: 'row',
      ariaLabel: { key: 'dnd.drag_row', defaultValue: 'Draggable row' },
      ariaDescribedBy: 'row-desc',
    })).toThrow();
  });

  it('should leave I18n/ARIA fields undefined when not provided', () => {
    const zone = DropZoneSchema.parse({ accept: ['item'] });
    expect(zone.label).toBeUndefined();
    expect(zone.ariaLabel).toBeUndefined();
    const item = DragItemSchema.parse({ type: 'card' });
    expect(item.label).toBeUndefined();
    expect(item.ariaLabel).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { 
  MappingSchema, 
  FieldMappingSchema, 
  TransformType,
  type Mapping, 
  type FieldMapping 
} from './mapping.zod';

describe('TransformType', () => {
  it('should accept valid transform types', () => {
    const validTypes = ['none', 'constant', 'lookup', 'split', 'join', 'javascript', 'map'];
    
    validTypes.forEach(type => {
      expect(() => TransformType.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid transform types', () => {
    expect(() => TransformType.parse('custom')).toThrow();
    expect(() => TransformType.parse('transform')).toThrow();
    expect(() => TransformType.parse('')).toThrow();
  });
});

describe('FieldMappingSchema', () => {
  it('should accept valid minimal field mapping', () => {
    const validMapping: FieldMapping = {
      source: 'first_name',
      target: 'firstName'
    };

    expect(() => FieldMappingSchema.parse(validMapping)).not.toThrow();
  });

  it('should accept field mapping with single source and target', () => {
    const mapping = FieldMappingSchema.parse({
      source: 'email',
      target: 'email_address',
      transform: 'none'
    });

    expect(mapping.source).toBe('email');
    expect(mapping.target).toBe('email_address');
  });

  it('should accept field mapping with array sources', () => {
    const mapping = FieldMappingSchema.parse({
      source: ['first_name', 'last_name'],
      target: 'full_name',
      transform: 'join',
      params: { separator: ' ' }
    });

    expect(mapping.source).toEqual(['first_name', 'last_name']);
  });

  it('should accept field mapping with array targets', () => {
    const mapping = FieldMappingSchema.parse({
      source: 'full_name',
      target: ['first_name', 'last_name'],
      transform: 'split',
      params: { separator: ' ' }
    });

    expect(mapping.target).toEqual(['first_name', 'last_name']);
  });

  it('should apply default transform type', () => {
    const mapping = FieldMappingSchema.parse({
      source: 'field1',
      target: 'field2'
    });

    expect(mapping.transform).toBe('none');
  });

  it('should accept constant transform', () => {
    const mapping = FieldMappingSchema.parse({
      source: 'unused',
      target: 'status',
      transform: 'constant',
      params: { value: 'active' }
    });

    expect(mapping.transform).toBe('constant');
    expect(mapping.params?.value).toBe('active');
  });

  it('should accept lookup transform', () => {
    const mapping = FieldMappingSchema.parse({
      source: 'account_name',
      target: 'account_id',
      transform: 'lookup',
      params: {
        object: 'account',
        fromField: 'name',
        toField: 'id',
        autoCreate: false
      }
    });

    expect(mapping.transform).toBe('lookup');
    expect(mapping.params?.object).toBe('account');
    expect(mapping.params?.fromField).toBe('name');
    expect(mapping.params?.toField).toBe('id');
  });

  it('should accept map transform', () => {
    const mapping = FieldMappingSchema.parse({
      source: 'status',
      target: 'status_code',
      transform: 'map',
      params: {
        valueMap: {
          'Open': 'open',
          'In Progress': 'in_progress',
          'Closed': 'closed'
        }
      }
    });

    expect(mapping.transform).toBe('map');
    expect(mapping.params?.valueMap).toHaveProperty('Open', 'open');
  });

  it('should accept split transform', () => {
    const mapping = FieldMappingSchema.parse({
      source: 'full_name',
      target: ['first_name', 'last_name'],
      transform: 'split',
      params: { separator: ' ' }
    });

    expect(mapping.transform).toBe('split');
    expect(mapping.params?.separator).toBe(' ');
  });

  it('should accept join transform', () => {
    const mapping = FieldMappingSchema.parse({
      source: ['street', 'city', 'zip'],
      target: 'full_address',
      transform: 'join',
      params: { separator: ', ' }
    });

    expect(mapping.transform).toBe('join');
    expect(mapping.params?.separator).toBe(', ');
  });

  it('should accept javascript transform', () => {
    const mapping = FieldMappingSchema.parse({
      source: 'raw_data',
      target: 'processed_data',
      transform: 'javascript',
      params: { value: 'return value.toUpperCase();' }
    });

    expect(mapping.transform).toBe('javascript');
  });
});

describe('MappingSchema', () => {
  it('should accept valid minimal mapping', () => {
    const validMapping: Mapping = {
      name: 'csv_import',
      targetObject: 'contact',
      fieldMapping: [
        { source: 'email', target: 'email' }
      ]
    };

    expect(() => MappingSchema.parse(validMapping)).not.toThrow();
  });

  it('should accept mapping with all fields', () => {
    const fullMapping: Mapping = {
      name: 'contact_import',
      label: 'Contact CSV Import',
      sourceFormat: 'csv',
      targetObject: 'contact',
      fieldMapping: [
        { source: 'email', target: 'email' },
        { source: 'name', target: 'full_name' }
      ],
      mode: 'upsert',
      upsertKey: ['email'],
      errorPolicy: 'skip',
      batchSize: 500
    };

    expect(() => MappingSchema.parse(fullMapping)).not.toThrow();
  });

  it('should validate mapping name format (snake_case)', () => {
    expect(() => MappingSchema.parse({
      name: 'valid_mapping_name',
      targetObject: 'object',
      fieldMapping: []
    })).not.toThrow();

    expect(() => MappingSchema.parse({
      name: 'InvalidMapping',
      targetObject: 'object',
      fieldMapping: []
    })).toThrow();

    expect(() => MappingSchema.parse({
      name: 'invalid-mapping',
      targetObject: 'object',
      fieldMapping: []
    })).toThrow();
  });

  it('should apply default values', () => {
    const mapping = MappingSchema.parse({
      name: 'test_mapping',
      targetObject: 'contact',
      fieldMapping: []
    });

    expect(mapping.sourceFormat).toBe('csv');
    expect(mapping.mode).toBe('insert');
    expect(mapping.errorPolicy).toBe('skip');
    expect(mapping.batchSize).toBe(1000);
  });

  it('should accept different source formats', () => {
    const formats: Array<Mapping['sourceFormat']> = ['csv', 'json', 'xml', 'sql'];
    
    formats.forEach(format => {
      const mapping = MappingSchema.parse({
        name: 'test_mapping',
        sourceFormat: format,
        targetObject: 'object',
        fieldMapping: []
      });
      expect(mapping.sourceFormat).toBe(format);
    });
  });

  it('should accept different modes', () => {
    const modes: Array<Mapping['mode']> = ['insert', 'update', 'upsert'];
    
    modes.forEach(mode => {
      const mapping = MappingSchema.parse({
        name: 'test_mapping',
        targetObject: 'object',
        fieldMapping: [],
        mode
      });
      expect(mapping.mode).toBe(mode);
    });
  });

  it('should accept upsertKey with multiple fields', () => {
    const mapping = MappingSchema.parse({
      name: 'test_mapping',
      targetObject: 'contact',
      fieldMapping: [],
      mode: 'upsert',
      upsertKey: ['email', 'phone']
    });

    expect(mapping.upsertKey).toEqual(['email', 'phone']);
  });

  it('should accept different error policies', () => {
    const policies: Array<Mapping['errorPolicy']> = ['skip', 'abort', 'retry'];
    
    policies.forEach(policy => {
      const mapping = MappingSchema.parse({
        name: 'test_mapping',
        targetObject: 'object',
        fieldMapping: [],
        errorPolicy: policy
      });
      expect(mapping.errorPolicy).toBe(policy);
    });
  });

  it('should accept custom batch size', () => {
    const mapping = MappingSchema.parse({
      name: 'test_mapping',
      targetObject: 'object',
      fieldMapping: [],
      batchSize: 100
    });

    expect(mapping.batchSize).toBe(100);
  });

  it('should accept extractQuery for export', () => {
    const mapping = MappingSchema.parse({
      name: 'export_mapping',
      targetObject: 'contact',
      fieldMapping: [{ source: 'email', target: 'email' }],
      extractQuery: {
        object: 'contact',
        fields: ['id', 'email', 'name'],
        filters: ['status', '=', 'active']
      }
    });

    expect(mapping.extractQuery).toBeDefined();
    expect(mapping.extractQuery?.object).toBe('contact');
  });

  it('should handle CSV import mapping', () => {
    const csvMapping = MappingSchema.parse({
      name: 'csv_contact_import',
      sourceFormat: 'csv',
      targetObject: 'contact',
      fieldMapping: [
        { source: 'Email', target: 'email' },
        { source: 'First Name', target: 'first_name' },
        { source: 'Last Name', target: 'last_name' }
      ],
      mode: 'upsert',
      upsertKey: ['email']
    });

    expect(csvMapping.sourceFormat).toBe('csv');
    expect(csvMapping.fieldMapping).toHaveLength(3);
  });

  it('should handle JSON import mapping', () => {
    const jsonMapping = MappingSchema.parse({
      name: 'json_import',
      sourceFormat: 'json',
      targetObject: 'product',
      fieldMapping: [
        { source: 'sku', target: 'product_code' },
        { source: 'name', target: 'product_name' }
      ]
    });

    expect(jsonMapping.sourceFormat).toBe('json');
  });

  it('should handle complex field mappings', () => {
    const complexMapping = MappingSchema.parse({
      name: 'complex_import',
      targetObject: 'contact',
      fieldMapping: [
        { 
          source: 'email', 
          target: 'email',
          transform: 'none'
        },
        { 
          source: 'unused', 
          target: 'status',
          transform: 'constant',
          params: { value: 'active' }
        },
        {
          source: 'account_name',
          target: 'account_id',
          transform: 'lookup',
          params: {
            object: 'account',
            fromField: 'name',
            toField: 'id'
          }
        },
        {
          source: ['first_name', 'last_name'],
          target: 'full_name',
          transform: 'join',
          params: { separator: ' ' }
        }
      ]
    });

    expect(complexMapping.fieldMapping).toHaveLength(4);
  });

  it('should reject mapping without required fields', () => {
    expect(() => MappingSchema.parse({
      targetObject: 'object',
      fieldMapping: []
    })).toThrow();

    expect(() => MappingSchema.parse({
      name: 'test_mapping',
      fieldMapping: []
    })).toThrow();

    expect(() => MappingSchema.parse({
      name: 'test_mapping',
      targetObject: 'object'
    })).toThrow();
  });

  it('should reject invalid source format', () => {
    expect(() => MappingSchema.parse({
      name: 'test_mapping',
      sourceFormat: 'excel',
      targetObject: 'object',
      fieldMapping: []
    })).toThrow();
  });

  it('should reject invalid mode', () => {
    expect(() => MappingSchema.parse({
      name: 'test_mapping',
      targetObject: 'object',
      fieldMapping: [],
      mode: 'merge'
    })).toThrow();
  });

  it('should reject invalid error policy', () => {
    expect(() => MappingSchema.parse({
      name: 'test_mapping',
      targetObject: 'object',
      fieldMapping: [],
      errorPolicy: 'ignore'
    })).toThrow();
  });
});

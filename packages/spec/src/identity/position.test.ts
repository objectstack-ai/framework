import { describe, it, expect } from 'vitest';
import { PositionSchema, type Position } from './position.zod';

describe('PositionSchema', () => {
  describe('Basic Properties', () => {
    it('should accept minimal position', () => {
      const position: Position = {
        name: 'ceo',
        label: 'CEO',
      };

      expect(() => PositionSchema.parse(position)).not.toThrow();
    });

    it('should enforce snake_case for position name', () => {
      const validNames = ['ceo', 'vp_sales', 'sales_manager', 'account_exec'];
      validNames.forEach(name => {
        expect(() => PositionSchema.parse({ name, label: 'Test' })).not.toThrow();
      });

      const invalidNames = ['CEO', 'VP-Sales', 'salesManager', '123position', '_internal'];
      invalidNames.forEach(name => {
        expect(() => PositionSchema.parse({ name, label: 'Test' })).toThrow();
      });
    });

    it('should accept position with description', () => {
      const position: Position = {
        name: 'sales_director',
        label: 'Sales Director',
        description: 'Oversees all sales operations',
      };

      expect(() => PositionSchema.parse(position)).not.toThrow();
    });
  });

  describe('Delegation (ADR-0091 D3)', () => {
    it('defaults delegatable to false (opt-in)', () => {
      const parsed = PositionSchema.parse({ name: 'approver', label: 'Approver' });
      expect(parsed.delegatable).toBe(false);
    });

    it('accepts an explicit delegatable flag', () => {
      expect(PositionSchema.parse({ name: 'approver', label: 'Approver', delegatable: true }).delegatable).toBe(true);
      expect(PositionSchema.parse({ name: 'approver', label: 'Approver', delegatable: false }).delegatable).toBe(false);
    });

    it('rejects a non-boolean delegatable', () => {
      expect(() => PositionSchema.parse({ name: 'approver', label: 'Approver', delegatable: 'yes' as any })).toThrow();
    });
  });

  describe('Hierarchy', () => {
    it('should accept position without parent (top level)', () => {
      const position: Position = {
        name: 'ceo',
        label: 'Chief Executive Officer',
      };

      expect(() => PositionSchema.parse(position)).not.toThrow();
    });

    it('should accept position with parent', () => {
      const position: Position = {
        name: 'vp_sales',
        label: 'VP of Sales',
        parent: 'ceo',
      };

      expect(() => PositionSchema.parse(position)).not.toThrow();
    });
  });

  describe('Real-World Position Examples', () => {
    it('should accept complete sales organization hierarchy', () => {
      const positions: Position[] = [
        {
          name: 'ceo',
          label: 'Chief Executive Officer',
          description: 'Top executive position',
        },
        {
          name: 'vp_sales',
          label: 'VP of Sales',
          parent: 'ceo',
          description: 'Leads entire sales organization',
        },
        {
          name: 'regional_sales_director',
          label: 'Regional Sales Director',
          parent: 'vp_sales',
          description: 'Manages sales for a specific region',
        },
        {
          name: 'sales_manager',
          label: 'Sales Manager',
          parent: 'regional_sales_director',
          description: 'Manages a team of sales representatives',
        },
        {
          name: 'senior_sales_rep',
          label: 'Senior Sales Representative',
          parent: 'sales_manager',
          description: 'Senior member of sales team',
        },
        {
          name: 'sales_rep',
          label: 'Sales Representative',
          parent: 'sales_manager',
          description: 'Individual contributor in sales',
        },
      ];

      positions.forEach(position => {
        expect(() => PositionSchema.parse(position)).not.toThrow();
      });
    });

    it('should accept service organization hierarchy', () => {
      const positions: Position[] = [
        {
          name: 'vp_customer_success',
          label: 'VP of Customer Success',
        },
        {
          name: 'support_manager',
          label: 'Support Manager',
          parent: 'vp_customer_success',
        },
        {
          name: 'senior_support_agent',
          label: 'Senior Support Agent',
          parent: 'support_manager',
        },
        {
          name: 'support_agent',
          label: 'Support Agent',
          parent: 'support_manager',
        },
      ];

      positions.forEach(position => {
        expect(() => PositionSchema.parse(position)).not.toThrow();
      });
    });

    it('should accept product organization hierarchy', () => {
      const positions: Position[] = [
        {
          name: 'cto',
          label: 'Chief Technology Officer',
        },
        {
          name: 'vp_engineering',
          label: 'VP of Engineering',
          parent: 'cto',
        },
        {
          name: 'engineering_manager',
          label: 'Engineering Manager',
          parent: 'vp_engineering',
          description: 'Manages engineering team',
        },
        {
          name: 'tech_lead',
          label: 'Technical Lead',
          parent: 'engineering_manager',
        },
        {
          name: 'senior_engineer',
          label: 'Senior Software Engineer',
          parent: 'engineering_manager',
        },
        {
          name: 'engineer',
          label: 'Software Engineer',
          parent: 'engineering_manager',
        },
      ];

      positions.forEach(position => {
        expect(() => PositionSchema.parse(position)).not.toThrow();
      });
    });

    it('should accept matrix organization with multiple reporting lines', () => {
      const positions: Position[] = [
        {
          name: 'ceo',
          label: 'CEO',
        },
        {
          name: 'regional_vp_americas',
          label: 'Regional VP - Americas',
          parent: 'ceo',
        },
        {
          name: 'regional_vp_emea',
          label: 'Regional VP - EMEA',
          parent: 'ceo',
        },
        {
          name: 'regional_vp_apac',
          label: 'Regional VP - APAC',
          parent: 'ceo',
        },
        {
          name: 'country_manager_us',
          label: 'Country Manager - US',
          parent: 'regional_vp_americas',
        },
        {
          name: 'country_manager_uk',
          label: 'Country Manager - UK',
          parent: 'regional_vp_emea',
        },
      ];

      positions.forEach(position => {
        expect(() => PositionSchema.parse(position)).not.toThrow();
      });
    });

    it('should accept flat organization', () => {
      const positions: Position[] = [
        {
          name: 'founder',
          label: 'Founder',
        },
        {
          name: 'team_member',
          label: 'Team Member',
          parent: 'founder',
        },
      ];

      positions.forEach(position => {
        expect(() => PositionSchema.parse(position)).not.toThrow();
      });
    });
  });
});

/**
 * Unit tests for logical filter operators
 */

import { describe, expect, test } from "@jest/globals";
import df from "@rdfjs/data-model";
import type { FilterContext } from "../types";
import { applyLogicalOperator } from "./logical";

// Mock context for testing
const createMockContext = (property: string = 'email'): FilterContext => {
  const subject = df.variable('person');
  const propertyVar = df.variable(property);
  const predicateNode = df.namedNode(`http://example.com/${property}`);
  
  return {
    subject,
    property,
    propertyVar,
    predicateNode,
    schemaType: 'string',
    prefixMap: { ex: 'http://example.com/' },
    flavour: 'default',
    depth: 0,
  };
};

describe('Logical Operators', () => {
  describe('applyLogicalOperator - OR', () => {
    test('should combine simple string filters with OR', () => {
      const context = createMockContext('email');
      
      // OR with multiple endsWith conditions
      const conditions = [
        { endsWith: 'gmail.com' },
        { endsWith: 'company.com' }
      ];
      
      const result = applyLogicalOperator('OR', conditions, context);
      
      // Should have patterns and combined filter
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.filters.length).toBeGreaterThan(0);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('||');
    });

    test('should throw error for complex OR (UNION not implemented yet)', () => {
      const context = createMockContext('age');
      
      // Complex OR that can't use simple combined FILTER
      const conditions = [
        { equals: 18 },
        { in: [25, 30, 35] }  // This uses VALUES, making it complex
      ];
      
      expect(() => {
        applyLogicalOperator('OR', conditions, context);
      }).toThrow('Complex OR with UNION not yet implemented');
    });
  });

  describe('applyLogicalOperator - AND', () => {
    test('should combine multiple conditions with AND', () => {
      const context = createMockContext('email');
      
      const conditions = [
        { contains: 'admin' },
        { endsWith: '.com' }
      ];
      
      const result = applyLogicalOperator('AND', conditions, context);
      
      // AND just combines all patterns and filters
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.filters.length).toBeGreaterThan(0);
    });

    test('should handle empty conditions array', () => {
      const context = createMockContext('email');
      const result = applyLogicalOperator('AND', [], context);
      
      expect(result.patterns).toHaveLength(0);
      expect(result.filters).toHaveLength(0);
    });
  });

  describe('applyLogicalOperator - NOT', () => {
    test('should wrap condition in FILTER NOT EXISTS', () => {
      const context = createMockContext('email');
      
      const condition = { endsWith: 'spam.com' };
      
      const result = applyLogicalOperator('NOT', condition, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(0); // NOT EXISTS is a pattern, not a filter
      
      const patternStr = result.patterns[0].toString();
      expect(patternStr).toContain('NOT EXISTS');
    });

    test('should handle array with single condition', () => {
      const context = createMockContext('email');
      const result = applyLogicalOperator('NOT', [{ contains: 'test' }], context);
      
      expect(result.patterns).toHaveLength(1);
    });
  });

  describe('applyLogicalOperator - edge cases', () => {
    test('should handle non-array value for AND', () => {
      const context = createMockContext('email');
      const result = applyLogicalOperator('AND', { contains: 'test' }, context);
      
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    test('should handle non-array value for OR', () => {
      const context = createMockContext('email');
      const result = applyLogicalOperator('OR', { endsWith: '.com' }, context);
      
      expect(result.patterns.length).toBeGreaterThan(0);
    });
  });
});

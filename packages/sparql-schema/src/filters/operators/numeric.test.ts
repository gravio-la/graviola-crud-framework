/**
 * Unit tests for numeric filter operators
 */

import { describe, expect, test } from "@jest/globals";
import df from "@rdfjs/data-model";
import type { FilterContext } from "../types";
import { applyNumericOperator } from "./numeric";

// Mock context for testing
const createMockContext = (): FilterContext => {
  const subject = df.variable('person');
  const propertyVar = df.variable('age');
  const predicateNode = df.namedNode('http://example.com/age');
  
  return {
    subject,
    property: 'age',
    propertyVar,
    predicateNode,
    schemaType: 'number',
    prefixMap: { ex: 'http://example.com/' },
    flavour: 'default',
    depth: 0,
  };
};

describe('Numeric Operators', () => {
  describe('applyNumericOperator - gt', () => {
    test('should generate FILTER with > operator', () => {
      const context = createMockContext();
      const result = applyNumericOperator('gt', 18, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      expect(result.optional).toBe(false);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('>');
    });
  });

  describe('applyNumericOperator - gte', () => {
    test('should generate FILTER with >= operator', () => {
      const context = createMockContext();
      const result = applyNumericOperator('gte', 18, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('>=');
    });
  });

  describe('applyNumericOperator - lt', () => {
    test('should generate FILTER with < operator', () => {
      const context = createMockContext();
      const result = applyNumericOperator('lt', 65, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('<');
    });
  });

  describe('applyNumericOperator - lte', () => {
    test('should generate FILTER with <= operator', () => {
      const context = createMockContext();
      const result = applyNumericOperator('lte', 100, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('<=');
    });
  });

  describe('applyNumericOperator - datatype handling', () => {
    test('should include XSD integer datatype in literal', () => {
      const context = createMockContext();
      const result = applyNumericOperator('gte', 18, context);
      
      const filterStr = result.filters[0].toString();
      // Check that the datatype is included
      expect(filterStr).toContain('XMLSchema#integer');
    });

    test('should handle zero value', () => {
      const context = createMockContext();
      const result = applyNumericOperator('gt', 0, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
    });

    test('should handle negative values', () => {
      const context = createMockContext();
      const result = applyNumericOperator('lt', -10, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
    });
  });
});

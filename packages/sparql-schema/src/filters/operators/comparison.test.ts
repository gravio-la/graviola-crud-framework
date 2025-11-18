/**
 * Unit tests for comparison filter operators
 */

import { describe, expect, test } from "@jest/globals";
import df from "@rdfjs/data-model";
import { sparql } from "@tpluscode/sparql-builder";
import type { FilterContext } from "../types";
import {
  applyEqualsOperator,
  applyNotOperator,
  applyInOperator,
  applyNotInOperator,
  applyComparisonOperator
} from "./comparison";

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

describe('Comparison Operators', () => {
  describe('applyEqualsOperator', () => {
    test('should generate direct triple pattern for equals', () => {
      const context = createMockContext();
      const result = applyEqualsOperator(25, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(0);
      expect(result.optional).toBe(false);
      
      // Check that pattern contains the triple
      const patternStr = result.patterns[0].toString();
      expect(patternStr).toContain('?person');
      expect(patternStr).toContain('25');
    });

    test('should handle string values', () => {
      const context = createMockContext();
      context.schemaType = 'string';
      const result = applyEqualsOperator('active', context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(0);
    });
  });

  describe('applyNotOperator', () => {
    test('should generate pattern with FILTER for not', () => {
      const context = createMockContext();
      const result = applyNotOperator(25, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      expect(result.optional).toBe(false);
      
      // Check that filter contains !=
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('!=');
    });
  });

  describe('applyInOperator', () => {
    test('should generate VALUES clause for in', () => {
      const context = createMockContext();
      const result = applyInOperator(['active', 'pending', 'completed'], context);
      
      expect(result.patterns).toHaveLength(2); // VALUES + triple pattern
      expect(result.filters).toHaveLength(0);
      expect(result.optional).toBe(false);
      
      // Check for VALUES clause
      const valuesStr = result.patterns[0].toString();
      expect(valuesStr).toContain('VALUES');
    });

    test('should handle numeric values', () => {
      const context = createMockContext();
      const result = applyInOperator([1, 2, 3, 4, 5], context);
      
      expect(result.patterns).toHaveLength(2);
      expect(result.filters).toHaveLength(0);
    });

    test('should handle empty array', () => {
      const context = createMockContext();
      const result = applyInOperator([], context);
      
      expect(result.patterns).toHaveLength(2);
    });
  });

  describe('applyNotInOperator', () => {
    test('should generate pattern with FILTER NOT IN', () => {
      const context = createMockContext();
      const result = applyNotInOperator(['deleted', 'banned'], context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      expect(result.optional).toBe(false);
      
      // Check for NOT IN in filter
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('NOT IN');
    });
  });

  describe('applyComparisonOperator', () => {
    test('should dispatch to equals operator', () => {
      const context = createMockContext();
      const result = applyComparisonOperator('equals', 25, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(0);
    });

    test('should dispatch to not operator', () => {
      const context = createMockContext();
      const result = applyComparisonOperator('not', 25, context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
    });

    test('should dispatch to in operator', () => {
      const context = createMockContext();
      const result = applyComparisonOperator('in', [1, 2, 3], context);
      
      expect(result.patterns).toHaveLength(2);
      expect(result.filters).toHaveLength(0);
    });

    test('should dispatch to notIn operator', () => {
      const context = createMockContext();
      const result = applyComparisonOperator('notIn', [1, 2, 3], context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
    });
  });
});

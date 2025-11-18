/**
 * Unit tests for string filter operators
 */

import { describe, expect, test } from "@jest/globals";
import df from "@rdfjs/data-model";
import type { FilterContext } from "../types";
import { applyStringOperator } from "./string";

// Mock context for testing
const createMockContext = (): FilterContext => {
  const subject = df.variable('person');
  const propertyVar = df.variable('email');
  const predicateNode = df.namedNode('http://example.com/email');
  
  return {
    subject,
    property: 'email',
    propertyVar,
    predicateNode,
    schemaType: 'string',
    prefixMap: { ex: 'http://example.com/' },
    flavour: 'default',
    depth: 0,
  };
};

describe('String Operators', () => {
  describe('applyStringOperator - contains', () => {
    test('should generate CONTAINS filter for case-sensitive', () => {
      const context = createMockContext();
      const result = applyStringOperator('contains', 'example', 'default', context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      expect(result.optional).toBe(false);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('CONTAINS');
    });

    test('should generate REGEX filter for case-insensitive', () => {
      const context = createMockContext();
      const result = applyStringOperator('contains', 'example', 'insensitive', context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('REGEX');
      expect(filterStr).toContain('"i"');
    });
  });

  describe('applyStringOperator - startsWith', () => {
    test('should generate STRSTARTS filter for case-sensitive', () => {
      const context = createMockContext();
      const result = applyStringOperator('startsWith', 'admin', 'default', context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('STRSTARTS');
    });

    test('should generate REGEX filter with ^ for case-insensitive', () => {
      const context = createMockContext();
      const result = applyStringOperator('startsWith', 'admin', 'insensitive', context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('REGEX');
      expect(filterStr).toContain('^admin');
    });
  });

  describe('applyStringOperator - endsWith', () => {
    test('should generate STRENDS filter for case-sensitive', () => {
      const context = createMockContext();
      const result = applyStringOperator('endsWith', '.com', 'default', context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('FILTER');
      expect(filterStr).toContain('STRENDS');
    });

    test('should generate REGEX filter with $ for case-insensitive', () => {
      const context = createMockContext();
      const result = applyStringOperator('endsWith', '.com', 'insensitive', context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('REGEX');
      expect(filterStr).toContain('.com$');
    });
  });

  describe('applyStringOperator - mode handling', () => {
    test('should default to case-sensitive when mode not specified', () => {
      const context = createMockContext();
      const result = applyStringOperator('contains', 'test', undefined, context);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('CONTAINS');
      expect(filterStr).not.toContain('REGEX');
    });

    test('should handle special regex characters in search string', () => {
      const context = createMockContext();
      // This tests that we properly handle strings that might have regex special chars
      const result = applyStringOperator('contains', 'test.example', 'insensitive', context);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
    });
  });
});

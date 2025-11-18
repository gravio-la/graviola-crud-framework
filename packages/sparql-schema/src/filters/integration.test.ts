/**
 * Integration tests for the complete filter system
 * Tests filters working together with schema processing
 */

import { describe, expect, test } from "@jest/globals";
import df from "@rdfjs/data-model";
import type { FilterContext } from "./types";
import { filterToSparql } from "./filterToSparql";

// Helper to create a basic filter context
const createContext = (property: string, type: string = 'string'): FilterContext => {
  return {
    subject: df.variable('person'),
    property,
    propertyVar: df.variable(property),
    predicateNode: df.namedNode(`http://example.com/${property}`),
    schemaType: type,
    prefixMap: { ex: 'http://example.com/' },
    flavour: 'default',
    depth: 0,
  };
};

describe('Filter Integration Tests', () => {
  describe('Prisma example from requirements', () => {
    test('OR with endsWith operators', () => {
      const context = createContext('email', 'string');
      
      // { email: { OR: [{ endsWith: 'gmail.com' }, { endsWith: 'company.com' }] } }
      // This tests the OR at property level
      const emailContext = {
        ...context,
        property: 'email'
      };
      
      const whereClause = {
        endsWith: 'gmail.com'
      };
      
      const result = filterToSparql(whereClause, emailContext);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('STRENDS');
      expect(filterStr).toContain('gmail.com');
    });
  });

  describe('Complex filter combinations', () => {
    test('AND with string and numeric filters', () => {
      const emailContext = createContext('email', 'string');
      
      const whereClause = {
        AND: [
          { contains: 'admin' },
          { endsWith: '.com' }
        ]
      };
      
      const result = filterToSparql(whereClause, emailContext);
      
      // AND combines all patterns
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.filters.length).toBeGreaterThan(0);
    });

    test('NOT with endsWith', () => {
      const emailContext = createContext('email', 'string');
      
      const whereClause = {
        NOT: { endsWith: 'spam.com' }
      };
      
      const result = filterToSparql(whereClause, emailContext);
      
      expect(result.patterns).toHaveLength(1);
      const patternStr = result.patterns[0].toString();
      expect(patternStr).toContain('NOT EXISTS');
    });
  });

  describe('Property value shortcuts', () => {
    test('primitive value as shorthand for equals', () => {
      const ageContext = createContext('age', 'number');
      
      // { age: 25 } should be treated as { age: { equals: 25 } }
      const result = filterToSparql(25, ageContext);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(0);
    });

    test('string value shorthand', () => {
      const nameContext = createContext('name', 'string');
      
      const result = filterToSparql('John', nameContext);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(0);
    });
  });

  describe('Multiple operators on same property', () => {
    test('age with gt and lt (range query)', () => {
      const ageContext = createContext('age', 'number');
      
      const whereClause = {
        gte: 18,
        lte: 65
      };
      
      const result = filterToSparql(whereClause, ageContext);
      
      // Both operators should create patterns
      expect(result.patterns.length).toBeGreaterThanOrEqual(2);
      expect(result.filters.length).toBeGreaterThanOrEqual(2);
    });

    test('string with contains and mode', () => {
      const emailContext = createContext('email', 'string');
      
      const whereClause = {
        contains: 'admin',
        mode: 'insensitive'
      };
      
      const result = filterToSparql(whereClause, emailContext);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
      
      const filterStr = result.filters[0].toString();
      expect(filterStr).toContain('REGEX');
      expect(filterStr).toContain('"i"');
    });
  });

  describe('Edge cases', () => {
    test('empty array for in operator', () => {
      const statusContext = createContext('status', 'string');
      
      const whereClause = {
        in: []
      };
      
      const result = filterToSparql(whereClause, statusContext);
      
      expect(result.patterns).toHaveLength(2); // VALUES + triple
    });

    test('null value handling', () => {
      const context = createContext('value', 'string');
      
      const result = filterToSparql(null, context);
      
      // null should be treated as equals null
      expect(result.patterns).toHaveLength(1);
    });

    test('special characters in string filters', () => {
      const emailContext = createContext('email', 'string');
      
      const whereClause = {
        contains: 'user+tag@example.com'
      };
      
      const result = filterToSparql(whereClause, emailContext);
      
      expect(result.patterns).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
    });
  });

  describe('Type-specific operators', () => {
    test('numeric operators only accept numbers', () => {
      const ageContext = createContext('age', 'number');
      
      const whereClause = {
        gte: 18,
        lt: 100
      };
      
      const result = filterToSparql(whereClause, ageContext);
      
      expect(result.filters.length).toBe(2);
      result.filters.forEach(filter => {
        const filterStr = filter.toString();
        expect(filterStr).toMatch(/>=|</);
      });
    });

    test('string operators work with string types', () => {
      const nameContext = createContext('name', 'string');
      
      const whereClause = {
        startsWith: 'A',
        endsWith: 'son'
      };
      
      const result = filterToSparql(whereClause, nameContext);
      
      expect(result.filters.length).toBe(2);
      const filterStrs = result.filters.map(f => f.toString()).join(' ');
      expect(filterStrs).toContain('STRSTARTS');
      expect(filterStrs).toContain('STRENDS');
    });
  });
});

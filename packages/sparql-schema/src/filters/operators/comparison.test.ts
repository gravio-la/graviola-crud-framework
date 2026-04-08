/**
 * Unit tests for comparison operators
 * Focus: datatype handling, especially for booleans
 */

import { describe, test, expect } from "bun:test";
import { applyEqualsOperator, applyInOperator } from "./comparison";
import type { FilterContext } from "../types";
import { sparql } from "@tpluscode/sparql-builder";
import df from "@rdfjs/data-model";

describe("Comparison Operators - Datatype Handling", () => {
  const createContext = (schemaType?: string): FilterContext => ({
    subject: sparql`?person`,
    property: "isAvailable",
    propertyVar: sparql`?isAvailable`,
    predicateNode: df.namedNode("http://example.org/isAvailable"),
    schemaType,
    prefixMap: {},
    flavour: "default",
    depth: 0,
  });

  describe("applyEqualsOperator", () => {
    test("boolean value with schemaType='boolean' should use xsd:boolean datatype", () => {
      const context = createContext("boolean");
      const result = applyEqualsOperator(true, context);

      expect(result.patterns.length).toBe(1);
      const pattern = result.patterns[0].toString();

      // The sparql-builder serializes boolean literals as bare "true"/"false"
      // which is valid SPARQL syntax (they implicitly have xsd:boolean datatype)
      expect(pattern).toContain("true");

      // Pattern should be a direct triple pattern (not FILTER), making it efficient
      expect(result.filters.length).toBe(0);
      expect(result.optional).toBe(false);
    });

    test("boolean value without schemaType should infer xsd:boolean from JS type", () => {
      const context = createContext(undefined); // No schema hint
      const result = applyEqualsOperator(false, context);

      expect(result.patterns.length).toBe(1);
      const pattern = result.patterns[0].toString();

      // Should infer boolean type from JS value
      expect(pattern).toContain("false");
      expect(result.filters.length).toBe(0);
    });

    test("number value with schemaType='number' should use xsd:integer/decimal", () => {
      const context = createContext("number");
      const result = applyEqualsOperator(42, context);

      expect(result.patterns.length).toBe(1);
      const pattern = result.patterns[0].toString();

      // Should contain the number value
      expect(pattern).toContain("42");
      expect(result.filters.length).toBe(0);
    });

    test("string value with schemaType='string' should use plain literal", () => {
      const context = createContext("string");
      const result = applyEqualsOperator("test", context);

      expect(result.patterns.length).toBe(1);
      const pattern = result.patterns[0].toString();

      expect(pattern).toContain("test");
      // Should NOT have datatype for plain strings
    });
  });

  describe("applyInOperator", () => {
    test("boolean values with schemaType='boolean' should use xsd:boolean", () => {
      const context = createContext("boolean");
      const result = applyInOperator([true, false], context);

      expect(result.patterns.length).toBe(2); // VALUES + triple pattern
      const valuesPattern = result.patterns[0].toString();

      // Should contain boolean values
      expect(valuesPattern).toContain("true");
      expect(valuesPattern).toContain("false");
    });

    test("number values should infer numeric datatype", () => {
      const context = createContext("number");
      const result = applyInOperator([1, 2, 3], context);

      expect(result.patterns.length).toBe(2);
      const valuesPattern = result.patterns[0].toString();

      // Should contain the numeric values
      expect(valuesPattern).toContain("1");
      expect(valuesPattern).toContain("2");
      expect(valuesPattern).toContain("3");
    });
  });
});

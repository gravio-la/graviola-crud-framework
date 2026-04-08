/**
 * Unit tests for logical operators (AND, OR, NOT)
 * Focus: compound filter logic
 */

import { describe, test, expect } from "bun:test";
import { applyLogicalOperator } from "./logical";
import type { FilterContext } from "../types";
import { sparql } from "@tpluscode/sparql-builder";
import df from "@rdfjs/data-model";

describe("Logical Operators", () => {
  const createContext = (
    property: string,
    schemaType?: string,
  ): FilterContext => ({
    subject: sparql`?item`,
    property,
    propertyVar: sparql`?${property}`,
    predicateNode: df.namedNode(`http://example.org/${property}`),
    schemaType,
    prefixMap: {},
    flavour: "default",
    depth: 0,
  });

  describe("AND operator", () => {
    test("should combine multiple conditions with AND logic", () => {
      const context = createContext("item");

      // AND: price >= 10 AND isAvailable = true
      const andFilter = {
        AND: [{ price: { gte: 10 } }, { isAvailable: { equals: true } }],
      };

      const result = applyLogicalOperator("AND", andFilter.AND, context);

      console.log("\n=== AND Test ===");
      console.log(
        "Patterns:",
        result.patterns.map((p) => p.toString()),
      );
      console.log(
        "Filters:",
        result.filters.map((f) => f.toString()),
      );
      console.log("Optional:", result.optional);

      expect(result.patterns.length).toBeGreaterThan(0);
      // Should have patterns for both price and isAvailable
    });

    test("should handle AND with boolean equals", () => {
      const context = createContext("item");

      const andFilter = {
        AND: [
          { price: { gte: 10 } },
          { isAvailable: { equals: true } },
          { name: { contains: "test" } },
        ],
      };

      const result = applyLogicalOperator("AND", andFilter.AND, context);

      console.log("\n=== AND with 3 conditions ===");
      console.log(
        "Patterns:",
        result.patterns.map((p) => p.toString()),
      );
      console.log(
        "Filters:",
        result.filters.map((f) => f.toString()),
      );

      // All conditions should be present
      const allPatterns = result.patterns.map((p) => p.toString()).join("\n");
      expect(allPatterns).toContain("price");
      expect(allPatterns).toContain("isAvailable");
      expect(allPatterns).toContain("name");
    });
  });

  describe("OR operator", () => {
    test("should combine multiple conditions with OR logic", () => {
      const context = createContext("item");

      // OR: price <= 25 OR name contains "Lap"
      const orFilter = {
        OR: [{ price: { lte: 25 } }, { name: { contains: "Lap" } }],
      };

      const result = applyLogicalOperator("OR", orFilter.OR, context);

      console.log("\n=== OR Test ===");
      console.log(
        "Patterns:",
        result.patterns.map((p) => p.toString()),
      );
      console.log(
        "Filters:",
        result.filters.map((f) => f.toString()),
      );
      console.log("Optional:", result.optional);

      expect(result.patterns.length).toBeGreaterThan(0);
    });

    test("should handle OR with boolean", () => {
      const context = createContext("item");

      const orFilter = {
        OR: [{ isAvailable: { equals: true } }, { price: { lte: 20 } }],
      };

      const result = applyLogicalOperator("OR", orFilter.OR, context);

      console.log("\n=== OR with boolean ===");
      console.log(
        "Patterns:",
        result.patterns.map((p) => p.toString()),
      );
      console.log(
        "Filters:",
        result.filters.map((f) => f.toString()),
      );

      // Should have patterns for both conditions
      const allPatterns = result.patterns.map((p) => p.toString()).join("\n");
      expect(allPatterns).toContain("isAvailable");
      expect(allPatterns).toContain("price");
    });
  });

  describe("NOT operator", () => {
    test("should negate a condition", () => {
      const context = createContext("item");

      // NOT: isAvailable = true (i.e., find unavailable items)
      const notFilter = {
        NOT: { isAvailable: { equals: true } },
      };

      const result = applyLogicalOperator("NOT", notFilter.NOT, context);

      console.log("\n=== NOT Test ===");
      console.log(
        "Patterns:",
        result.patterns.map((p) => p.toString()),
      );
      console.log(
        "Filters:",
        result.filters.map((f) => f.toString()),
      );

      expect(result.patterns.length).toBeGreaterThan(0);
    });

    test("should handle NOT with multiple fields", () => {
      const context = createContext("item");

      const notFilter = {
        NOT: {
          AND: [{ price: { lte: 10 } }, { isAvailable: { equals: false } }],
        },
      };

      const result = applyLogicalOperator("NOT", notFilter.NOT, context);

      console.log("\n=== NOT with AND ===");
      console.log(
        "Patterns:",
        result.patterns.map((p) => p.toString()),
      );
      console.log(
        "Filters:",
        result.filters.map((f) => f.toString()),
      );

      expect(result.patterns.length).toBeGreaterThan(0);
    });
  });

  describe("Nested logical operators", () => {
    test("should handle AND inside OR", () => {
      const context = createContext("item");

      // (price >= 10 AND isAvailable = true) OR (name contains "special")
      const complexFilter = {
        OR: [
          { AND: [{ price: { gte: 10 } }, { isAvailable: { equals: true } }] },
          { name: { contains: "special" } },
        ],
      };

      const result = applyLogicalOperator("OR", complexFilter.OR, context);

      console.log("\n=== Nested: OR with AND ===");
      console.log(
        "Patterns:",
        result.patterns.map((p) => p.toString()),
      );
      console.log(
        "Filters:",
        result.filters.map((f) => f.toString()),
      );

      expect(result.patterns.length).toBeGreaterThan(0);
    });
  });
});

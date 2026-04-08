/**
 * Relationship filtering tests for normalizedSchema2construct
 *
 * Tests filtering of related entities using:
 * - some: at least one related entity matches
 * - every: all specified entities must be present
 * - none: no related entities match
 * - Nested property filters on relationships
 */

import { describe, test, expect } from "bun:test";
import { JSONSchema7 } from "json-schema";
import { normalizeSchema } from "@graviola/edb-graph-traversal";
import { normalizedSchema2construct } from "./normalizedSchema2construct";
import { buildSPARQLConstructQuery } from "./buildSPARQLConstructQuery";

describe("normalizedSchema2construct - Relationship Filtering", () => {
  describe("Basic relationship filtering with node references", () => {
    test("filters relationship with 'some' and single @id reference", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          knows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                "@id": { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          knows: {
            where: {
              some: {
                "@id": "http://example.com/friend1",
              },
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have pattern for the relationship
      expect(whereString).toContain("knows");
      expect(whereString).toContain("friend1");
    });

    test("filters relationship with shorthand @id (implicit 'some')", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          knows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                "@id": { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          knows: {
            where: {
              "@id": "http://example.com/friend1",
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have pattern for the relationship
      expect(whereString).toContain("knows");
      expect(whereString).toContain("friend1");
    });

    test("filters relationship with 'every' and multiple @id references", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          knows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                "@id": { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          knows: {
            where: {
              every: [
                { "@id": "http://example.com/friend1" },
                { "@id": "http://example.com/friend2" },
              ],
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have patterns for both friends
      expect(whereString).toContain("knows");
      expect(whereString).toContain("friend1");
      expect(whereString).toContain("friend2");
    });

    test("filters relationship with 'none' to exclude specific entities", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          knows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                "@id": { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          knows: {
            where: {
              none: {
                "@id": "http://example.com/blocked",
              },
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have pattern excluding the blocked entity
      expect(whereString).toContain("knows");
      // None operator should use FILTER NOT EXISTS or similar
      expect(whereString.toLowerCase()).toMatch(/(filter|not|exists)/);
    });
  });

  describe("Nested property filters on relationships", () => {
    test("filters relationship entities by nested property values", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "number" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          friends: {
            where: {
              some: {
                age: { gt: 21 },
              },
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have pattern for friends relationship
      expect(whereString).toContain("friends");
      // Should have age filter
      expect(whereString.toLowerCase()).toMatch(/age/);
    });

    test("filters relationship with string operators on nested properties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          friends: {
            where: {
              some: {
                email: { contains: "@example.com" },
              },
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have pattern for friends relationship
      expect(whereString).toContain("friends");
      // Should have email filter
      expect(whereString.toLowerCase()).toMatch(/email/);
    });

    test("filters relationship with multiple nested property conditions", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "number" },
                city: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          friends: {
            where: {
              some: {
                AND: [
                  { age: { gte: 18 } },
                  { age: { lte: 30 } },
                  { city: { equals: "Berlin" } },
                ],
              },
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have pattern for friends relationship
      expect(whereString).toContain("friends");
      // Should have filters for age and city
      expect(whereString.toLowerCase()).toMatch(/age/);
      expect(whereString.toLowerCase()).toMatch(/city/);
    });
  });

  describe("Complex multi-level relationship filtering", () => {
    test("filters nested relationships (friends of friends)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                friends: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          friends: {
            where: {
              some: {
                friends: {
                  some: {
                    name: { contains: "John" },
                  },
                },
              },
            },
            include: {
              friends: true,
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      expect(result.constructPatterns).toBeDefined();
      expect(result.wherePatterns).toBeDefined();

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have pattern for friends relationship
      expect(whereString).toContain("friends");
    });

    test("combines relationship filters with top-level filters", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "number" },
              },
            },
          },
        },
      };

      const filterOptions = {
        where: {
          age: { gte: 18 }, // Top-level filter on the main entity
        },
        include: {
          friends: {
            where: {
              some: {
                age: { gte: 21 }, // Nested filter on friends
              },
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have patterns for both filters
      expect(whereString).toContain("age");
      expect(whereString).toContain("friends");
    });
  });

  describe("Relationship filtering with pagination", () => {
    test("applies both filtering and pagination to relationships", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "number" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          friends: {
            where: {
              some: {
                age: { gte: 21 },
              },
            },
            take: 10,
            orderBy: { name: "asc" as const },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const query = buildSPARQLConstructQuery(result, {
        "": "http://example.com/",
      });

      // Should have SUBSELECT with LIMIT for pagination (use full query; wherePatterns
      // templates may not stringify via .toString() when emitted as required spine)
      expect(query).toContain("SELECT");
      expect(query).toContain("LIMIT 10");
      expect(query).toContain("ORDER BY");

      // Should reference age (filter and/or :age property patterns)
      expect(query.toLowerCase()).toMatch(/age/);

      // Pagination metadata should be collected
      expect(result.paginationMetadata.has("friends")).toBe(true);
    });
  });

  describe("Edge cases and validation", () => {
    test("handles empty where clause on relationship", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          friends: {
            where: {},
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      // Should not throw error
      expect(result.constructPatterns).toBeDefined();
      expect(result.wherePatterns).toBeDefined();
    });

    test("handles relationship filter without include", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          friends: {
            where: {
              some: {
                "@id": "http://example.com/friend1",
              },
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      // Should build query successfully
      expect(result.constructPatterns).toBeDefined();
      expect(result.wherePatterns).toBeDefined();
    });

    test("handles multiple relationship filters on different properties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
          colleagues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          friends: {
            where: {
              some: {
                name: { contains: "John" },
              },
            },
          },
          colleagues: {
            where: {
              some: {
                name: { contains: "Jane" },
              },
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should have patterns for both relationships
      expect(whereString).toContain("friends");
      expect(whereString).toContain("colleagues");
    });
  });

  describe("Relationship filtering with prefixed IRIs", () => {
    test("handles prefixed IRIs in relationship filters", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          "foaf:knows": {
            type: "array",
            items: {
              type: "object",
              properties: {
                "@id": { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
      };

      const filterOptions = {
        include: {
          "foaf:knows": {
            where: {
              some: {
                "@id": "ex:friend1",
              },
            },
          },
        },
      };

      const normalized = normalizeSchema(schema, filterOptions);
      const result = normalizedSchema2construct(
        "http://example.com/person1",
        undefined,
        normalized,
        {
          prefixMap: {
            foaf: "http://xmlns.com/foaf/0.1/",
            ex: "http://example.com/",
          },
          filterOptions,
        },
      );

      const whereString = result.wherePatterns
        .map((p) => p.toString())
        .join("\n");

      // Should handle prefixed names correctly
      expect(whereString).toContain("foaf:knows");
      expect(whereString).toContain("ex:friend1");
    });
  });
});

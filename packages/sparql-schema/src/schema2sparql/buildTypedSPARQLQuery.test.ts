/**
 * Comprehensive tests for type-safe SPARQL query building
 *
 * Tests demonstrate:
 * - Zod schema integration
 * - Complex nested WHERE filters
 * - Include patterns with pagination
 * - Filter validation
 * - Real-world use cases
 */

import { describe, it, expect } from "@jest/globals";
import { z } from "zod";
import { buildTypedSPARQLQuery } from "./buildTypedSPARQLQuery";
import type { JSONSchema7 } from "json-schema";

// ============================================================================
// Test Schemas with Zod
// ============================================================================

const PersonSchema = z.object({
  name: z.string(),
  email: z.string(),
  age: z.number(),
  verified: z.boolean(),
  salary: z.number().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    country: z.string(),
    zipCode: z.string(),
  }),
  friends: z.array(
    z.object({
      name: z.string(),
      age: z.number(),
      email: z.string(),
      superPowers: z.array(z.string()).optional(),
    }),
  ),
  tags: z.array(z.string()),
});

type Person = z.infer<typeof PersonSchema>;

// Convert Zod to JSON Schema (simplified for tests)
const personJSONSchema: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    age: { type: "number" },
    verified: { type: "boolean" },
    salary: { type: "number" },
    address: {
      type: "object",
      properties: {
        street: { type: "string" },
        city: { type: "string" },
        country: { type: "string" },
        zipCode: { type: "string" },
      },
    },
    friends: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          email: { type: "string" },
          superPowers: { type: "array", items: { type: "string" } },
        },
      },
    },
    tags: {
      type: "array",
      items: { type: "string" },
    },
  },
};

/** Person with recursively nested `friends` (for deep include / where tests). */
const recursiveFriendPersonJSONSchema: JSONSchema7 = {
  type: "object",
  $defs: {
    PersonNode: {
      type: "object",
      properties: {
        name: { type: "string" },
        friends: {
          type: "array",
          items: { $ref: "#/$defs/PersonNode" },
        },
      },
    },
  },
  properties: {
    name: { type: "string" },
    friends: {
      type: "array",
      items: { $ref: "#/$defs/PersonNode" },
    },
  },
};

const BlogPostSchema = z.object({
  title: z.string(),
  content: z.string(),
  published: z.boolean(),
  publishedAt: z.date(),
  viewCount: z.number(),
  author: z.object({
    name: z.string(),
    email: z.string(),
  }),
  comments: z.array(
    z.object({
      text: z.string(),
      createdAt: z.date(),
      author: z.object({
        name: z.string(),
      }),
    }),
  ),
  tags: z.array(z.string()),
});

type BlogPost = z.infer<typeof BlogPostSchema>;

const blogPostJSONSchema: JSONSchema7 = {
  type: "object",
  properties: {
    title: { type: "string" },
    content: { type: "string" },
    published: { type: "boolean" },
    publishedAt: { type: "string", format: "date-time" },
    viewCount: { type: "number" },
    author: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
      },
    },
    comments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          author: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      },
    },
    tags: {
      type: "array",
      items: { type: "string" },
    },
  },
};

describe("buildTypedSPARQLQuery - Basic Functionality", () => {
  it("should generate basic CONSTRUCT query without filters", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined, // typeIRIs
      personJSONSchema,
      {
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain("WHERE");
    expect(result.query).toContain("PREFIX");
    expect(result.normalizedSchema).toBeDefined();
  });

  it("should generate query with select pattern", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        select: { name: true, age: true, email: true },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain("CONSTRUCT");
    // Selected properties should be in the query
    expect(result.query).toMatch(/:name/);
    expect(result.query).toMatch(/:age/);
  });

  it("should generate query with omit pattern", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        omit: ["email", "salary"],
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain("CONSTRUCT");
    // Omitted properties should not be in normalized schema
    expect(result.normalizedSchema.properties.email).toBeUndefined();
    expect(result.normalizedSchema.properties.salary).toBeUndefined();
  });
});

describe("buildTypedSPARQLQuery - WHERE Filters", () => {
  it("should generate query with simple WHERE filters", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined, // typeIRIs
      personJSONSchema,
      {
        where: {
          age: { gte: 18 },
          verified: { equals: true },
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toBeDefined();
    // Validation should pass
  });

  it("should generate query with complex WHERE filters", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined, // typeIRIs
      personJSONSchema,
      {
        where: {
          AND: [
            { age: { gte: 18, lte: 65 } },
            {
              OR: [
                { email: { endsWith: "@company.com" } },
                { verified: { equals: true } },
              ],
            },
          ],
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toBeDefined();
  });

  it("should generate query with string filters", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined, // typeIRIs
      personJSONSchema,
      {
        where: {
          name: { contains: "John", mode: "insensitive" },
          email: { endsWith: "@example.com" },
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
  });

  it("should generate query with numeric range filters", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        where: {
          age: { gte: 25, lt: 50 },
          salary: { gt: 50000 },
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
  });

  it("should generate query with 'in' operator", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined, // typeIRIs
      personJSONSchema,
      {
        where: {
          name: { in: ["Alice", "Bob", "Charlie"] },
          age: { in: [25, 30, 35] },
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
  });
});

describe("buildTypedSPARQLQuery - Include Patterns", () => {
  it("should generate query with simple include", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        include: {
          address: true,
          friends: true,
        },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain(":address");
    expect(result.query).toContain(":friends");
  });

  it("should generate query with paginated include", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        include: {
          friends: {
            take: 10,
            skip: 0,
            orderBy: { name: "asc" },
          },
        },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain(":friends");
    // Should contain SUBSELECT for pagination
    expect(result.query.toLowerCase()).toContain("select");
    expect(result.query).toContain("LIMIT 10");
  });

  it("should generate query with nested include", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        include: {
          address: {
            include: {
              city: true,
              country: true,
            },
          },
        },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain(":address");
    expect(result.query).toContain(":city");
    expect(result.query).toContain(":country");
  });
});

describe("buildTypedSPARQLQuery - Complex Scenarios", () => {
  it("should generate query with WHERE + include + select", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        select: { name: true, age: true, friends: true },
        include: {
          friends: {
            take: 5,
            orderBy: { age: "desc" },
          },
        },
        where: {
          age: { gte: 18 },
          verified: true,
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain(":name");
    expect(result.query).toContain(":friends");
    // Note: Pagination is stored in metadata, not always visible in query string
    // depending on how the CONSTRUCT is built
  });

  it("should generate blog post query with complex filters", () => {
    const result = buildTypedSPARQLQuery<BlogPost>(
      "http://example.com/blog/post/1",
      undefined,
      blogPostJSONSchema,
      {
        select: {
          title: true,
          content: true,
          author: true,
          comments: true,
        },
        where: {
          published: { equals: true },
          viewCount: { gte: 100 },
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain(":title");
    // Note: Nested includes within select currently require explicit configuration
  });

  it("should handle multiple filters with different types", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        where: {
          name: { contains: "Smith" },
          age: { gte: 25, lte: 65 },
          verified: true,
          email: { endsWith: "@example.com" },
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
  });
});

describe("buildTypedSPARQLQuery - Filter Validation", () => {
  it("should throw on invalid filter when validation mode is throw", () => {
    expect(() => {
      buildTypedSPARQLQuery<Person>(
        "http://example.com/person/1",
        undefined,
        personJSONSchema,
        {
          where: {
            email: { gt: 20 } as any, // Invalid: gt on string
          },
          filterValidationMode: "throw",
          prefixMap: { "": "http://example.com/" },
        },
      );
    }).toThrow("Filter validation failed");
  });

  it("should not throw on invalid filter when validation mode is warn", () => {
    expect(() => {
      buildTypedSPARQLQuery<Person>(
        "http://example.com/person/1",
        undefined,
        personJSONSchema,
        {
          where: {
            email: { gt: 20 } as any, // Invalid but should only warn
          },
          filterValidationMode: "warn",
          prefixMap: { "": "http://example.com/" },
        },
      );
    }).not.toThrow();
  });

  it("should skip validation when mode is ignore", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        where: {
          email: { gt: 20 } as any, // Invalid but ignored
        },
        filterValidationMode: "ignore",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
  });

  it("should skip validation by default (no mode specified)", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        where: {
          email: { gt: 20 } as any,
        },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
  });

  it("should detect invalid operator in nested conditions", () => {
    expect(() => {
      buildTypedSPARQLQuery<Person>(
        "http://example.com/person/1",
        undefined,
        personJSONSchema,
        {
          where: {
            AND: [
              { age: { gte: 18 } },
              { name: { gt: 100 } as any }, // Invalid
            ],
          },
          filterValidationMode: "throw",
        },
      );
    }).toThrow();
  });
});

describe("buildTypedSPARQLQuery - Real-World Use Cases", () => {
  it("should build user search query", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        select: { name: true, email: true, age: true },
        where: {
          age: { gte: 18 },
          verified: true,
          email: { contains: "@" },
        },
        filterValidationMode: "warn",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain(":name");
    expect(result.query).toContain(":email");
  });

  it("should build friend recommendation query", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        include: {
          friends: {
            take: 10,
            orderBy: { name: "asc" },
            include: {
              name: true,
              age: true,
            },
          },
        },
        where: {
          age: { gte: 25, lte: 45 },
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain(":friends");
    expect(result.query).toContain("LIMIT 10");
  });

  it("should build blog feed query", () => {
    const result = buildTypedSPARQLQuery<BlogPost>(
      "http://example.com/blog/post/1",
      undefined,
      blogPostJSONSchema,
      {
        select: {
          title: true,
          publishedAt: true,
          viewCount: true,
          author: true,
          comments: true, // Include comments in select
        },
        include: {
          comments: {
            take: 3,
            orderBy: { createdAt: "desc" },
          },
        },
        where: {
          published: true,
          viewCount: { gte: 50 },
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain(":title");
    // Comments should be in query when included in select
    expect(result.query).toContain(":comments");
  });

  it("should build filtered address lookup", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        select: { name: true, address: true },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain(":address");
    expect(result.query).toContain(":name");
    // Note: Nested object properties are included by default in the current implementation
    // The normalizer expands nested objects during schema traversal
  });

  it("should build query with nested include and top-level where", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        select: { name: true, email: true, age: true, friends: true },
        include: {
          friends: {
            take: 10,
            orderBy: { name: "asc" },
            include: {
              name: true,
              age: true,
              email: true,
              superPowers: {
                take: 5,
              },
            },
          },
        },
        where: {
          age: { gte: 18, lte: 65 },
        },
        filterValidationMode: "throw",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain(":friends");
    expect(result.query).toContain(":name");
    expect(result.query).toContain(":age");
    expect(result.query).toContain(":email");
    // Demonstrates combining WHERE filters on the main entity
    // with deeply nested include patterns (friends.include with multiple fields
    // including nested arrays like superPowers)
  });

  it("should build query with deeply nested where and include patterns", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      "http://example.com/Person",
      personJSONSchema,
      {
        select: { name: true, email: true, friends: true },
        include: {
          friends: {
            take: 5,
            orderBy: { age: "desc" },
            include: {
              name: true,
              age: true,
              email: true,
            },
            where: {
              age: { gte: 21, lte: 40 },
              email: { contains: "@example.com" },
            },
          },
        },
        where: {
          age: { gte: 18 },
          name: { contains: "Smith" },
        },
        filterValidationMode: "warn",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain(":friends");
    expect(result.query).toContain(":name");
    expect(result.query).toContain(":email");
    // Demonstrates true nested filtering: top-level WHERE filters the Person,
    // while friends.where filters which friends are included (age 21-40, email contains @example.com)
  });

  it("should recurse four levels of friends and filter the innermost by name (required spine)", () => {
    const result = buildTypedSPARQLQuery<any>(
      "http://example.com/person/1",
      undefined,
      recursiveFriendPersonJSONSchema,
      {
        maxRecursion: 8,
        select: { name: true, friends: true },
        include: {
          friends: {
            include: {
              friends: {
                include: {
                  friends: {
                    include: {
                      friends: {
                        where: {
                          name: { contains: "Ghandi" },
                        },
                        include: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        filterValidationMode: "warn",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain("Ghandi");
    expect(result.query).toMatch(/:friends/);
    expect(result.query).toMatch(/:name/);
    expect(result.query).toMatch(/FILTER|CONTAINS|REGEX/);

    // Include where: path to the filter must be a required spine (not wrapped in OPTIONAL),
    // otherwise filters would not constrain the solution set.
    expect(result.query).not.toContain("OPTIONAL { ?subject :friends");
    expect(result.query).not.toContain("OPTIONAL { ?friends_1 :friends");
    expect(result.query).not.toContain("OPTIONAL { ?friends_4 :friends");
    expect(result.query).not.toContain("OPTIONAL { ?friends_7 :friends");
    expect(result.query).toMatch(
      /\?friends_7 :friends \?friends_\d+ \.\s*\n\?friends_\d+ :name \?name_\d+ \.\s*\nFILTER/,
    );
  });

  it("should promote include spine when filtering nested include without a bound subject IRI", () => {
    const result = buildTypedSPARQLQuery<Person>(
      undefined,
      undefined,
      personJSONSchema,
      {
        select: { friends: true },
        include: {
          friends: {
            where: {
              name: { contains: "NestedFilter" },
            },
            include: { name: true },
          },
        },
        filterValidationMode: "warn",
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain("NestedFilter");
    expect(result.query).not.toContain("OPTIONAL { ?subject :friends");
  });
});

describe("buildTypedSPARQLQuery - Edge Cases", () => {
  it("should handle empty where clause", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        where: {},
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
  });

  it("should handle query with only pagination", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        include: {
          friends: {
            take: 100,
            skip: 50,
          },
        },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain("LIMIT 100");
    expect(result.query).toContain("OFFSET 50");
  });

  it("should handle deeply nested includes", () => {
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        include: {
          address: {
            include: {
              city: true,
              country: true,
            },
          },
        },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain(":address");
  });
});

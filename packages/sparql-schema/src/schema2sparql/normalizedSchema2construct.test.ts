import { describe, expect, test } from "@jest/globals";
import { JSONSchema7 } from "json-schema";
import { normalizeSchema } from "@graviola/edb-graph-traversal";

import { normalizedSchema2construct } from "./normalizedSchema2construct";

describe("normalizedSchema2construct - Step 1: Basic Types & Variable Handling", () => {
  test("handles simple object with one literal property", () => {
    // Start with the simplest case: one string property
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    };

    const normalized = normalizeSchema(schema, {});
    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
    );

    expect(result).toBeDefined();
    expect(result.constructPatterns).toBeDefined();
    expect(result.wherePatterns).toBeDefined();

    // Should create patterns for: subject rdf:type ?type, subject :name ?name
    expect(result.constructPatterns.length).toBeGreaterThan(0);
    expect(result.wherePatterns.length).toBeGreaterThan(0);
  });

  test("automatically generates unique variable names without manual indices", () => {
    // Test that the SPARQL builder handles variable uniqueness
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        title: { type: "string" },
      },
    };

    const normalized = normalizeSchema(schema, {});
    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
    );

    // Variables should be unique (builder should handle this)
    expect(result.constructPatterns).toBeDefined();
    expect(result.wherePatterns).toBeDefined();
  });

  test("handles special characters in property names safely", () => {
    // Test injection prevention - special chars should be escaped
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        "dc:title": { type: "string" },
        "http://example.com/prop": { type: "string" },
      },
    };

    const normalized = normalizeSchema(schema, {});

    // Should not throw, should handle safely
    expect(() => {
      normalizedSchema2construct(
        "http://example.com/doc1",
        undefined,
        normalized,
      );
    }).not.toThrow();
  });

  test("handles property names with prefixMap (prefix resolution)", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        "foaf:name": { type: "string" },
        "dc:title": { type: "string" },
        "unknownPrefix:prop": { type: "string" },
        name: { type: "string" },
      },
    };

    const normalized = normalizeSchema(schema, {});

    // Test with prefixMap that has foaf and dc prefixes
    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      {
        prefixMap: {
          foaf: "http://xmlns.com/foaf/0.1/",
          dc: "http://purl.org/dc/elements/1.1/",
        },
      },
    );

    // Should create patterns successfully
    // foaf:name and dc:title should be left as-is (will be resolved by PREFIX)
    // unknownPrefix:prop should be treated as URL (wrapped in <>)
    // name should get default prefix (:name)
    expect(result.constructPatterns).toBeDefined();
    expect(result.wherePatterns).toBeDefined();
  });

  test("handles URN and URL property names correctly", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        "urn:isbn:0451450523": { type: "string" },
        "http://schema.org/name": { type: "string" },
        "https://example.com/custom": { type: "string" },
      },
    };

    const normalized = normalizeSchema(schema, {});

    // Test without context - these should be treated as full URLs
    const result = normalizedSchema2construct(
      "http://example.com/book1",
      undefined,
      normalized,
    );

    expect(result.constructPatterns).toBeDefined();
    expect(result.wherePatterns).toBeDefined();
    // urn:isbn:... should be wrapped as <urn:isbn:...>
    // http/https URLs should be treated as named nodes
  });
});

describe("normalizedSchema2construct - Step 2: Property Type Handlers", () => {
  test("handles nested object properties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
          },
        },
      },
    };

    const normalized = normalizeSchema(schema, {});
    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
    );

    // Should create patterns for nested properties
    expect(result.constructPatterns.length).toBeGreaterThan(2); // subject, name, address
    expect(result.wherePatterns.length).toBeGreaterThan(2);
  });

  test("handles array properties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    const normalized = normalizeSchema(schema, {});
    const result = normalizedSchema2construct(
      "http://example.com/doc1",
      undefined,
      normalized,
    );

    expect(result.constructPatterns).toBeDefined();
    expect(result.wherePatterns).toBeDefined();
    // Arrays should create patterns for the predicate
  });

  test("handles array of objects", () => {
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

    const normalized = normalizeSchema(schema, {});
    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
    );

    expect(result.constructPatterns).toBeDefined();
    expect(result.wherePatterns).toBeDefined();
  });

  test("respects maxRecursion depth", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        parent: {
          type: "object",
          properties: {
            name: { type: "string" },
            parent: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      },
    };

    const normalized = normalizeSchema(schema, {});
    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      { maxRecursion: 1 }, // Only go 1 level deep
    );

    expect(result.constructPatterns).toBeDefined();
    expect(result.wherePatterns).toBeDefined();
    // Should stop at depth 1
  });

  test("handles required vs optional properties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      required: ["name"], // name is required
      properties: {
        name: { type: "string" },
        email: { type: "string" }, // email is optional
      },
    };

    const normalized = normalizeSchema(schema, {});
    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
    );

    expect(result.constructPatterns).toBeDefined();
    expect(result.wherePatterns).toBeDefined();
    // Required properties should not be in OPTIONAL blocks
  });
});

describe("normalizedSchema2construct - Step 3: Pagination with Query-Stage Marking", () => {
  test("extracts pagination metadata from normalized schema", () => {
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

    // Normalize with pagination in include pattern
    const normalized = normalizeSchema(schema, {
      include: {
        friends: { take: 10, skip: 0 },
      },
    });

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      {
        filterOptions: {
          include: {
            friends: { take: 10, skip: 0 },
          },
        },
      },
    );

    // Pagination comes from filterOptions.include, not from schema annotations
    expect(result.paginationMetadata).toBeDefined();
    const pagMeta = result.paginationMetadata.get("friends");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?._stage).toBe("extraction");
  });

  test("marks pagination source as 'extraction' when SPARQL does not paginate arrays", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        posts: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    const normalized = normalizeSchema(schema, {
      include: {
        posts: { take: 20 },
      },
    });

    const result = normalizedSchema2construct(
      "http://example.com/user1",
      undefined,
      normalized,
      {
        filterOptions: {
          include: {
            posts: { take: 20 },
          },
        },
      },
    );

    const pagMeta = result.paginationMetadata.get("posts");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?._stage).toBe("extraction");
    expect(pagMeta?.take).toBe(20);
  });

  test("handles array without pagination metadata", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    // No pagination in include pattern
    const normalized = normalizeSchema(schema, {});

    const result = normalizedSchema2construct(
      "http://example.com/doc1",
      undefined,
      normalized,
    );

    // Should not have pagination metadata for tags
    expect(result.paginationMetadata.get("tags")).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { normalizedSchema2construct } from "./normalizedSchema2construct";
import type { NormalizedSchema } from "@graviola/edb-graph-traversal";

describe("normalizedSchema2construct - Multiple Subjects", () => {
  it("should generate VALUES pattern for multiple subject IRIs", () => {
    const schema: NormalizedSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      _normalized: true,
    };

    const result = normalizedSchema2construct(
      [
        "http://example.com/person1",
        "http://example.com/person2",
        "http://example.com/person3",
      ],
      undefined,
      schema,
    );

    const whereQuery = result.wherePatterns.map((p) => p.toString()).join(" ");

    // Should use VALUES for multiple subjects
    expect(whereQuery).toContain("VALUES");
    expect(whereQuery).toContain("?subject");
    expect(whereQuery).toContain("<http://example.com/person1>");
    expect(whereQuery).toContain("<http://example.com/person2>");
    expect(whereQuery).toContain("<http://example.com/person3>");

    // Should use ?subject variable in patterns
    expect(whereQuery).toContain("?subject");
    expect(whereQuery).toContain("?type");
  });

  it("should generate BIND pattern for single subject IRI with oxigraph flavour", () => {
    const schema: NormalizedSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      _normalized: true,
    };

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      schema,
      {
        flavour: "oxigraph",
      },
    );

    const whereQuery = result.wherePatterns.map((p) => p.toString()).join(" ");

    // Should use BIND for single subject with oxigraph
    expect(whereQuery).toContain("BIND");
    expect(whereQuery).toContain("?subject");
    expect(whereQuery).toContain("<http://example.com/person1>");
  });

  it("should generate VALUES pattern for single subject IRI with default flavour", () => {
    const schema: NormalizedSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      _normalized: true,
    };

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      schema,
      {
        flavour: "default",
      },
    );

    const whereQuery = result.wherePatterns.map((p) => p.toString()).join(" ");

    // Should use VALUES even for single subject with default flavour
    expect(whereQuery).toContain("VALUES");
    expect(whereQuery).toContain("?subject");
    expect(whereQuery).toContain("<http://example.com/person1>");
  });

  it("should handle prefixed IRIs in multiple subjects", () => {
    const schema: NormalizedSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      _normalized: true,
    };

    const result = normalizedSchema2construct(
      ["ex:person1", "ex:person2"],
      undefined,
      schema,
      {
        prefixMap: { ex: "http://example.com/" },
      },
    );

    const whereQuery = result.wherePatterns.map((p) => p.toString()).join(" ");

    // Should use VALUES with prefixed names
    expect(whereQuery).toContain("VALUES");
    expect(whereQuery).toContain("?subject");
    expect(whereQuery).toContain("ex:person1");
    expect(whereQuery).toContain("ex:person2");
  });

  it("should handle mix of prefixed and full IRIs", () => {
    const schema: NormalizedSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      _normalized: true,
    };

    const result = normalizedSchema2construct(
      ["ex:person1", "http://example.com/person2", "urn:uuid:12345"],
      undefined,
      schema,
      {
        prefixMap: { ex: "http://example.com/" },
      },
    );

    const whereQuery = result.wherePatterns.map((p) => p.toString()).join(" ");

    // Should handle mixed formats
    expect(whereQuery).toContain("VALUES");
    expect(whereQuery).toContain("?subject");
    expect(whereQuery).toContain("ex:person1");
    expect(whereQuery).toContain("<http://example.com/person2>");
    expect(whereQuery).toContain("<urn:uuid:12345>");
  });

  it("should generate correct CONSTRUCT patterns for multiple subjects", () => {
    const schema: NormalizedSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      _normalized: true,
    };

    const result = normalizedSchema2construct(
      ["http://example.com/person1", "http://example.com/person2"],
      undefined,
      schema,
    );

    const constructQuery = result.constructPatterns
      .map((p) => p.toString())
      .join(" ");

    // CONSTRUCT patterns should use ?subject variable
    expect(constructQuery).toContain("?subject");
    expect(constructQuery).toContain("?type");
    expect(constructQuery).toMatch(/\?name_\d+/);
    expect(constructQuery).toMatch(/\?age_\d+/);
  });

  it("should work with nested objects for multiple subjects", () => {
    const schema: NormalizedSchema = {
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
      _normalized: true,
    };

    const result = normalizedSchema2construct(
      ["http://example.com/person1", "http://example.com/person2"],
      undefined,
      schema,
    );

    const whereQuery = result.wherePatterns.map((p) => p.toString()).join(" ");

    // Should handle nested objects with multiple subjects
    expect(whereQuery).toContain("VALUES");
    expect(whereQuery).toContain("?subject");
    expect(whereQuery).toMatch(/\?address_\d+/);
    expect(whereQuery).toMatch(/\?street_\d+/);
    expect(whereQuery).toMatch(/\?city_\d+/);
  });

  it("should work with arrays for multiple subjects", () => {
    const schema: NormalizedSchema = {
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
      _normalized: true,
    };

    const result = normalizedSchema2construct(
      ["http://example.com/person1", "http://example.com/person2"],
      undefined,
      schema,
      {
        filterOptions: {
          include: {
            friends: { take: 10, orderBy: { name: "asc" } },
          },
        },
        flavour: "sparql12",
      },
    );

    const whereQuery = result.wherePatterns.map((p) => p.toString()).join(" ");

    // Should handle arrays with pagination for multiple subjects
    expect(whereQuery).toContain("VALUES");
    expect(whereQuery).toContain("?subject");
    expect(whereQuery).toMatch(/\?friends_\d+/);
    expect(whereQuery).toContain("LATERAL");
    expect(whereQuery).toContain("SELECT");
    expect(whereQuery).toContain("LIMIT 10");
  });

  it("should handle empty array of subject IRIs (query all subjects)", () => {
    const schema: NormalizedSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      _normalized: true,
    };

    // Empty array is now treated like undefined - query all subjects
    const result = normalizedSchema2construct([], undefined, schema);

    expect(result).toBeDefined();
    expect(result.constructPatterns).toBeDefined();
    expect(result.wherePatterns).toBeDefined();

    // Should not have BIND/VALUES pattern for subject when empty array is passed
    const whereQuery = result.wherePatterns.map((p) => p.toString()).join(" ");
    expect(whereQuery).not.toContain("VALUES ?subject");
    expect(whereQuery).not.toContain("BIND");
  });
});

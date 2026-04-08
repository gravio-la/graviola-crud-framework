import { describe, it, expect } from "bun:test";
import { normalizeSchema } from "@graviola/edb-graph-traversal";
import { normalizedSchema2construct } from "./normalizedSchema2construct";
import { buildSPARQLConstructQuery } from "./buildSPARQLConstructQuery";
import type { JSONSchema7 } from "json-schema";

describe("buildCompleteSPARQLQuery", () => {
  it("should add dots after triples in CONSTRUCT clause", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };

    const normalized = normalizeSchema(schema);
    const result = normalizedSchema2construct(
      "http://example.com/person/1",
      undefined,
      normalized,
    );
    const query = buildSPARQLConstructQuery(result, {
      "": "http://example.com/",
    });

    // Check that CONSTRUCT patterns have dots (variables include depth suffix)
    expect(query).toContain("CONSTRUCT");
    expect(query).toMatch(/:name \?name_\d+ \./);
    expect(query).toMatch(/:age \?age_\d+ \./);
  });

  it("should add dots after patterns in WHERE clause", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
      },
    };

    const normalized = normalizeSchema(schema);
    const result = normalizedSchema2construct(
      "http://example.com/person/1",
      undefined,
      normalized,
    );
    const query = buildSPARQLConstructQuery(result, {
      "": "http://example.com/",
    });

    // Check that WHERE patterns have dots inside OPTIONAL blocks (correct SPARQL syntax)
    expect(query).toContain("WHERE");
    // Subject is now a variable with VALUES clause binding it to the IRI
    expect(query).toContain("VALUES ?subject");
    expect(query).toContain("<http://example.com/person/1>");
    expect(query).toMatch(/OPTIONAL \{ \?subject :name \?name_\d+ \. \}/);
  });

  it("should handle pagination with SUBSELECT correctly", () => {
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
          "x-pagination": {
            take: 10,
            orderBy: { name: "asc" },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        friends: {
          take: 10,
          orderBy: { name: "asc" },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/person/1",
      undefined,
      normalized,
      {
        filterOptions,
      },
    );
    const query = buildSPARQLConstructQuery(result, {
      "": "http://example.com/",
    });

    // Check for SUBSELECT with pagination
    expect(query).toContain("SELECT");
    expect(query).toContain("ORDER BY");
    expect(query).toContain("LIMIT 10");

    // SUBSELECT should have dots inside its WHERE clause
    // Subject is now a variable with VALUES clause binding it to the IRI
    expect(query).toContain("VALUES ?subject");
    expect(query).toContain("<http://example.com/person/1>");
    expect(query).toMatch(/\?subject :friends \?friends_\d+ \./);
    expect(query).toMatch(/OPTIONAL \{ \?friends_\d+ :name \?name_\d+ \. \}/);
  });
});

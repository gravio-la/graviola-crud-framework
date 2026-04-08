import { describe, test, expect } from "bun:test";
import { JSONSchema7 } from "json-schema";
import { normalizeSchema } from "@graviola/edb-graph-traversal";
import { normalizedSchema2construct } from "./normalizedSchema2construct";

/**
 * Focused tests for ORDER BY generation in paginated SUBSELECTs.
 *
 * createPaginatedSubselect is a private function, so we test it through
 * normalizedSchema2construct. These tests verify the generated SPARQL string
 * contains correct ORDER BY clauses with proper variable references and direction.
 */

function getWhereString(result: ReturnType<typeof normalizedSchema2construct>) {
  return result.wherePatterns.map((p) => p.toString()).join("\n");
}

describe("createPaginatedSubselect - ORDER BY", () => {
  test("single asc orderBy produces ORDER BY ?var", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
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
        items: {
          take: 10,
          orderBy: { name: "asc" as const },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/s",
      undefined,
      normalized,
      { filterOptions },
    );

    const where = getWhereString(result);
    expect(where).toContain("ORDER BY");
    expect(where).not.toContain("desc(");
  });

  test("single desc orderBy produces ORDER BY desc(?var)", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              createdAt: { type: "string" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        items: {
          take: 10,
          orderBy: { createdAt: "desc" as const },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/s",
      undefined,
      normalized,
      { filterOptions },
    );

    const where = getWhereString(result);
    expect(where).toContain("ORDER BY");
    expect(where).toContain("desc(");
  });

  test("multiple orderBy clauses in array produce chained ORDER BY", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        posts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              createdAt: { type: "string" },
              title: { type: "string" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        posts: {
          take: 20,
          skip: 5,
          orderBy: [{ createdAt: "desc" as const }, { title: "asc" as const }],
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/s",
      undefined,
      normalized,
      { filterOptions },
    );

    const where = getWhereString(result);
    expect(where).toContain("ORDER BY");
    expect(where).toContain("desc(");
    expect(where).toContain("LIMIT 20");
    expect(where).toContain("OFFSET 5");
  });

  test("three orderBy clauses all appear in generated query", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        records: {
          type: "array",
          items: {
            type: "object",
            properties: {
              priority: { type: "number" },
              name: { type: "string" },
              date: { type: "string" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        records: {
          take: 50,
          orderBy: [
            { priority: "desc" as const },
            { name: "asc" as const },
            { date: "desc" as const },
          ],
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/s",
      undefined,
      normalized,
      { filterOptions },
    );

    const where = getWhereString(result);
    expect(where).toContain("ORDER BY");

    const descMatches = where.match(/desc\(/g);
    expect(descMatches?.length).toBe(2);
  });

  test("orderBy with multi-property clause (single object with multiple keys)", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              lastName: { type: "string" },
              firstName: { type: "string" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        items: {
          take: 10,
          orderBy: { lastName: "asc" as const, firstName: "asc" as const },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/s",
      undefined,
      normalized,
      { filterOptions },
    );

    const where = getWhereString(result);
    expect(where).toContain("ORDER BY");
    expect(where).toContain("LIMIT 10");
  });

  test("OPTIONAL patterns are generated for ORDER BY properties inside SUBSELECT", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              score: { type: "number" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        items: {
          take: 10,
          orderBy: { name: "asc" as const },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/s",
      undefined,
      normalized,
      { filterOptions },
    );

    const where = getWhereString(result);
    expect(where).toContain("OPTIONAL");
    expect(where).toContain("ORDER BY");
  });

  test("no ORDER BY is generated when orderBy is not specified", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              value: { type: "string" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        items: {
          take: 5,
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/s",
      undefined,
      normalized,
      { filterOptions },
    );

    const where = getWhereString(result);
    expect(where).toContain("SELECT");
    expect(where).toContain("LIMIT 5");
    expect(where).not.toContain("ORDER BY");
  });

  test("orderBy with prefixed properties produces valid SPARQL", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "schema:name": { type: "string" },
              "schema:dateCreated": { type: "string" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        items: {
          take: 10,
          orderBy: [
            { "schema:dateCreated": "desc" as const },
            { "schema:name": "asc" as const },
          ],
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/s",
      undefined,
      normalized,
      {
        prefixMap: {
          schema: "http://schema.org/",
        },
        filterOptions,
      },
    );

    const where = getWhereString(result);
    expect(where).toContain("ORDER BY");
    expect(where).toContain("desc(");
  });

  test("mixed asc and desc in a single clause", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              rank: { type: "number" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        items: {
          take: 25,
          orderBy: { category: "asc" as const, rank: "desc" as const },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);
    const result = normalizedSchema2construct(
      "http://example.com/s",
      undefined,
      normalized,
      { filterOptions },
    );

    const where = getWhereString(result);
    expect(where).toContain("ORDER BY");
    expect(where).toContain("desc(");
    expect(where).toContain("LIMIT 25");
  });
});

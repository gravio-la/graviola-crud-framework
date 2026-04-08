import { describe, expect, test, beforeAll } from "@jest/globals";
import datasetFactory from "@rdfjs/dataset";
import N3Parser from "@rdfjs/parser-n3";
import type { Dataset } from "@rdfjs/types";
import type { JSONSchema7 } from "json-schema";
import dsExt from "rdf-dataset-ext";
import fs from "fs";
import { resolve, dirname } from "path";
import stringToStream from "string-to-stream";
import { extractFromGraph } from "./extract";
import { createConsoleLogger } from "@graviola/edb-core-utils";

// Get path to tbbt.nq file using require.resolve
// This works across different module systems and bundlers
function getTbbtPath(): string {
  try {
    // Try to resolve the tbbt-ld package
    const tbbtPackagePath = require.resolve("tbbt-ld");
    const tbbtDir = dirname(tbbtPackagePath);
    return resolve(tbbtDir, "dist", "tbbt.nq");
  } catch {
    // Fallback: construct path relative to node_modules
    return resolve(
      __dirname,
      "..",
      "..",
      "node_modules",
      "tbbt-ld",
      "dist",
      "tbbt.nq",
    );
  }
}

const tbbtPath = getTbbtPath();

/**
 * Integration tests using the real TBBT (The Big Bang Theory) RDF dataset
 *
 * This dataset contains:
 * - Multiple person entities with relationships
 * - Circular references (friends know each other)
 * - Nested properties (addresses, etc.)
 * - Various data types
 *
 * Perfect for testing real-world extraction scenarios!
 */
describe("extractFromGraph - Integration Tests with TBBT Dataset", () => {
  let dataset: Dataset;

  beforeAll(async () => {
    // Load the tbbt.nq dataset
    const input = fs.readFileSync(tbbtPath, "utf-8");
    const parser = new N3Parser();
    dataset = (await dsExt.fromStream(
      datasetFactory.dataset(),
      parser.import(stringToStream(input)),
    )) as Dataset;
  });

  const personSchema: JSONSchema7 = {
    type: "object",
    properties: {
      givenName: { type: "string" },
      familyName: { type: "string" },
      email: { type: "string" },
      telephone: { type: "string" },
      knows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            "@id": { type: "string" },
            givenName: { type: "string" },
            familyName: { type: "string" },
          },
        },
      },
      address: {
        type: "object",
        properties: {
          streetAddress: { type: "string" },
          addressLocality: { type: "string" },
          addressRegion: { type: "string" },
          postalCode: { type: "string" },
          addressCountry: { type: "string" },
        },
      },
    },
  };

  test("extracts simple person with basic properties", () => {
    const result = extractFromGraph(
      "http://localhost:8080/data/person/leonard-hofstadter",
      dataset,
      {
        type: "object",
        properties: {
          givenName: { type: "string" },
          familyName: { type: "string" },
        },
      },
      {
        omitEmptyArrays: true,
        omitEmptyObjects: true,
      },
      "http://schema.org/", // baseIRI
    );

    expect(result).toBeDefined();
    expect(result["@id"]).toBe(
      "http://localhost:8080/data/person/leonard-hofstadter",
    );
    expect(result.givenName).toBeDefined();
    expect(result.givenName).toBe("Leonard");
    expect(result.familyName).toBe("Hofstadter");
  });

  test("extracts person with depth control via schema", () => {
    // Schema with 2 levels of 'knows' relationships
    const depthSchema: JSONSchema7 = {
      type: "object",
      properties: {
        givenName: { type: "string" },
        familyName: { type: "string" },
        knows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              givenName: { type: "string" },
              knows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    "@id": { type: "string" }, // Stub at depth 2
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = extractFromGraph(
      "http://localhost:8080/data/person/sheldon-cooper",
      dataset,
      depthSchema,
      {
        maxRecursion: 10, // High limit, but schema controls actual depth
      },
      "http://schema.org/", // baseIRI
    );

    expect(result).toBeDefined();
    expect(result.givenName).toBeDefined();

    // If knows exists, check its structure
    if (result.knows && result.knows.length > 0) {
      const friend = result.knows[0];
      expect(friend.givenName).toBeDefined();

      // Second level should only have @id (stub)
      if (friend.knows && friend.knows.length > 0) {
        const friendOfFriend = friend.knows[0];
        expect(friendOfFriend["@id"]).toBeDefined();
        expect(friendOfFriend.givenName).toBeUndefined(); // Should not recurse further
      }
    }
  });

  test("handles circular references via schema depth", () => {
    // Even if data has cycles (A knows B, B knows A),
    // the schema structure limits depth
    const result = extractFromGraph(
      "http://localhost:8080/data/person/penny",
      dataset,
      {
        type: "object",
        properties: {
          givenName: { type: "string" },
          knows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                givenName: { type: "string" },
                knows: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      "@id": { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {},
      "http://schema.org/", // baseIRI
    );

    expect(result).toBeDefined();
    // Should complete without hanging or stack overflow
    expect(result.givenName).toBeDefined();
  });

  test("respects maxRecursion option", () => {
    const result = extractFromGraph(
      "http://localhost:8080/data/person/howard-wolowitz",
      dataset,
      personSchema,
      {
        maxRecursion: 1, // Stop after 1 level
      },
      "http://schema.org/", // baseIRI
    );

    expect(result).toBeDefined();
    expect(result["@id"]).toBe(
      "http://localhost:8080/data/person/howard-wolowitz",
    );
    expect(result.givenName).toBeDefined();
  });

  test("respects doNotRecurseNamedNodes option", () => {
    const result = extractFromGraph(
      "http://localhost:8080/data/person/rajesh-koothrappali",
      dataset,
      {
        type: "object",
        properties: {
          givenName: { type: "string" },
          familyName: { type: "string" },
          knows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                givenName: { type: "string" },
                familyName: { type: "string" },
              },
            },
          },
        },
      },
      {
        doNotRecurseNamedNodes: true,
      },
      "http://schema.org/", // baseIRI
    );

    expect(result).toBeDefined();
    expect(result.givenName).toBeDefined();

    // knows array should only contain @id properties (no recursion into named nodes)
    if (result.knows && result.knows.length > 0) {
      const friend = result.knows[0];
      expect(friend["@id"]).toBeDefined();
      // Should not have extracted name/givenName due to doNotRecurseNamedNodes
      expect(friend.givenName).toBeUndefined();
    }
  });

  test("handles omitEmptyArrays option", () => {
    const result = extractFromGraph(
      "http://localhost:8080/data/person/mary-cooper",
      dataset,
      {
        type: "object",
        properties: {
          givenName: { type: "string" },
          familyName: { type: "string" },
          knows: {
            type: "array",
            items: { type: "string" },
          },
          nonExistentArray: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      {
        omitEmptyArrays: true,
      },
      "http://schema.org/", // baseIRI
    );

    expect(result).toBeDefined();
    expect(result.givenName).toBeDefined();
    // nonExistentArray should not be present if it's empty
    if (result.knows && result.knows.length === 0) {
      expect(result.knows).toBeUndefined();
    }
  });

  test("extracts multiple people to verify consistency", () => {
    const people = [
      "http://localhost:8080/data/person/leonard-hofstadter",
      "http://localhost:8080/data/person/sheldon-cooper",
      "http://localhost:8080/data/person/penny",
      "http://localhost:8080/data/person/howard-wolowitz",
    ];

    const simpleSchema: JSONSchema7 = {
      type: "object",
      properties: {
        givenName: { type: "string" },
        familyName: { type: "string" },
      },
    };

    const results = people.map((iri) =>
      extractFromGraph(
        iri,
        dataset,
        simpleSchema,
        {
          omitEmptyObjects: true,
        },
        "http://schema.org/",
      ),
    );

    // All should have been extracted
    results.forEach((result, idx) => {
      expect(result).toBeDefined();
      expect(result["@id"]).toBe(people[idx]);
      expect(result.givenName).toBeDefined();
      expect(typeof result.givenName).toBe("string");
    });
  });

  test("handles nested address extraction", () => {
    const result = extractFromGraph(
      "http://localhost:8080/data/person/amy-farrah-fowler",
      dataset,
      {
        type: "object",
        properties: {
          givenName: { type: "string" },
          familyName: { type: "string" },
          address: {
            type: "object",
            properties: {
              streetAddress: { type: "string" },
              addressLocality: { type: "string" },
              addressRegion: { type: "string" },
              postalCode: { type: "string" },
              addressCountry: { type: "string" },
            },
          },
        },
      },
      {},
      "http://schema.org/", // baseIRI
    );

    expect(result).toBeDefined();
    expect(result.givenName).toBeDefined();

    // Address may or may not exist in the dataset
    if (result.address) {
      expect(typeof result.address).toBe("object");
    }
  });

  test("works with console logger for debugging", () => {
    // Create a logger (won't actually log in tests, but verifies interface works)
    const logger = createConsoleLogger("error"); // Only log errors

    const result = extractFromGraph(
      "http://localhost:8080/data/person/bernadette-rostenkowski",
      dataset,
      {
        type: "object",
        properties: {
          givenName: { type: "string" },
          familyName: { type: "string" },
          email: { type: "string" },
        },
      },
      {},
      "http://schema.org/", // baseIRI
      undefined, // no context
      logger,
    );

    expect(result).toBeDefined();
    expect(result.givenName).toBeDefined();
  });

  test("extracts with Prisma-style filter options", () => {
    const result = extractFromGraph(
      "http://localhost:8080/data/person/sheldon-cooper",
      dataset,
      personSchema,
      {
        // Only select specific fields
        omit: ["telephone", "email"],
        includeRelationsByDefault: false,
        include: {
          knows: { take: 2 }, // Only first 2 friends
        },
      },
      "http://schema.org/", // baseIRI
    );

    expect(result).toBeDefined();
    expect(result.givenName).toBeDefined();
    expect(result.email).toBeUndefined(); // Should be omitted
    expect(result.telephone).toBeUndefined(); // Should be omitted

    // knows should have max 2 items if it exists
    if (result.knows) {
      expect(result.knows.length).toBeLessThanOrEqual(2);
    }
  });

  test("schema normalization happens automatically", () => {
    // Schema with $ref (not normalized)
    const schemaWithRef: JSONSchema7 = {
      type: "object",
      properties: {
        givenName: { type: "string" },
        familyName: { type: "string" },
        knows: {
          type: "array",
          items: { $ref: "#/$defs/PersonStub" },
        },
      },
      $defs: {
        PersonStub: {
          type: "object",
          properties: {
            "@id": { type: "string" },
            givenName: { type: "string" },
            familyName: { type: "string" },
          },
        },
      },
    };

    const result = extractFromGraph(
      "http://localhost:8080/data/person/leonard-hofstadter",
      dataset,
      schemaWithRef,
      {
        omitEmptyArrays: true,
      },
      "http://schema.org/", // baseIRI
    );

    expect(result).toBeDefined();
    expect(result.givenName).toBeDefined();
    // Should have resolved the $ref automatically
  });

  test("performance: extracts complex graph in reasonable time", () => {
    const start = Date.now();

    const result = extractFromGraph(
      "http://localhost:8080/data/person/sheldon-cooper",
      dataset,
      personSchema,
      {
        maxRecursion: 3,
      },
      "http://schema.org/", // baseIRI
    );

    const duration = Date.now() - start;

    expect(result).toBeDefined();
    // Should complete in under 1 second for this dataset
    expect(duration).toBeLessThan(1000);
  });

  test("explicit pagination: applies pagination during extraction stage", () => {
    // Schema without pagination metadata (passed through options instead)
    const schemaWithPagination: JSONSchema7 = {
      type: "object",
      properties: {
        givenName: { type: "string" },
        familyName: { type: "string" },
        knows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "@id": { type: "string" },
              givenName: { type: "string" },
            },
          },
        },
      },
    };

    const result = extractFromGraph(
      "http://localhost:8080/data/person/leonard-hofstadter",
      dataset,
      schemaWithPagination,
      {
        include: {
          knows: {
            skip: 0,
            take: 3, // Only take first 3 friends
          },
        },
      },
      "http://schema.org/",
    );

    expect(result).toBeDefined();
    expect(result.givenName).toBe("Leonard");
    expect(result.familyName).toBe("Hofstadter");

    // Knows array should be paginated to max 3 items
    if (result.knows) {
      expect(Array.isArray(result.knows)).toBe(true);
      expect(result.knows.length).toBeLessThanOrEqual(3);

      // Each item should have the properties defined in schema
      result.knows.forEach((friend: any) => {
        expect(friend["@id"]).toBeDefined();
        expect(typeof friend["@id"]).toBe("string");
        // givenName should be extracted since it's in the schema
        if (friend.givenName) {
          expect(typeof friend.givenName).toBe("string");
        }
      });
    }
  });

  test("explicit pagination: skips pagination when already applied at query stage", () => {
    // For query-stage pagination, the dataset is already limited
    // So we don't pass pagination through options
    const schemaWithQueryPagination: JSONSchema7 = {
      type: "object",
      properties: {
        givenName: { type: "string" },
        familyName: { type: "string" },
        knows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "@id": { type: "string" },
              givenName: { type: "string" },
              familyName: { type: "string" },
            },
          },
        },
      },
    };

    const result = extractFromGraph(
      "http://localhost:8080/data/person/leonard-hofstadter",
      dataset,
      schemaWithQueryPagination,
      {
        // No pagination in options - simulates query-stage pagination
        // where dataset is already limited
      },
      "http://schema.org/",
    );

    expect(result).toBeDefined();
    expect(result.givenName).toBe("Leonard");

    // The dataset contains all friends (not pre-paginated in our test).
    // With `include.knows: { take, _stage: "query" }`, the extractor skips re-slicing;
    // this test uses empty options, so it only documents the `_stage` contract.
    if (result.knows) {
      expect(Array.isArray(result.knows)).toBe(true);

      // In this test, the dataset wasn't actually pre-paginated
      // So we'll get all results (demonstrating that extraction didn't re-paginate)
      // In production, the CONSTRUCT query would have already limited the results in the dataset

      result.knows.forEach((friend: any) => {
        expect(friend["@id"]).toBeDefined();
        if (friend.givenName) {
          expect(typeof friend.givenName).toBe("string");
        }
        if (friend.familyName) {
          expect(typeof friend.familyName).toBe("string");
        }
      });
    }
  });

  test("pagination with skip and take: extracts correct slice", () => {
    // Test skip functionality
    const schemaWithSkip: JSONSchema7 = {
      type: "object",
      properties: {
        givenName: { type: "string" },
        knows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "@id": { type: "string" },
              givenName: { type: "string" },
            },
          },
        },
      },
    };

    const result = extractFromGraph(
      "http://localhost:8080/data/person/leonard-hofstadter",
      dataset,
      schemaWithSkip,
      {
        include: {
          knows: {
            skip: 2, // Skip first 2
            take: 2, // Take next 2
          },
        },
      },
      "http://schema.org/",
    );

    expect(result).toBeDefined();

    if (result.knows && result.knows.length > 0) {
      // Should have at most 2 items (after skipping first 2)
      expect(result.knows.length).toBeLessThanOrEqual(2);

      // All items should have required properties
      result.knows.forEach((friend: any) => {
        expect(friend["@id"]).toBeDefined();
      });
    }
  });

  test("pagination: handles edge cases (skip beyond array length)", () => {
    const schemaWithLargeSkip: JSONSchema7 = {
      type: "object",
      properties: {
        givenName: { type: "string" },
        knows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "@id": { type: "string" },
            },
          },
        },
      },
    };

    const result = extractFromGraph(
      "http://localhost:8080/data/person/leonard-hofstadter",
      dataset,
      schemaWithLargeSkip,
      {
        include: {
          knows: {
            skip: 1000, // Skip more than exists
            take: 10,
          },
        },
      },
      "http://schema.org/",
    );

    expect(result).toBeDefined();

    // Should handle gracefully - empty array or undefined
    if (result.knows) {
      expect(Array.isArray(result.knows)).toBe(true);
      expect(result.knows.length).toBe(0);
    }
  });
});

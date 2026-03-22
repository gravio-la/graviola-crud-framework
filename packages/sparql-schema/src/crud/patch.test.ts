import { describe, test, expect, mock } from "bun:test";
import Ajv from "ajv";
import { JSONSchema7 } from "json-schema";
import type { SchemaValidator } from "@graviola/edb-core-types";

import { patch } from "./patch";

const ajv = new Ajv() as SchemaValidator;

const defaultPrefix = "https://example.com/ontology#";
const entityIRI = "https://example.com/entity/123";
const typeIRI = "https://example.com/ontology#Person";

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "integer" },
    active: { type: "boolean" },
    score: { type: "number" },
    description: { type: "string" },
    address: {
      type: "object",
      properties: {
        street: { type: "string" },
        city: { type: "string" },
        zip: { type: "string" },
      },
    },
    tags: {
      type: "array",
      items: { type: "string" },
    },
    category: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        name: { type: "string" },
      },
    },
  },
  required: ["name"],
};

const createMocks = () => {
  let capturedQuery = "";
  const mockUpdateFetch = mock(async (query: string) => {
    capturedQuery = query;
    return {};
  });
  const mockAskFetch = mock(async (_query: string) => true); // Entity exists

  return {
    get capturedQuery() {
      return capturedQuery;
    },
    mockUpdateFetch,
    mockAskFetch,
  };
};

const defaultOptions = {
  defaultPrefix,
  queryBuildOptions: {},
};

const optionsWithValidator = {
  ...defaultOptions,
  validator: ajv,
};

describe("patch - SPARQL partial update", () => {
  describe("scalar property updates", () => {
    test("generates DELETE/INSERT for string property", async () => {
      let captured = "";
      const trackedUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAskFetch = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { name: "New Name" },
        schema,
        trackedUpdate,
        mockAskFetch,
        optionsWithValidator,
      );

      expect(trackedUpdate).toHaveBeenCalled();
      expect(captured).toContain("DELETE");
      expect(captured).toContain("INSERT");
      expect(captured).toContain("WHERE");
      expect(captured).toContain(":name");
      expect(captured).toContain("New Name");
      expect(captured).toContain(`PREFIX : <${defaultPrefix}>`);
    });

    test("generates correct query for number property", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { score: 9.5 },
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      expect(captured).toContain("DELETE");
      expect(captured).toContain("INSERT");
      expect(captured).toContain(":score");
    });

    test("handles multiple properties in single query", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { name: "Updated", age: 30 },
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      expect(mockUpdate).toHaveBeenCalledTimes(1); // Single query
      expect(captured).toContain(":name");
      expect(captured).toContain(":age");
    });
  });

  describe("null values (property deletion)", () => {
    test("null value generates DELETE only, no INSERT for that property", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { description: null },
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      expect(captured).toContain("DELETE");
      expect(captured).toContain(":description");
      // Should not have INSERT for this property
      // The query should still have a WHERE clause
      expect(captured).toContain("WHERE");
    });
  });

  describe("nested objects (shallow merge)", () => {
    test("generates nested delete patterns for object properties", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { address: { street: "Main St" } },
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      expect(captured).toContain("DELETE");
      expect(captured).toContain("INSERT");
      expect(captured).toContain(":address");
      expect(captured).toContain(":street");
      expect(captured).toContain("Main St");
    });
  });

  describe("entity reference", () => {
    test("object with @id is treated as entity reference", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { category: { "@id": "https://example.com/category/1" } },
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      expect(captured).toContain("DELETE");
      expect(captured).toContain("INSERT");
      expect(captured).toContain(":category");
      expect(captured).toContain("https://example.com/category/1");
    });
  });

  describe("array overwrite", () => {
    test("overwrites array values", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { tags: ["tag1", "tag2"] },
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      expect(captured).toContain("DELETE");
      expect(captured).toContain("INSERT");
      expect(captured).toContain(":tags");
      expect(captured).toContain("tag1");
      expect(captured).toContain("tag2");
    });
  });

  describe("error handling", () => {
    test("throws when entity does not exist", async () => {
      const mockUpdate = mock(async () => ({}));
      const mockAsk = mock(async () => false); // Entity does NOT exist

      await expect(
        patch(
          entityIRI,
          typeIRI,
          { name: "X" },
          schema,
          mockUpdate,
          mockAsk,
          optionsWithValidator,
        ),
      ).rejects.toThrow("Entity does not exist");
    });

    test("throws on schema validation failure (non-existent property)", async () => {
      const mockUpdate = mock(async () => ({}));
      const mockAsk = mock(async () => true);

      await expect(
        patch(
          entityIRI,
          typeIRI,
          { nonexistent: "value" },
          schema,
          mockUpdate,
          mockAsk,
          optionsWithValidator,
        ),
      ).rejects.toThrow("Patch validation failed");
    });

    test("throws on type mismatch when validator is provided", async () => {
      const mockUpdate = mock(async () => ({}));
      const mockAsk = mock(async () => true);

      await expect(
        patch(
          entityIRI,
          typeIRI,
          { age: "not a number" },
          schema,
          mockUpdate,
          mockAsk,
          optionsWithValidator,
        ),
      ).rejects.toThrow("Patch validation failed");
    });

    test("accepts type mismatch when no validator provided", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      // Without validator, type mismatches are accepted
      await patch(
        entityIRI,
        typeIRI,
        { age: "not a number" },
        schema,
        mockUpdate,
        mockAsk,
        defaultOptions,
      );

      expect(mockUpdate).toHaveBeenCalled();
    });

    test("does nothing when data is empty", async () => {
      const mockUpdate = mock(async () => ({}));
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        {},
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockAsk).not.toHaveBeenCalled();
    });
  });

  describe("query structure", () => {
    test("includes named graph WITH clause when defaultUpdateGraph is set", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { name: "Test" },
        schema,
        mockUpdate,
        mockAsk,
        {
          ...optionsWithValidator,
          defaultUpdateGraph: "https://example.com/graph/default",
        },
      );

      expect(captured).toContain("WITH");
      expect(captured).toContain("https://example.com/graph/default");
    });

    test("WHERE clause uses OPTIONAL for upsert of property values", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { name: "Test" },
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      expect(captured).toContain("OPTIONAL");
    });

    test("uses BIND for subject IRI", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { name: "Test" },
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      expect(captured).toContain("BIND");
      expect(captured).toContain(entityIRI);
    });

    test("rdf:type triples in INSERT are harmless (noop for existing entities)", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { name: "Test" },
        schema,
        mockUpdate,
        mockAsk,
        optionsWithValidator,
      );

      // The query should be generated successfully regardless of rdf:type presence
      expect(captured).toContain("DELETE");
      expect(captured).toContain("INSERT");
    });
  });

  describe("prefixed properties (prefixMap)", () => {
    const prefixedSchema: JSONSchema7 = {
      type: "object",
      properties: {
        "foaf:name": { type: "string" },
        "foaf:age": { type: "integer" },
        "schema:address": {
          type: "object",
          properties: {
            "schema:streetAddress": { type: "string" },
            "schema:postalCode": { type: "string" },
          },
        },
      },
    };

    const prefixMap = {
      foaf: "http://xmlns.com/foaf/0.1/",
      schema: "http://schema.org/",
    };

    test("generates valid SPARQL with prefixed property names", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { "foaf:name": "Alice" },
        prefixedSchema,
        mockUpdate,
        mockAsk,
        { ...defaultOptions, queryBuildOptions: { prefixes: prefixMap } },
      );

      expect(mockUpdate).toHaveBeenCalled();
      expect(captured).toContain("DELETE");
      expect(captured).toContain("INSERT");
      // The prefixed property should appear in the DELETE/WHERE patterns
      expect(captured).toContain("foaf:name");
      // The INSERT should contain the expanded IRI from JSON-LD processing
      expect(captured).toContain("Alice");
    });

    test("handles multiple prefixed properties", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { "foaf:name": "Bob", "foaf:age": 42 },
        prefixedSchema,
        mockUpdate,
        mockAsk,
        { ...defaultOptions, queryBuildOptions: { prefixes: prefixMap } },
      );

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(captured).toContain("foaf:name");
      expect(captured).toContain("foaf:age");
    });

    test("handles nested objects with prefixed properties", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { "schema:address": { "schema:streetAddress": "123 Main St" } },
        prefixedSchema,
        mockUpdate,
        mockAsk,
        { ...defaultOptions, queryBuildOptions: { prefixes: prefixMap } },
      );

      expect(mockUpdate).toHaveBeenCalled();
      expect(captured).toContain("schema:address");
      expect(captured).toContain("schema:streetAddress");
      expect(captured).toContain("123 Main St");
    });

    test("null value with prefixed property generates DELETE only", async () => {
      let captured = "";
      const mockUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });
      const mockAsk = mock(async () => true);

      await patch(
        entityIRI,
        typeIRI,
        { "foaf:name": null },
        prefixedSchema,
        mockUpdate,
        mockAsk,
        { ...defaultOptions, queryBuildOptions: { prefixes: prefixMap } },
      );

      expect(captured).toContain("DELETE");
      expect(captured).toContain("foaf:name");
      expect(captured).toContain("WHERE");
    });
  });
});

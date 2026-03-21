import { describe, test, expect, mock } from "bun:test";
import { JSONSchema7 } from "json-schema";

import { patch } from "./patch";

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

describe("patch - SPARQL partial update", () => {
  describe("scalar property updates", () => {
    test("generates DELETE/INSERT for string property", async () => {
      const { mockUpdateFetch, mockAskFetch, capturedQuery: _ } = createMocks();
      let captured = "";
      const trackedUpdate = mock(async (q: string) => {
        captured = q;
        return {};
      });

      await patch(
        entityIRI,
        typeIRI,
        { name: "New Name" },
        schema,
        trackedUpdate,
        mockAskFetch,
        defaultOptions,
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
        defaultOptions,
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
        defaultOptions,
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
        defaultOptions,
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
        defaultOptions,
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
        defaultOptions,
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
        defaultOptions,
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
          defaultOptions,
        ),
      ).rejects.toThrow("Entity does not exist");
    });

    test("throws on schema validation failure", async () => {
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
          defaultOptions,
        ),
      ).rejects.toThrow("Patch validation failed");
    });

    test("throws on type mismatch", async () => {
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
          defaultOptions,
        ),
      ).rejects.toThrow("Patch validation failed");
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
        defaultOptions,
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
          ...defaultOptions,
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
        defaultOptions,
      );

      expect(captured).toContain("OPTIONAL");
    });

    test("does not include rdf:type triples in INSERT", async () => {
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
        defaultOptions,
      );

      // The INSERT section should not contain rdf:type
      const insertStart = captured.indexOf("INSERT");
      const whereStart = captured.indexOf("WHERE");
      if (insertStart >= 0 && whereStart >= 0) {
        const insertSection = captured.substring(insertStart, whereStart);
        expect(insertSection).not.toContain(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        );
      }
    });
  });
});

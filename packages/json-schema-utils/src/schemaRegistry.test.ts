import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";

import { compileSchema } from "./schemaRegistry";

// ---------------------------------------------------------------------------
// Pattern A — Classic $ref entity (current working case)
// ---------------------------------------------------------------------------
describe("Pattern A — $ref entity", () => {
  const schema: JSONSchema7 = {
    type: "object",
    definitions: {
      Category: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          "@type": {
            type: "string",
            const: "http://example.org/Category",
          },
          name: { type: "string" },
          count: { type: "number" },
        },
        required: ["@id"],
      },
    },
    properties: {
      category: { $ref: "#/definitions/Category" },
    },
  };

  test("creates entry for Category", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.has("Category")).toBe(true);
  });

  test("classifies Category as entity", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("Category")!.isEntity).toBe(true);
  });

  test("extracts typeIRI from @type.const", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("Category")!.typeIRI).toBe(
      "http://example.org/Category",
    );
  });

  test("byPath lookup by definitions path", () => {
    const registry = compileSchema(schema);
    const entry = registry.byPath.get("#/definitions/Category");
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("Category");
  });

  test("byTypeIRI lookup", () => {
    const registry = compileSchema(schema);
    const entry = registry.byTypeIRI.get("http://example.org/Category");
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("Category");
  });

  test("resolvedSchema has @id in properties", () => {
    const registry = compileSchema(schema);
    const entry = registry.byName.get("Category")!;
    expect(entry.resolvedSchema.properties?.["@id"]).toBeDefined();
    expect(entry.resolvedSchema.properties?.["name"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Pattern B — Inlined entity (no $ref, but has @id)
// ---------------------------------------------------------------------------
describe("Pattern B — Inlined entity (no $ref)", () => {
  const schema: JSONSchema7 = {
    type: "object",
    definitions: {
      Article: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          "@type": {
            type: "string",
            const: "http://example.org/Article",
          },
          title: { type: "string" },
          author: {
            type: "object",
            properties: {
              "@id": { type: "string" },
              "@type": { type: "string" },
              name: { type: "string" },
            },
          },
        },
      },
    },
  };

  test("Article is classified as entity", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("Article")!.isEntity).toBe(true);
  });

  test("inlined author property is preserved in resolvedSchema", () => {
    const registry = compileSchema(schema);
    const article = registry.byName.get("Article")!;
    const author = article.resolvedSchema.properties?.["author"] as JSONSchema7;
    expect(author).toBeDefined();
    expect(author.properties?.["@id"]).toBeDefined();
    expect(author.properties?.["name"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Pattern C — $ref to non-entity (value object, no @id)
// ---------------------------------------------------------------------------
describe("Pattern C — $ref to value object", () => {
  const schema: JSONSchema7 = {
    type: "object",
    definitions: {
      Person: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          name: { type: "string" },
          address: { $ref: "#/definitions/Address" },
        },
      },
      Address: {
        type: "object",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
        },
      },
    },
  };

  test("Address is NOT classified as entity", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("Address")!.isEntity).toBe(false);
  });

  test("Person is classified as entity", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("Person")!.isEntity).toBe(true);
  });

  test("Address $ref is inlined in Person.resolvedSchema", () => {
    const registry = compileSchema(schema);
    const person = registry.byName.get("Person")!;
    const address = person.resolvedSchema.properties?.[
      "address"
    ] as JSONSchema7;
    // Value-object refs are inlined — the address should be the resolved object
    expect(address).toBeDefined();
    expect(address.$ref).toBeUndefined(); // $ref should be gone (inlined)
    expect(address.properties?.["street"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Pattern D — zod-4 style with __schema primitive + root $ref
// ---------------------------------------------------------------------------
describe("Pattern D — zod-4 style schema", () => {
  const schema: JSONSchema7 = {
    $defs: {
      __schema: { type: "string" },
      Category: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          "@type": {
            type: "string",
            const: "http://example.org/Category",
          },
          name: { $ref: "#/$defs/__schema" },
        },
      },
    },
    $ref: "#/$defs/Category",
  };

  test("resolvedRoot resolves the root $ref to Category", () => {
    const registry = compileSchema(schema);
    expect(registry.resolvedRoot.properties?.["@id"]).toBeDefined();
    expect(registry.resolvedRoot.properties?.["name"]).toBeDefined();
  });

  test("Category is classified as entity", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("Category")!.isEntity).toBe(true);
  });

  test("__schema is NOT classified as entity", () => {
    const registry = compileSchema(schema);
    const schemaEntry = registry.byName.get("__schema");
    expect(schemaEntry?.isEntity).toBe(false);
  });

  test("$defs key is normalised — byPath lookup works for both keys", () => {
    const registry = compileSchema(schema);
    // Primary key
    expect(registry.byPath.get("#/$defs/Category")?.isEntity).toBe(true);
    // Alt key (definitions alias)
    expect(registry.byPath.get("#/definitions/Category")?.isEntity).toBe(true);
  });

  test("name property in Category has $ref inlined (non-entity value)", () => {
    const registry = compileSchema(schema);
    const cat = registry.byName.get("Category")!;
    const name = cat.resolvedSchema.properties?.["name"] as JSONSchema7;
    // __schema is a non-entity, so its $ref should be inlined
    expect(name.$ref).toBeUndefined();
    expect(name.type).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Pattern E — allOf inheritance of @id
// ---------------------------------------------------------------------------
describe("Pattern E — allOf inheritance", () => {
  const schema: JSONSchema7 = {
    $defs: {
      Base: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          "@type": { type: "string" },
        },
      },
      Person: {
        allOf: [
          { $ref: "#/$defs/Base" },
          {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
          },
        ],
      },
    },
  };

  test("Base is classified as entity", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("Base")!.isEntity).toBe(true);
  });

  test("Person is classified as entity (inherits @id via allOf)", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("Person")!.isEntity).toBe(true);
  });

  test("Person resolvedSchema preserves allOf structure", () => {
    const registry = compileSchema(schema);
    const person = registry.byName.get("Person")!;
    // Base is an entity — its $ref is kept, not inlined
    expect(person.resolvedSchema.allOf).toBeDefined();
    expect(person.resolvedSchema.allOf!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Self-referencing schema (cycles)
// ---------------------------------------------------------------------------
describe("Cyclic / self-referencing schemas", () => {
  const schema: JSONSchema7 = {
    type: "object",
    definitions: {
      Category: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          "@type": {
            type: "string",
            const: "http://example.org/Category",
          },
          name: { type: "string" },
          subCategories: {
            type: "array",
            items: { $ref: "#/definitions/Category" },
          },
        },
      },
    },
  };

  test("does not throw on self-referencing schema", () => {
    expect(() => compileSchema(schema)).not.toThrow();
  });

  test("Category is classified as entity", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("Category")!.isEntity).toBe(true);
  });

  test("self-referencing $ref is preserved (not inlined)", () => {
    const registry = compileSchema(schema);
    const cat = registry.byName.get("Category")!;
    const items = (
      cat.resolvedSchema.properties?.["subCategories"] as JSONSchema7
    )?.items as JSONSchema7;
    // Category is an entity — its $ref must be kept, not expanded infinitely
    expect(items?.$ref).toBe("#/definitions/Category");
  });

  test("no JavaScript circular object references", () => {
    const registry = compileSchema(schema);
    // Should be JSON-serializable (no circular refs)
    const cat = registry.byName.get("Category")!;
    expect(() => JSON.stringify(cat.resolvedSchema)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Multi-hop cycles: A → B → C → A
// ---------------------------------------------------------------------------
describe("Multi-hop cycles (A → B → C → A)", () => {
  const schema: JSONSchema7 = {
    definitions: {
      A: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          b: { $ref: "#/definitions/B" },
        },
      },
      B: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          c: { $ref: "#/definitions/C" },
        },
      },
      C: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          a: { $ref: "#/definitions/A" },
        },
      },
    },
  };

  test("compiles without error", () => {
    expect(() => compileSchema(schema)).not.toThrow();
  });

  test("all three are entities", () => {
    const registry = compileSchema(schema);
    expect(registry.byName.get("A")!.isEntity).toBe(true);
    expect(registry.byName.get("B")!.isEntity).toBe(true);
    expect(registry.byName.get("C")!.isEntity).toBe(true);
  });

  test("entity $refs are preserved (no infinite expansion)", () => {
    const registry = compileSchema(schema);
    const a = registry.byName.get("A")!;
    const bProp = a.resolvedSchema.properties?.["b"] as JSONSchema7;
    expect(bProp?.$ref).toBe("#/definitions/B");
  });
});

// ---------------------------------------------------------------------------
// Stub schema
// ---------------------------------------------------------------------------
describe("stubSchema", () => {
  const schema: JSONSchema7 = {
    definitions: {
      Item: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          "@type": {
            type: "string",
            const: "http://example.org/Item",
          },
          title: { type: "string" },
          count: { type: "integer" },
          active: { type: "boolean" },
          related: {
            type: "array",
            items: { $ref: "#/definitions/Item" },
          },
        },
        required: ["@id", "title"],
      },
    },
  };

  test("stubSchema has additionalProperties: true", () => {
    const registry = compileSchema(schema);
    const stub = registry.byName.get("Item")!.stubSchema;
    expect(stub.additionalProperties).toBe(true);
  });

  test("stubSchema has required: []", () => {
    const registry = compileSchema(schema);
    const stub = registry.byName.get("Item")!.stubSchema;
    expect(stub.required).toEqual([]);
  });

  test("stubSchema includes @id and @type", () => {
    const registry = compileSchema(schema);
    const stub = registry.byName.get("Item")!.stubSchema;
    expect(stub.properties?.["@id"]).toBeDefined();
    expect(stub.properties?.["@type"]).toBeDefined();
  });

  test("stubSchema includes primitive properties", () => {
    const registry = compileSchema(schema);
    const stub = registry.byName.get("Item")!.stubSchema;
    expect(stub.properties?.["title"]).toBeDefined();
    expect(stub.properties?.["count"]).toBeDefined();
    expect(stub.properties?.["active"]).toBeDefined();
  });

  test("stubSchema excludes relation (array of entity)", () => {
    const registry = compileSchema(schema);
    const stub = registry.byName.get("Item")!.stubSchema;
    expect(stub.properties?.["related"]).toBeUndefined();
  });

  test("__label passes stubSchema validation (additionalProperties: true)", () => {
    const registry = compileSchema(schema);
    const stub = registry.byName.get("Item")!.stubSchema;
    // Simulate what AJV would do: additional property must be allowed
    expect(stub.additionalProperties).toBe(true);
    // There is no 'additionalProperties: false' to block __label
    expect(stub.additionalProperties).not.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rootSchema and resolvedRoot
// ---------------------------------------------------------------------------
describe("rootSchema and resolvedRoot", () => {
  test("rootSchema is the original unmodified schema", () => {
    const schema: JSONSchema7 = {
      definitions: {
        Foo: { type: "object", properties: { "@id": { type: "string" } } },
      },
    };
    const registry = compileSchema(schema);
    expect(registry.rootSchema).toBe(schema);
  });

  test("resolvedRoot resolves a root-level $ref", () => {
    const schema: JSONSchema7 = {
      $defs: {
        Root: {
          type: "object",
          properties: { "@id": { type: "string" }, name: { type: "string" } },
        },
      },
      $ref: "#/$defs/Root",
    };
    const registry = compileSchema(schema);
    expect(registry.resolvedRoot.properties?.["name"]).toBeDefined();
    expect(registry.resolvedRoot.$ref).toBeUndefined();
  });

  test("resolvedRoot equals rootSchema when no root $ref", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    const registry = compileSchema(schema);
    expect(registry.resolvedRoot).toBe(schema);
  });
});

// ---------------------------------------------------------------------------
// Empty / edge cases
// ---------------------------------------------------------------------------
describe("Edge cases", () => {
  test("schema with no definitions produces empty maps", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: { x: { type: "string" } },
    };
    const registry = compileSchema(schema);
    expect(registry.byName.size).toBe(0);
    expect(registry.byPath.size).toBe(0);
    expect(registry.byTypeIRI.size).toBe(0);
  });

  test("@type with enum array (single value) is extracted as typeIRI", () => {
    const schema: JSONSchema7 = {
      definitions: {
        Tag: {
          type: "object",
          properties: {
            "@id": { type: "string" },
            "@type": { type: "string", enum: ["http://example.org/Tag"] },
          },
        },
      },
    };
    const registry = compileSchema(schema);
    expect(registry.byName.get("Tag")!.typeIRI).toBe("http://example.org/Tag");
  });

  test("boolean definitions are skipped", () => {
    const schema: JSONSchema7 = {
      definitions: {
        // @ts-ignore — boolean definitions are valid in JSON Schema
        TrueSchema: true,
        Normal: {
          type: "object",
          properties: { "@id": { type: "string" } },
        },
      },
    };
    const registry = compileSchema(schema);
    expect(registry.byName.has("TrueSchema")).toBe(false);
    expect(registry.byName.has("Normal")).toBe(true);
  });

  test("value-object with no @id is not an entity", () => {
    const schema: JSONSchema7 = {
      definitions: {
        Coords: {
          type: "object",
          properties: { lat: { type: "number" }, lng: { type: "number" } },
        },
      },
    };
    const registry = compileSchema(schema);
    expect(registry.byName.get("Coords")!.isEntity).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------
describe("Performance", () => {
  test("compiles schema with 50+ definitions in < 50ms", () => {
    const definitions: JSONSchema7["definitions"] = {};
    for (let i = 0; i < 55; i++) {
      const name = `Type${i}`;
      definitions[name] = {
        type: "object",
        properties: {
          "@id": { type: "string" },
          "@type": {
            type: "string",
            const: `http://example.org/${name}`,
          },
          label: { type: "string" },
          value: { type: "number" },
          // Every 3rd type references the previous type
          ...(i > 0 && i % 3 === 0
            ? { related: { $ref: `#/definitions/Type${i - 1}` } }
            : {}),
        },
      };
    }
    const schema: JSONSchema7 = { type: "object", definitions };

    const start = Date.now();
    const registry = compileSchema(schema);
    const elapsed = Date.now() - start;

    expect(registry.byName.size).toBe(55);
    expect(elapsed).toBeLessThan(50);
  });
});

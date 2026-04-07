import { describe, expect, test } from "@jest/globals";
import type { JSONSchema7 } from "json-schema";
import {
  resolveAllRefs,
  isRelationshipSchema,
  extractPropertyMetadata,
} from "./resolveAllRefs";
import type { NormalizationContext } from "./types";

describe("isRelationshipSchema", () => {
  test("identifies schema with @id as relationship", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        "@id": { type: "string" },
        name: { type: "string" },
      },
    };

    expect(isRelationshipSchema(schema)).toBe(true);
  });

  test("identifies schema without @id as non-relationship", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };

    expect(isRelationshipSchema(schema)).toBe(false);
  });

  test("returns false for non-object schemas", () => {
    const schema: JSONSchema7 = {
      type: "string",
    };

    expect(isRelationshipSchema(schema)).toBe(false);
  });

  test("returns true for allOf-inherited @id (Pattern E)", () => {
    const schema: JSONSchema7 = {
      allOf: [
        {
          type: "object",
          properties: {
            "@id": { type: "string" },
            "@type": { type: "string" },
          },
        },
        {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
      ],
    };

    expect(isRelationshipSchema(schema)).toBe(true);
  });

  test("returns false for allOf without @id in any member", () => {
    const schema: JSONSchema7 = {
      allOf: [
        { type: "object", properties: { x: { type: "string" } } },
        { type: "object", properties: { y: { type: "number" } } },
      ],
    };

    expect(isRelationshipSchema(schema)).toBe(false);
  });
});

describe("extractPropertyMetadata", () => {
  test("detects array property", () => {
    const schema: JSONSchema7 = {
      type: "array",
      items: {
        type: "string",
      },
    };

    const context: NormalizationContext = {
      rootSchema: {},
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const metadata = extractPropertyMetadata(schema, context);

    expect(metadata.isArray).toBe(true);
    expect(metadata.itemType).toBe("string");
    expect(metadata.isRelationship).toBe(false);
  });

  test("detects array of relationships", () => {
    const schema: JSONSchema7 = {
      type: "array",
      items: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          label: { type: "string" },
        },
      },
    };

    const context: NormalizationContext = {
      rootSchema: {},
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const metadata = extractPropertyMetadata(schema, context);

    expect(metadata.isArray).toBe(true);
    expect(metadata.itemType).toBe("object");
    expect(metadata.isRelationship).toBe(true);
  });

  test("detects object relationship", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        "@id": { type: "string" },
        name: { type: "string" },
      },
    };

    const context: NormalizationContext = {
      rootSchema: {},
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const metadata = extractPropertyMetadata(schema, context);

    expect(metadata.isArray).toBe(false);
    expect(metadata.isRelationship).toBe(true);
  });
});

describe("resolveAllRefs", () => {
  test("resolves simple $ref", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        address: { $ref: "#/$defs/Address" },
      },
      $defs: {
        Address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
          },
        },
      },
    };

    const context: NormalizationContext = {
      rootSchema: schema,
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const resolved = resolveAllRefs(schema, context);

    expect(resolved.properties?.address).toBeDefined();
    expect((resolved.properties?.address as JSONSchema7).$ref).toBeUndefined();
    expect(
      (resolved.properties?.address as JSONSchema7).properties,
    ).toBeDefined();
    expect(
      (resolved.properties?.address as JSONSchema7).properties?.street,
    ).toEqual({ type: "string" });
  });

  test("resolves nested $refs", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        person: { $ref: "#/$defs/Person" },
      },
      $defs: {
        Person: {
          type: "object",
          properties: {
            name: { type: "string" },
            address: { $ref: "#/$defs/Address" },
          },
        },
        Address: {
          type: "object",
          properties: {
            street: { type: "string" },
          },
        },
      },
    };

    const context: NormalizationContext = {
      rootSchema: schema,
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const resolved = resolveAllRefs(schema, context);

    const personSchema = resolved.properties?.person as JSONSchema7;
    expect(personSchema.$ref).toBeUndefined();
    expect(personSchema.properties?.name).toEqual({ type: "string" });

    const addressSchema = personSchema.properties?.address as JSONSchema7;
    expect(addressSchema.$ref).toBeUndefined();
    expect(addressSchema.properties?.street).toEqual({ type: "string" });
  });

  test("handles circular references without infinite loop", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        parent: { $ref: "#/$defs/Person" },
      },
      $defs: {
        Person: {
          type: "object",
          properties: {
            name: { type: "string" },
            parent: { $ref: "#/$defs/Person" },
          },
        },
      },
    };

    const context: NormalizationContext = {
      rootSchema: schema,
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    // Should not throw or hang
    const resolved = resolveAllRefs(schema, context);

    expect(resolved).toBeDefined();
    expect(resolved.properties?.parent).toBeDefined();
  });

  test("resolves $refs in array items", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { $ref: "#/$defs/Tag" },
        },
      },
      $defs: {
        Tag: {
          type: "object",
          properties: {
            label: { type: "string" },
            "@id": { type: "string" },
          },
        },
      },
    };

    const context: NormalizationContext = {
      rootSchema: schema,
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const resolved = resolveAllRefs(schema, context);

    const tagsSchema = resolved.properties?.tags as JSONSchema7;
    expect(tagsSchema.items).toBeDefined();
    expect((tagsSchema.items as JSONSchema7).$ref).toBeUndefined();
    expect((tagsSchema.items as JSONSchema7).properties?.label).toEqual({
      type: "string",
    });
  });

  test("resolves $refs in allOf", () => {
    const schema: JSONSchema7 = {
      type: "object",
      allOf: [
        { $ref: "#/$defs/Base" },
        {
          properties: {
            extended: { type: "string" },
          },
        },
      ],
      $defs: {
        Base: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
      },
    };

    const context: NormalizationContext = {
      rootSchema: schema,
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const resolved = resolveAllRefs(schema, context);

    expect(resolved.allOf).toBeDefined();
    expect(resolved.allOf?.[0]).toBeDefined();
    expect((resolved.allOf?.[0] as JSONSchema7).$ref).toBeUndefined();
    expect((resolved.allOf?.[0] as JSONSchema7).properties?.id).toEqual({
      type: "string",
    });
  });

  test("resolves $refs in anyOf", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        value: {
          anyOf: [
            { $ref: "#/$defs/StringValue" },
            { $ref: "#/$defs/NumberValue" },
          ],
        },
      },
      $defs: {
        StringValue: {
          type: "object",
          properties: {
            str: { type: "string" },
          },
        },
        NumberValue: {
          type: "object",
          properties: {
            num: { type: "number" },
          },
        },
      },
    };

    const context: NormalizationContext = {
      rootSchema: schema,
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const resolved = resolveAllRefs(schema, context);

    const valueSchema = resolved.properties?.value as JSONSchema7;
    expect(valueSchema.anyOf).toBeDefined();
    expect(valueSchema.anyOf?.[0]).toBeDefined();
    expect((valueSchema.anyOf?.[0] as JSONSchema7).$ref).toBeUndefined();
    expect((valueSchema.anyOf?.[0] as JSONSchema7).properties?.str).toEqual({
      type: "string",
    });
  });

  test("resolves $refs in oneOf", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        payment: {
          oneOf: [{ $ref: "#/$defs/Card" }, { $ref: "#/$defs/Cash" }],
        },
      },
      $defs: {
        Card: {
          type: "object",
          properties: {
            cardNumber: { type: "string" },
          },
        },
        Cash: {
          type: "object",
          properties: {
            amount: { type: "number" },
          },
        },
      },
    };

    const context: NormalizationContext = {
      rootSchema: schema,
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const resolved = resolveAllRefs(schema, context);

    const paymentSchema = resolved.properties?.payment as JSONSchema7;
    expect(paymentSchema.oneOf).toBeDefined();
    expect(paymentSchema.oneOf?.[0]).toBeDefined();
    expect((paymentSchema.oneOf?.[0] as JSONSchema7).$ref).toBeUndefined();
    expect(
      (paymentSchema.oneOf?.[0] as JSONSchema7).properties?.cardNumber,
    ).toEqual({
      type: "string",
    });
  });

  test("preserves schema immutability", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        ref: { $ref: "#/$defs/Thing" },
      },
      $defs: {
        Thing: {
          type: "object",
          properties: {
            value: { type: "string" },
          },
        },
      },
    };

    const context: NormalizationContext = {
      rootSchema: schema,
      filterOptions: {},
      visitedRefs: new Set(),
      depth: 0,
    };

    const resolved = resolveAllRefs(schema, context);

    // Original schema should still have $ref
    expect((schema.properties?.ref as JSONSchema7).$ref).toBe("#/$defs/Thing");
    // Resolved schema should not have $ref
    expect((resolved.properties?.ref as JSONSchema7).$ref).toBeUndefined();
  });
});

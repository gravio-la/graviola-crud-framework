import { describe, test, expect } from "bun:test";
import { JSONSchema7 } from "json-schema";

import { validatePatchData } from "./validatePatchData";

const testSchema: JSONSchema7 = {
  type: "object",
  definitions: {
    Category: {
      type: "object",
      properties: {
        name: { type: "string" },
        basePrice: { type: "number" },
      },
      required: ["name"],
    },
    Tag: {
      type: "object",
      properties: {
        label: { type: "string" },
      },
    },
  },
  properties: {
    name: { type: "string" },
    age: { type: "integer" },
    score: { type: "number" },
    active: { type: "boolean" },
    description: { type: "string" },
    category: { $ref: "#/definitions/Category" },
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
    relatedItems: {
      type: "array",
      items: { $ref: "#/definitions/Tag" },
    },
  },
  required: ["name"],
};

describe("validatePatchData", () => {
  describe("valid cases", () => {
    test("valid string property", () => {
      const errors = validatePatchData({ name: "New Name" }, testSchema);
      expect(errors).toHaveLength(0);
    });

    test("valid number property", () => {
      const errors = validatePatchData({ score: 9.5 }, testSchema);
      expect(errors).toHaveLength(0);
    });

    test("valid integer property", () => {
      const errors = validatePatchData({ age: 30 }, testSchema);
      expect(errors).toHaveLength(0);
    });

    test("valid boolean property", () => {
      const errors = validatePatchData({ active: true }, testSchema);
      expect(errors).toHaveLength(0);
    });

    test("null value is always valid (means delete)", () => {
      const errors = validatePatchData({ name: null }, testSchema);
      expect(errors).toHaveLength(0);
    });

    test("multiple valid properties", () => {
      const errors = validatePatchData(
        { name: "X", age: 25, active: false },
        testSchema,
      );
      expect(errors).toHaveLength(0);
    });

    test("valid nested object", () => {
      const errors = validatePatchData(
        { address: { street: "Main St", city: "Berlin" } },
        testSchema,
      );
      expect(errors).toHaveLength(0);
    });

    test("valid array of strings", () => {
      const errors = validatePatchData({ tags: ["tag1", "tag2"] }, testSchema);
      expect(errors).toHaveLength(0);
    });

    test("valid array of objects via $ref", () => {
      const errors = validatePatchData(
        { relatedItems: [{ label: "item1" }] },
        testSchema,
      );
      expect(errors).toHaveLength(0);
    });

    test("valid $ref property", () => {
      const errors = validatePatchData(
        { category: { name: "Electronics", basePrice: 99.99 } },
        testSchema,
      );
      expect(errors).toHaveLength(0);
    });

    test("entity reference (object with @id) is valid", () => {
      const errors = validatePatchData(
        { category: { "@id": "http://example.com/cat/1" } },
        testSchema,
      );
      expect(errors).toHaveLength(0);
    });

    test("@id and @type properties are skipped", () => {
      const errors = validatePatchData(
        { "@id": "http://example.com/1", name: "Test" },
        testSchema,
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("invalid cases", () => {
    test("non-existent property", () => {
      const errors = validatePatchData({ nonexistent: "value" }, testSchema);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("nonexistent");
      expect(errors[0].message).toContain("does not exist");
    });

    test("string type mismatch", () => {
      const errors = validatePatchData({ name: 42 }, testSchema);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("name");
      expect(errors[0].expectedType).toBe("string");
      expect(errors[0].actualType).toBe("number");
    });

    test("number type mismatch", () => {
      const errors = validatePatchData({ score: "high" }, testSchema);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("score");
      expect(errors[0].expectedType).toBe("number");
    });

    test("integer receives float", () => {
      const errors = validatePatchData({ age: 3.5 }, testSchema);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("age");
      expect(errors[0].message).toContain("integer");
    });

    test("integer receives string", () => {
      const errors = validatePatchData({ age: "thirty" }, testSchema);
      expect(errors).toHaveLength(1);
      expect(errors[0].expectedType).toBe("integer");
    });

    test("boolean type mismatch", () => {
      const errors = validatePatchData({ active: "yes" }, testSchema);
      expect(errors).toHaveLength(1);
      expect(errors[0].expectedType).toBe("boolean");
    });

    test("array expected but got object", () => {
      const errors = validatePatchData({ tags: { a: "b" } }, testSchema);
      expect(errors).toHaveLength(1);
      expect(errors[0].expectedType).toBe("array");
    });

    test("object expected but got array", () => {
      const errors = validatePatchData(
        { address: ["not", "an", "object"] },
        testSchema,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].expectedType).toBe("object");
    });

    test("invalid nested property", () => {
      const errors = validatePatchData(
        { address: { nonexistent: "value" } },
        testSchema,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("address.nonexistent");
      expect(errors[0].message).toContain("does not exist");
    });

    test("array element type mismatch", () => {
      const errors = validatePatchData({ tags: [1, 2, 3] }, testSchema);
      expect(errors).toHaveLength(3);
      expect(errors[0].property).toBe("tags[0]");
      expect(errors[0].expectedType).toBe("string");
    });

    test("multiple errors reported", () => {
      const errors = validatePatchData(
        { name: 42, nonexistent: "x", age: "old" },
        testSchema,
      );
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    test("schema with no properties", () => {
      const emptySchema: JSONSchema7 = { type: "object" };
      const errors = validatePatchData({ name: "x" }, emptySchema);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("no properties");
    });
  });
});

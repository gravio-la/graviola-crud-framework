import { describe, test, expect } from "bun:test";
import Ajv from "ajv";
import { JSONSchema7 } from "json-schema";
import type { SchemaValidator } from "@graviola/edb-core-types";

import { validatePatchData } from "./validatePatchData";

const ajv = new Ajv() as SchemaValidator;

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
  describe("valid cases (with ajv validator)", () => {
    test("valid string property", () => {
      const errors = validatePatchData(
        { name: "New Name" },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("valid number property", () => {
      const errors = validatePatchData(
        { score: 9.5 },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("valid integer property", () => {
      const errors = validatePatchData({ age: 30 }, testSchema, undefined, ajv);
      expect(errors).toHaveLength(0);
    });

    test("valid boolean property", () => {
      const errors = validatePatchData(
        { active: true },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("null value is always valid (means delete)", () => {
      const errors = validatePatchData(
        { name: null },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("multiple valid properties", () => {
      const errors = validatePatchData(
        { name: "X", age: 25, active: false },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("valid nested object", () => {
      const errors = validatePatchData(
        { address: { street: "Main St", city: "Berlin" } },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("valid array of strings", () => {
      const errors = validatePatchData(
        { tags: ["tag1", "tag2"] },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("valid array of objects via $ref", () => {
      const errors = validatePatchData(
        { relatedItems: [{ label: "item1" }] },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("valid $ref property", () => {
      const errors = validatePatchData(
        { category: { name: "Electronics", basePrice: 99.99 } },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("entity reference (object with @id) is valid", () => {
      const errors = validatePatchData(
        { category: { "@id": "http://example.com/cat/1" } },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });

    test("@id and @type properties are skipped", () => {
      const errors = validatePatchData(
        { "@id": "http://example.com/1", name: "Test" },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("invalid cases (with ajv validator)", () => {
    test("non-existent property", () => {
      const errors = validatePatchData(
        { nonexistent: "value" },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("nonexistent");
      expect(errors[0].message).toContain("does not exist");
    });

    test("string type mismatch", () => {
      const errors = validatePatchData(
        { name: 42 },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("name");
    });

    test("number type mismatch", () => {
      const errors = validatePatchData(
        { score: "high" },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("score");
    });

    test("integer receives float", () => {
      const errors = validatePatchData(
        { age: 3.5 },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("age");
    });

    test("integer receives string", () => {
      const errors = validatePatchData(
        { age: "thirty" },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("age");
    });

    test("boolean type mismatch", () => {
      const errors = validatePatchData(
        { active: "yes" },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("active");
    });

    test("invalid nested property", () => {
      const errors = validatePatchData(
        { address: { nonexistent: "value" } },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("address.nonexistent");
      expect(errors[0].message).toContain("does not exist");
    });

    test("array element type mismatch", () => {
      const errors = validatePatchData(
        { tags: [1, 2, 3] },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(3);
      expect(errors[0].property).toBe("tags[0]");
    });

    test("multiple errors reported", () => {
      const errors = validatePatchData(
        { name: 42, nonexistent: "x", age: "old" },
        testSchema,
        undefined,
        ajv,
      );
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    test("schema with no properties", () => {
      const emptySchema: JSONSchema7 = { type: "object" };
      const errors = validatePatchData(
        { name: "x" },
        emptySchema,
        undefined,
        ajv,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("no properties");
    });
  });

  describe("without validator (accepts everything)", () => {
    test("type mismatch is accepted when no validator provided", () => {
      const errors = validatePatchData({ name: 42 }, testSchema);
      expect(errors).toHaveLength(0);
    });

    test("structural errors still caught without validator", () => {
      const errors = validatePatchData({ nonexistent: "value" }, testSchema);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("does not exist");
    });

    test("nested non-existent property still caught without validator", () => {
      const errors = validatePatchData(
        { address: { nonexistent: "value" } },
        testSchema,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("address.nonexistent");
    });
  });
});

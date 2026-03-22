import { describe, test, expect, mock } from "bun:test";
import type { JSONSchema7 } from "json-schema";

import { patchPrisma } from "./patch";

const entityIRI = "https://example.com/entity/123";

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "integer" },
    active: { type: "boolean" },
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
    friends: {
      type: "array",
      items: {
        type: "object",
        properties: {
          "@id": { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
  required: ["name"],
};

function createMockPrisma(
  existingEntity: Record<string, unknown> | null = { id: entityIRI },
) {
  const updateData: Record<string, unknown>[] = [];
  return {
    updateData,
    prisma: {
      TestType: {
        findUnique: mock(async () => existingEntity),
        update: mock(async ({ data }: { data: Record<string, unknown> }) => {
          updateData.push(data);
          return data;
        }),
      },
    },
  };
}

describe("patchPrisma - Prisma partial update", () => {
  describe("scalar property updates", () => {
    test("updates a single string property", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { name: "New Name" },
        schema,
        schema,
        prisma,
      );

      expect(prisma.TestType.update).toHaveBeenCalled();
      expect(updateData[0]).toEqual({ name: "New Name" });
    });

    test("updates multiple scalar properties", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { name: "Updated", age: 30, active: true },
        schema,
        schema,
        prisma,
      );

      expect(updateData[0]).toEqual({ name: "Updated", age: 30, active: true });
    });

    test("sets property to null", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { description: null },
        schema,
        schema,
        prisma,
      );

      expect(updateData[0]).toEqual({ description: null });
    });
  });

  describe("nested objects (underscore-flattened)", () => {
    test("flattens nested object into underscore-prefixed properties", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { address: { street: "Main St", city: "Berlin" } },
        schema,
        schema,
        prisma,
      );

      expect(updateData[0]).toEqual({
        address_street: "Main St",
        address_city: "Berlin",
      });
    });

    test("only updates specified sub-properties (shallow merge)", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { address: { street: "New Street" } },
        schema,
        schema,
        prisma,
      );

      // Only street should be updated, not city or zip
      expect(updateData[0]).toEqual({ address_street: "New Street" });
    });

    test("null nested object clears all sub-properties from schema", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { address: null },
        schema,
        schema,
        prisma,
      );

      expect(updateData[0]).toEqual({
        address_street: null,
        address_city: null,
        address_zip: null,
      });
    });
  });

  describe("entity references (Prisma relations)", () => {
    test("connects an entity reference via @id", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { category: { "@id": "https://example.com/category/1" } },
        schema,
        schema,
        prisma,
      );

      expect(updateData[0]).toEqual({
        category: { connect: { id: "https://example.com/category/1" } },
      });
    });

    test("disconnects entity reference when null", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { category: null },
        schema,
        schema,
        prisma,
      );

      expect(updateData[0]).toEqual({
        category: { disconnect: true },
      });
    });

    test("applies IRItoId when connecting relations", async () => {
      const { prisma, updateData } = createMockPrisma();
      const IRItoId = (iri: string) => iri.replace("https://example.com/", "");

      await patchPrisma(
        "TestType",
        entityIRI,
        { category: { "@id": "https://example.com/category/1" } },
        schema,
        schema,
        prisma,
        { IRItoId },
      );

      expect(updateData[0]).toEqual({
        category: { connect: { id: "category/1" } },
      });
    });
  });

  describe("array properties", () => {
    test("replaces scalar array directly", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { tags: ["tag1", "tag2"] },
        schema,
        schema,
        prisma,
      );

      expect(updateData[0]).toEqual({ tags: ["tag1", "tag2"] });
    });

    test("replaces array of entity references with set", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        {
          friends: [
            { "@id": "https://example.com/person/1" },
            { "@id": "https://example.com/person/2" },
          ],
        },
        schema,
        schema,
        prisma,
      );

      expect(updateData[0]).toEqual({
        friends: {
          set: [
            { id: "https://example.com/person/1" },
            { id: "https://example.com/person/2" },
          ],
        },
      });
    });
  });

  describe("error handling", () => {
    test("throws when entity does not exist", async () => {
      const { prisma } = createMockPrisma(null);

      await expect(
        patchPrisma(
          "TestType",
          entityIRI,
          { name: "X" },
          schema,
          schema,
          prisma,
        ),
      ).rejects.toThrow("Entity does not exist");
    });

    test("throws on schema validation failure (non-existent property)", async () => {
      const { prisma } = createMockPrisma();

      await expect(
        patchPrisma(
          "TestType",
          entityIRI,
          { nonexistent: "value" },
          schema,
          schema,
          prisma,
        ),
      ).rejects.toThrow("Patch validation failed");
    });

    test("does nothing when data is empty", async () => {
      const { prisma } = createMockPrisma();

      await patchPrisma("TestType", entityIRI, {}, schema, schema, prisma);

      expect(prisma.TestType.findUnique).not.toHaveBeenCalled();
      expect(prisma.TestType.update).not.toHaveBeenCalled();
    });

    test("does nothing when only @-prefixed keys", async () => {
      const { prisma } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        { "@id": "foo", "@type": "bar" },
        schema,
        schema,
        prisma,
      );

      expect(prisma.TestType.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("mixed updates", () => {
    test("handles scalar + nested + relation in single patch", async () => {
      const { prisma, updateData } = createMockPrisma();

      await patchPrisma(
        "TestType",
        entityIRI,
        {
          name: "Updated Name",
          address: { street: "New Street" },
          category: { "@id": "https://example.com/category/2" },
        },
        schema,
        schema,
        prisma,
      );

      expect(updateData[0]).toEqual({
        name: "Updated Name",
        address_street: "New Street",
        category: { connect: { id: "https://example.com/category/2" } },
      });
    });
  });
});

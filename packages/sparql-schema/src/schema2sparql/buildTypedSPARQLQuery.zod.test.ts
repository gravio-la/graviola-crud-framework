/**
 * Tests for Zod schema support in buildTypedSPARQLQuery
 * Demonstrates that you can pass Zod schemas directly without manual conversion
 */

import { describe, it, expect } from "@jest/globals";
import { z } from "zod";
import { buildTypedSPARQLQuery } from "./buildTypedSPARQLQuery";

describe("buildTypedSPARQLQuery - Zod Schema Support", () => {
  it("should accept Zod schema directly and convert to JSON Schema automatically", () => {
    // Define a Zod schema
    const PersonSchema = z.object({
      "@id": z.string().optional(),
      "@type": z.literal("http://example.com/Person"),
      name: z.string(),
      age: z.number(),
      email: z.string(),
    });

    type Person = z.infer<typeof PersonSchema>;

    // Pass Zod schema directly - no manual conversion needed!
    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      "http://example.com/Person",
      PersonSchema, // <- Zod schema, not JSON Schema!
      {
        select: { name: true, age: true },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain(":name");
    expect(result.query).toContain(":age");
  });

  it("should work with nested Zod schemas", () => {
    const AddressSchema = z.object({
      street: z.string(),
      city: z.string(),
      country: z.string(),
    });

    const PersonSchema = z.object({
      "@id": z.string().optional(),
      "@type": z.literal("http://example.com/Person"),
      name: z.string(),
      address: AddressSchema,
    });

    type Person = z.infer<typeof PersonSchema>;

    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      PersonSchema, // Zod schema with nested object
      {
        include: { address: true },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain(":address");
    expect(result.query).toContain(":street");
    expect(result.query).toContain(":city");
  });

  it("should work with array relationships in Zod schemas", () => {
    const FriendSchema = z.object({
      "@id": z.string().optional(),
      name: z.string(),
      age: z.number(),
    });

    const PersonSchema = z.object({
      "@id": z.string().optional(),
      "@type": z.literal("http://example.com/Person"),
      name: z.string(),
      friends: z.array(FriendSchema),
    });

    type Person = z.infer<typeof PersonSchema>;

    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      PersonSchema, // Zod schema with array
      {
        include: {
          friends: {
            take: 5,
            orderBy: { name: "asc" },
          },
        },
        prefixMap: { "": "http://example.com/" },
        flavour: "sparql12",
      },
    );

    expect(result.query).toContain("CONSTRUCT");
    expect(result.query).toContain(":friends");
    expect(result.query).toContain("LATERAL");
    expect(result.query).toContain("LIMIT 5");
  });

  it("should support WHERE filters on Zod schema properties", () => {
    const PersonSchema = z.object({
      "@id": z.string().optional(),
      name: z.string(),
      age: z.number(),
      email: z.string(),
    });

    type Person = z.infer<typeof PersonSchema>;

    const result = buildTypedSPARQLQuery<Person>(
      "http://example.com/person/1",
      undefined,
      PersonSchema,
      {
        where: {
          age: { gte: 18 },
          email: { endsWith: "@example.com" },
        },
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
    expect(result.query).toContain("FILTER");
  });

  it("should still work with JSON Schema (backward compatible)", () => {
    // Old way: passing JSON Schema directly
    const personJSONSchema = {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
        age: { type: "number" as const },
      },
    };

    const result = buildTypedSPARQLQuery(
      "http://example.com/person/1",
      undefined,
      personJSONSchema,
      {
        prefixMap: { "": "http://example.com/" },
      },
    );

    expect(result.query).toBeDefined();
    expect(result.query).toContain("CONSTRUCT");
  });
});

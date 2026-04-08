import { describe, test, expect } from "bun:test";
import { JSONSchema7 } from "json-schema";
import { normalizeSchema } from "@graviola/edb-graph-traversal";
import { normalizedSchema2construct } from "./normalizedSchema2construct";

const friendsFilterOptions = {
  include: {
    friends: {
      take: 10,
      orderBy: { name: "asc" as const },
    },
  },
};

const friendsSchema: JSONSchema7 = {
  type: "object",
  properties: {
    friends: {
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

describe("normalizedSchema2construct — default flavour (no relationship SUBSELECT)", () => {
  test("does not emit SELECT/LIMIT for paginated includes", () => {
    const normalized = normalizeSchema(friendsSchema, friendsFilterOptions);

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      { filterOptions: friendsFilterOptions },
    );

    const whereString = result.wherePatterns
      .map((p) => p.toString())
      .join("\n");

    expect(whereString).not.toContain("LIMIT ");
    expect(whereString).not.toContain("LATERAL");
    expect(result.paginationMetadata.get("friends")?._stage).toBe("extraction");
  });

  test("does not generate SUBSELECT for array without pagination", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
    };

    const normalized = normalizeSchema(schema, {
      include: {
        tags: true,
      },
    });

    const result = normalizedSchema2construct(
      "http://example.com/article1",
      undefined,
      normalized,
    );

    expect(result.paginationMetadata.has("tags")).toBe(false);
  });
});

describe("normalizedSchema2construct — sparql12 (LATERAL + SUBSELECT)", () => {
  test("generates LATERAL SUBSELECT with single ORDER BY", () => {
    const normalized = normalizeSchema(friendsSchema, friendsFilterOptions);

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      { filterOptions: friendsFilterOptions, flavour: "sparql12" },
    );

    const pagMeta = result.paginationMetadata.get("friends");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?.orderBy).toEqual({ name: "asc" });
    expect(pagMeta?.take).toBe(10);
    expect(pagMeta?._stage).toBe("query");

    const whereString = result.wherePatterns
      .map((p) => p.toString())
      .join("\n");

    expect(whereString).toContain("LATERAL");
    expect(whereString).toContain("SELECT");
    expect(whereString).toContain("?subject");
    expect(whereString).toContain("ORDER BY");
    expect(whereString).toContain("LIMIT 10");
  });

  test("generates SUBSELECT with multiple ORDER BY criteria", () => {
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
      "http://example.com/blog1",
      undefined,
      normalized,
      { filterOptions, flavour: "sparql12" },
    );

    const whereString = result.wherePatterns
      .map((p) => p.toString())
      .join("\n");

    expect(whereString).toContain("LATERAL");
    expect(whereString).toContain("ORDER BY");
    expect(whereString).toContain("LIMIT 20");
    expect(whereString).toContain("OFFSET 5");
  });

  test("generates SUBSELECT with LIMIT only (no ORDER BY)", () => {
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
      "http://example.com/list1",
      undefined,
      normalized,
      { filterOptions, flavour: "sparql12" },
    );

    const whereString = result.wherePatterns
      .map((p) => p.toString())
      .join("\n");

    expect(whereString).toContain("LATERAL");
    expect(whereString).toContain("SELECT");
    expect(whereString).toContain("LIMIT 5");
    expect(whereString).not.toContain("ORDER BY");
  });

  test("handles OFFSET without ORDER BY", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        items: {
          take: 10,
          skip: 20,
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);

    const result = normalizedSchema2construct(
      "http://example.com/container1",
      undefined,
      normalized,
      { filterOptions, flavour: "sparql12" },
    );

    const whereString = result.wherePatterns
      .map((p) => p.toString())
      .join("\n");

    expect(whereString).toContain("SELECT");
    expect(whereString).toContain("LIMIT 10");
    expect(whereString).toContain("OFFSET 20");
  });

  test("SUBSELECT includes ORDER BY property patterns", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        friends: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        friends: {
          take: 10,
          orderBy: { name: "asc" as const },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      { filterOptions, flavour: "sparql12" },
    );

    const whereString = result.wherePatterns
      .map((p) => p.toString())
      .join("\n");

    expect(whereString).toContain("SELECT");
    expect(whereString).toContain("ORDER BY");
  });

  test("handles prefixMap in ORDER BY properties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        friends: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "foaf:name": { type: "string" },
            },
          },
        },
      },
    };

    const filterOptions = {
      include: {
        friends: {
          take: 10,
          orderBy: { "foaf:name": "asc" as const },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOptions);

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      {
        prefixMap: {
          foaf: "http://xmlns.com/foaf/0.1/",
        },
        filterOptions,
        flavour: "sparql12",
      },
    );

    const whereString = result.wherePatterns
      .map((p) => p.toString())
      .join("\n");

    expect(whereString).toContain("SELECT");
    expect(whereString).toContain("ORDER BY");
  });
});

/**
 * Pagination metadata tests for normalizedSchema2construct
 *
 * Default flavour: metadata uses _stage: "extraction" (SPARQL does not paginate
 * nested arrays; traversal applies skip/take after sorting).
 * sparql12: _stage: "query" when LATERAL SUBSELECT applies LIMIT/OFFSET.
 */

import { describe, expect, test } from "@jest/globals";
import { JSONSchema7 } from "json-schema";
import { normalizeSchema } from "@graviola/edb-graph-traversal";

import { normalizedSchema2construct } from "./normalizedSchema2construct";

describe("normalizedSchema2construct - Pagination Metadata", () => {
  test("extracts pagination from include pattern with take", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        friends: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    const filterOpts = {
      include: {
        friends: { take: 20 },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    const pagMeta = result.paginationMetadata.get("friends");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?.take).toBe(20);
    expect(pagMeta?._stage).toBe("extraction");
  });

  test("extracts pagination with both take and skip", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        posts: {
          type: "array",
          items: { type: "object", properties: { title: { type: "string" } } },
        },
      },
    };

    const filterOpts = {
      include: {
        posts: { take: 10, skip: 5 },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/user1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    const pagMeta = result.paginationMetadata.get("posts");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?.take).toBe(10);
    expect(pagMeta?.skip).toBe(5);
    expect(pagMeta?._stage).toBe("extraction");
  });

  test("does not create pagination metadata for non-paginated arrays", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    const normalized = normalizeSchema(schema, {});

    const result = normalizedSchema2construct(
      "http://example.com/doc1",
      undefined,
      normalized,
    );

    expect(result.paginationMetadata.get("tags")).toBeUndefined();
  });

  test("handles multiple paginated arrays", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        friends: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" } } },
        },
        posts: {
          type: "array",
          items: { type: "object", properties: { title: { type: "string" } } },
        },
        comments: {
          type: "array",
          items: { type: "object", properties: { text: { type: "string" } } },
        },
      },
    };

    const filterOpts = {
      include: {
        friends: { take: 10 },
        posts: { take: 20, skip: 5 },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    const friendsPag = result.paginationMetadata.get("friends");
    expect(friendsPag).toBeDefined();
    expect(friendsPag?.take).toBe(10);
    expect(friendsPag?._stage).toBe("extraction");

    const postsPag = result.paginationMetadata.get("posts");
    expect(postsPag).toBeDefined();
    expect(postsPag?.take).toBe(20);
    expect(postsPag?.skip).toBe(5);
    expect(postsPag?._stage).toBe("extraction");

    expect(result.paginationMetadata.get("comments")).toBeUndefined();
  });

  test("default flavour marks _stage as extraction (not query-stage pagination)", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    const filterOpts = {
      include: {
        items: { take: 100 },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/collection1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    expect(result.paginationMetadata.get("items")?._stage).toBe("extraction");
  });

  test("sparql12 marks _stage as query when LATERAL SUBSELECT paginates", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    const filterOpts = {
      include: {
        items: { take: 100 },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/collection1",
      undefined,
      normalized,
      { filterOptions: filterOpts, flavour: "sparql12" },
    );

    expect(result.paginationMetadata.get("items")?._stage).toBe("query");
  });

  test("pagination on nested array properties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        department: {
          type: "object",
          properties: {
            name: { type: "string" },
            employees: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" } },
              },
            },
          },
        },
      },
    };

    const filterOpts = {
      include: {
        department: {
          include: {
            employees: { take: 50 },
          },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/company1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    expect(result.paginationMetadata).toBeDefined();
  });

  test("pagination with take: 0 (fetch none)", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        logs: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    const filterOpts = {
      include: {
        logs: { take: 0 },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/system1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    const pagMeta = result.paginationMetadata.get("logs");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?.take).toBe(0);
    expect(pagMeta?._stage).toBe("extraction");
  });

  test("pagination with large skip value", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        records: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    const filterOpts = {
      include: {
        records: { skip: 1000, take: 10 },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/db1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    const pagMeta = result.paginationMetadata.get("records");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?.skip).toBe(1000);
    expect(pagMeta?.take).toBe(10);
    expect(pagMeta?._stage).toBe("extraction");
  });

  test("pagination with orderBy - single sort criterion", () => {
    const schema: JSONSchema7 = {
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

    const filterOpts = {
      include: {
        friends: {
          take: 10,
          orderBy: { name: "asc" },
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    const pagMeta = result.paginationMetadata.get("friends");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?.orderBy).toEqual({ name: "asc" });
    expect(pagMeta?.take).toBe(10);
    expect(pagMeta?._stage).toBe("extraction");
  });

  test("pagination with orderBy - multiple sort criteria", () => {
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

    const filterOpts = {
      include: {
        posts: {
          take: 20,
          orderBy: [{ createdAt: "desc" }, { title: "asc" }],
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/blog1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    const pagMeta = result.paginationMetadata.get("posts");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?.orderBy).toEqual([{ createdAt: "desc" }, { title: "asc" }]);
    expect(pagMeta?.take).toBe(20);
    expect(pagMeta?._stage).toBe("extraction");
  });

  test("pagination without orderBy - named nodes", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
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
    };

    const filterOpts = {
      include: {
        friends: {
          take: 10,
        },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/person1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    const pagMeta = result.paginationMetadata.get("friends");
    expect(pagMeta).toBeDefined();
    expect(pagMeta?.take).toBe(10);
    expect(pagMeta?.orderBy).toBeUndefined();
    expect(pagMeta?._stage).toBe("extraction");
  });

  test("pagination metadata is preserved in returned map", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { type: "number" },
        },
      },
    };

    const filterOpts = {
      include: {
        data: { take: 5, skip: 2 },
      },
    };

    const normalized = normalizeSchema(schema, filterOpts);

    const result = normalizedSchema2construct(
      "http://example.com/dataset1",
      undefined,
      normalized,
      { filterOptions: filterOpts },
    );

    expect(result.paginationMetadata).toBeInstanceOf(Map);
    expect(result.paginationMetadata.has("data")).toBe(true);
    expect(result.paginationMetadata.get("data")).toMatchObject({
      take: 5,
      skip: 2,
      _stage: "extraction",
    });
  });
});

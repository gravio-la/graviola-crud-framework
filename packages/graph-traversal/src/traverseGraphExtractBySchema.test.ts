import { describe, expect, test } from "@jest/globals";
import ds from "@rdfjs/data-model";
import datasetFactory from "@rdfjs/dataset";
import N3Parser from "@rdfjs/parser-n3";
import type { Dataset } from "@rdfjs/types";
import fs from "fs";
import type { JSONSchema7 } from "json-schema";
import { dirname, resolve } from "path";
import dsExt from "rdf-dataset-ext";
//@ts-ignore
//import * as tbbt from "tbbt-ld/dist/tbbt.nq";
import { fileURLToPath } from "url";

import { traverseGraphExtractBySchema } from "./traverseGraphExtractBySchema";

// Mimic __filename and __dirname
// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testResult01 = JSON.parse(
  fs.readFileSync(resolve(__dirname, "fixture", "test_01.json"), "utf-8"),
);

function sampleDataset() {
  const input = fs.createReadStream(
    resolve(__dirname, "..", "node_modules", "tbbt-ld", "dist", "tbbt.nq"),
  );
  const parser = new N3Parser();

  return dsExt.fromStream(datasetFactory.dataset(), parser.import(input));
}

const schemaStub = {
  $defs: {
    Address: {
      type: "object",
      properties: {
        addressCountry: {
          type: "string",
        },
        addressRegion: {
          type: "string",
        },
        postalCode: {
          type: "string",
        },
        streetAddress: {
          type: "string",
        },
      },
    },
    Person: {
      title: "Person",
      description: "A human being",
      type: "object",
      properties: {
        familyName: {
          type: "string",
        },
        givenName: {
          type: "string",
        },
        knows: {
          type: "array",
          items: {
            $ref: "#/$defs/Person",
          },
        },
        address: {
          $ref: "#/$defs/Address",
        },
      },
    },
  },
  $schema: "http://json-schema.org/draft-06/schema#",
  $id: "https://example.com/person.schema.json",
};

describe("can get data via json schema", () => {
  test("build from clownface", () => {
    expect(sampleDataset()).toBeDefined();
  });

  const baseIRI = "http://schema.org/";
  test("get from test schema", async () => {
    const schema = { ...schemaStub, ...schemaStub.$defs.Person };
    const ds = await sampleDataset();
    const data = traverseGraphExtractBySchema(
      baseIRI,
      "http://localhost:8080/data/person/leonard-hofstadter",
      ds as Dataset,
      schema as JSONSchema7,
      {
        omitEmptyArrays: true,
        omitEmptyObjects: true,
        maxRecursionEachRef: 1,
        maxRecursion: 5,
      },
    );
    //console.log(JSON.stringify(data, null, 2))
    expect(data).toStrictEqual(testResult01);
  });

  test("supports context parameter for prefixed property names", () => {
    // Create a simple dataset with multiple namespaces
    const dataset = datasetFactory.dataset();

    const subject = ds.namedNode("http://example.com/photo1");
    const dcTitle = ds.namedNode("http://purl.org/dc/elements/1.1/title");
    const dcCreator = ds.namedNode("http://purl.org/dc/elements/1.1/creator");
    const exifMake = ds.namedNode("http://www.w3.org/2003/12/exif/ns#make");
    const exifModel = ds.namedNode("http://www.w3.org/2003/12/exif/ns#model");
    const rdfType = ds.namedNode(
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );

    dataset.add(
      ds.quad(subject, rdfType, ds.namedNode("http://example.com/Image")),
    );
    dataset.add(ds.quad(subject, dcTitle, ds.literal("Sunset Photo")));
    dataset.add(ds.quad(subject, dcCreator, ds.literal("Jane Doe")));
    dataset.add(ds.quad(subject, exifMake, ds.literal("Canon")));
    dataset.add(ds.quad(subject, exifModel, ds.literal("EOS 5D")));

    // Schema using prefixed property names
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        "dc:title": { type: "string" },
        "dc:creator": { type: "string" },
        "exif:make": { type: "string" },
        "exif:model": { type: "string" },
      },
    };

    // Context for expanding prefixes
    const context = {
      dc: "http://purl.org/dc/elements/1.1/",
      exif: "http://www.w3.org/2003/12/exif/ns#",
    };

    const result = traverseGraphExtractBySchema(
      "", // Empty baseIRI since we're using prefixes
      "http://example.com/photo1",
      dataset as Dataset,
      schema,
      { omitEmptyArrays: true, omitEmptyObjects: true },
      context,
    );

    expect(result).toEqual({
      "@id": "http://example.com/photo1",
      "@type": "http://example.com/Image",
      "dc:title": "Sunset Photo",
      "dc:creator": "Jane Doe",
      "exif:make": "Canon",
      "exif:model": "EOS 5D",
    });
  });

  test("handles $ref to primitive types transparently", () => {
    const dataset = datasetFactory.dataset();
    const subject = ds.namedNode("http://example.com/garden1");
    const rdfType = ds.namedNode(
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );

    dataset.add(
      ds.quad(subject, rdfType, ds.namedNode("http://example.com/Garden")),
    );
    dataset.add(
      ds.quad(
        subject,
        ds.namedNode("http://example.com/name"),
        ds.literal("My Garden"),
      ),
    );
    dataset.add(
      ds.quad(
        subject,
        ds.namedNode("http://example.com/area"),
        ds.literal("42.5"),
      ),
    );
    dataset.add(
      ds.quad(
        subject,
        ds.namedNode("http://example.com/isPublic"),
        ds.literal("true"),
      ),
    );
    dataset.add(
      ds.quad(
        subject,
        ds.namedNode("http://example.com/plotCount"),
        ds.literal("7"),
      ),
    );
    dataset.add(
      ds.quad(
        subject,
        ds.namedNode("http://example.com/description"),
        ds.literal("A beautiful community garden"),
      ),
    );

    // Schema where all properties use $ref to primitive type definitions
    // (as Zod's toJSONSchema with reused: "ref" generates)
    const schema: JSONSchema7 = {
      type: "object",
      definitions: {
        stringDef: { type: "string" },
        numberDef: { type: "number" },
        integerDef: { type: "integer" },
        booleanDef: { type: "boolean" },
        // Chained ref: ref -> ref -> primitive
        chainedRef: { $ref: "#/definitions/stringDef" },
      },
      properties: {
        name: { $ref: "#/definitions/stringDef" },
        area: { $ref: "#/definitions/numberDef" },
        isPublic: { $ref: "#/definitions/booleanDef" },
        plotCount: { $ref: "#/definitions/integerDef" },
        description: { $ref: "#/definitions/chainedRef" },
      },
    };

    const result = traverseGraphExtractBySchema(
      "http://example.com/",
      "http://example.com/garden1",
      dataset as Dataset,
      schema,
      { omitEmptyArrays: true, omitEmptyObjects: true },
    );

    expect(result).toEqual({
      "@id": "http://example.com/garden1",
      "@type": "http://example.com/Garden",
      name: "My Garden",
      area: 42.5,
      isPublic: true,
      plotCount: 7,
      description: "A beautiful community garden",
    });
  });

  test("handles $ref to array of primitives", () => {
    const dataset = datasetFactory.dataset();
    const subject = ds.namedNode("http://example.com/garden1");
    const rdfType = ds.namedNode(
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );

    dataset.add(
      ds.quad(subject, rdfType, ds.namedNode("http://example.com/Garden")),
    );
    dataset.add(
      ds.quad(
        subject,
        ds.namedNode("http://example.com/tags"),
        ds.literal("organic"),
      ),
    );
    dataset.add(
      ds.quad(
        subject,
        ds.namedNode("http://example.com/tags"),
        ds.literal("community"),
      ),
    );

    // $ref pointing to an array definition with primitive items
    const schema: JSONSchema7 = {
      type: "object",
      definitions: {
        stringDef: { type: "string" },
        tagArray: {
          type: "array",
          items: { $ref: "#/definitions/stringDef" },
        },
      },
      properties: {
        tags: { $ref: "#/definitions/tagArray" },
      },
    };

    const result = traverseGraphExtractBySchema(
      "http://example.com/",
      "http://example.com/garden1",
      dataset as Dataset,
      schema,
      { omitEmptyArrays: true, omitEmptyObjects: true },
    );

    expect(result["@id"]).toBe("http://example.com/garden1");
    expect(result.tags).toBeDefined();
    expect(result.tags).toContain("organic");
    expect(result.tags).toContain("community");
    expect(result.tags.length).toBe(2);
  });

  test("handles $ref to array of objects (existing behavior preserved)", () => {
    const dataset = datasetFactory.dataset();
    const subject = ds.namedNode("http://example.com/garden1");
    const patch1 = ds.namedNode("http://example.com/patch1");
    const rdfType = ds.namedNode(
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );

    dataset.add(
      ds.quad(subject, rdfType, ds.namedNode("http://example.com/Garden")),
    );
    dataset.add(
      ds.quad(subject, ds.namedNode("http://example.com/patches"), patch1),
    );
    dataset.add(
      ds.quad(patch1, rdfType, ds.namedNode("http://example.com/Patch")),
    );
    dataset.add(
      ds.quad(
        patch1,
        ds.namedNode("http://example.com/name"),
        ds.literal("Tomato Bed"),
      ),
    );

    const schema: JSONSchema7 = {
      type: "object",
      definitions: {
        Patch: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
        patchArray: {
          type: "array",
          items: { $ref: "#/definitions/Patch" },
        },
      },
      properties: {
        patches: { $ref: "#/definitions/patchArray" },
      },
    };

    const result = traverseGraphExtractBySchema(
      "http://example.com/",
      "http://example.com/garden1",
      dataset as Dataset,
      schema,
      { omitEmptyArrays: true, omitEmptyObjects: true },
    );

    expect(result["@id"]).toBe("http://example.com/garden1");
    expect(result.patches).toBeDefined();
    expect(result.patches.length).toBe(1);
    expect(result.patches[0]).toEqual({
      "@id": "http://example.com/patch1",
      "@type": "http://example.com/Patch",
      name: "Tomato Bed",
    });
  });

  test("context parameter is optional and backward compatible", () => {
    // Create a simple dataset
    const dataset = datasetFactory.dataset();

    const subject = ds.namedNode("http://example.com/person1");
    const namePred = ds.namedNode("http://schema.org/name");
    const rdfType = ds.namedNode(
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );

    dataset.add(
      ds.quad(subject, rdfType, ds.namedNode("http://schema.org/Person")),
    );
    dataset.add(ds.quad(subject, namePred, ds.literal("John Doe")));

    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    };

    // Call without context parameter - should work as before
    const result = traverseGraphExtractBySchema(
      "http://schema.org/",
      "http://example.com/person1",
      dataset as Dataset,
      schema,
      { omitEmptyArrays: true, omitEmptyObjects: true },
    );

    expect(result).toEqual({
      "@id": "http://example.com/person1",
      "@type": "http://schema.org/Person",
      name: "John Doe",
    });
  });
});

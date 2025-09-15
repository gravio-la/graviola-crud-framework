import { JSONSchema7 } from "json-schema";
import {
  JSONSchemaWithInverseProperties,
  resolveInverseProperties,
} from "./inversePropertyAnnotations";
import { resolveSchema } from "./resolver";

const sampleSchema: any = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://example.com/person.schema.json",
  definitions: {
    Person: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        name: { type: "string" },
        parents: {
          type: "array",
          items: { $ref: "#/definitions/Person" },
        },
        children: {
          items: { $ref: "#/definitions/Person" },
          "x-inverseOf": {
            inverseOf: ["#/definitions/Person/properties/parents"],
          },
        },
      },
    },
  },
};

describe("Inverse Property Annotation", () => {
  it("should resolve an inverse property annotation", () => {
    expect(
      resolveInverseProperties(
        sampleSchema.definitions.Person.properties.children,
        sampleSchema,
      ),
    ).toEqual([
      {
        path: ["parents"],
        typeName: "Person",
        schema: sampleSchema.definitions.Person.properties.parents,
      },
    ]);
  });
});

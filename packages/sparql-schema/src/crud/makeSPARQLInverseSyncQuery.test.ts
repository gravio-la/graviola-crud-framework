// packages/sparql-schema/src/crud/makeSPARQLInverseSyncQuery.test.ts
import { makeSPARQLInverseSyncQuery } from "./makeSPARQLInverseSyncQuery";
import { SPARQLCRUDOptions } from "@graviola/edb-core-types";
import { InversePropertyData } from "@graviola/json-schema-utils";

describe("makeSPARQLInverseSyncQuery", () => {
  const mockOptions: SPARQLCRUDOptions = {
    defaultPrefix: "http://example.com/",
    queryBuildOptions: {
      propertyToIRI: (property: string) => `http://example.com/${property}`,
      typeIRItoTypeName: (iri: string) => iri.split("/").pop() || "",
      primaryFields: [],
      primaryFieldExtracts: [],
      prefixes: {
        ex: "http://example.com/",
      },
    },
  };

  const entityIRI = "http://example.com/person/123";

  describe("when inverseProperties array is empty", () => {
    it("should return null", () => {
      const result = makeSPARQLInverseSyncQuery(entityIRI, [], mockOptions);
      expect(result).toBeNull();
    });
  });

  describe("when inverseProperties has one item with data", () => {
    it("should generate DELETE and INSERT query for single inverse property", () => {
      const inverseProperties: InversePropertyData[] = [
        {
          path: ["subscribers"],
          typeName: "MailingList",
          schema: undefined,
          entityIRIs: [
            "http://example.com/mailinglist/tech",
            "http://example.com/mailinglist/news",
          ],
        },
      ];

      const result = makeSPARQLInverseSyncQuery(
        entityIRI,
        inverseProperties,
        mockOptions,
      );

      expect(result).not.toBeNull();
      expect(result).toContain("DELETE");
      expect(result).toContain("INSERT");
      expect(result).toContain(
        "?oldTarget_1 :subscribers <http://example.com/person/123>",
      );
      expect(result).toContain(
        "?newTarget_2 :subscribers <http://example.com/person/123>",
      );
      expect(result).toContain("VALUES ?newTarget_2");
      expect(result).toContain("<http://example.com/mailinglist/tech>");
      expect(result).toContain("<http://example.com/mailinglist/news>");
    });
  });

  describe("when inverseProperties has one item with empty data array", () => {
    it("should generate only DELETE query (no INSERT)", () => {
      const inverseProperties: InversePropertyData[] = [
        {
          path: ["subscribers"],
          typeName: "MailingList",
          schema: undefined,
          entityIRIs: [],
        },
      ];

      const result = makeSPARQLInverseSyncQuery(
        entityIRI,
        inverseProperties,
        mockOptions,
      );

      expect(result).not.toBeNull();
      expect(result).toContain("DELETE");
      expect(result).not.toContain("INSERT");
      expect(result).toContain(
        "?oldTarget_1 :subscribers <http://example.com/person/123>",
      );
      expect(result).not.toContain("VALUES");
    });
  });

  describe("when inverseProperties has two items", () => {
    it("should generate DELETE and INSERT query for multiple inverse properties", () => {
      const inverseProperties: InversePropertyData[] = [
        {
          path: ["subscribers"],
          typeName: "MailingList",
          schema: undefined,
          entityIRIs: [
            "http://example.com/mailinglist/tech",
            "http://example.com/mailinglist/news",
          ],
        },
        {
          path: ["members"],
          typeName: "WorkingCircle",
          schema: undefined,
          entityIRIs: [
            "http://example.com/workingcircle/tech",
            "http://example.com/workingcircle/events",
          ],
        },
      ];

      const result = makeSPARQLInverseSyncQuery(
        entityIRI,
        inverseProperties,
        mockOptions,
      );

      expect(result).not.toBeNull();
      expect(result).toContain("DELETE");
      expect(result).toContain("INSERT");

      // Check DELETE patterns
      expect(result).toContain(
        "?oldTarget_1 :subscribers <http://example.com/person/123>",
      );
      expect(result).toContain(
        "?oldTarget_2 :members <http://example.com/person/123>",
      );

      // Check INSERT patterns
      expect(result).toContain(
        "?newTarget_3 :subscribers <http://example.com/person/123>",
      );
      expect(result).toContain(
        "?newTarget_4 :members <http://example.com/person/123>",
      );

      // Check VALUES clauses
      expect(result).toContain("VALUES ?newTarget_3");
      expect(result).toContain("VALUES ?newTarget_4");
      expect(result).toContain("<http://example.com/mailinglist/tech>");
      expect(result).toContain("<http://example.com/workingcircle/tech>");
    });
  });

  describe("when inverseProperties has mixed empty and non-empty data", () => {
    it("should generate appropriate DELETE and INSERT patterns", () => {
      const inverseProperties: InversePropertyData[] = [
        {
          path: ["subscribers"],
          typeName: "MailingList",
          schema: undefined,
          entityIRIs: [], // Empty - should only DELETE
        },
        {
          path: ["members"],
          typeName: "WorkingCircle",
          schema: undefined,
          entityIRIs: ["http://example.com/workingcircle/tech"], // Has data - should INSERT
        },
      ];

      const result = makeSPARQLInverseSyncQuery(
        entityIRI,
        inverseProperties,
        mockOptions,
      );

      expect(result).not.toBeNull();
      expect(result).toContain("DELETE");
      expect(result).toContain("INSERT");

      // Should have DELETE for both
      expect(result).toContain(
        "?oldTarget_1 :subscribers <http://example.com/person/123>",
      );
      expect(result).toContain(
        "?oldTarget_2 :members <http://example.com/person/123>",
      );

      // Should have INSERT only for the non-empty one
      expect(result).toContain(
        "?newTarget_3 :members <http://example.com/person/123>",
      );
      expect(result).not.toContain("?newTarget_3 :subscribers");

      // Should have VALUES only for the non-empty one
      expect(result).toContain("VALUES ?newTarget_3");
      expect(result).toContain("<http://example.com/workingcircle/tech>");
    });
  });

  describe("when inverseProperties has nested property paths", () => {
    it("should handle nested property paths correctly", () => {
      const inverseProperties: InversePropertyData[] = [
        {
          path: ["parent", "children"],
          typeName: "Person",
          schema: undefined,
          entityIRIs: ["http://example.com/person/456"],
        },
      ];

      const result = makeSPARQLInverseSyncQuery(
        entityIRI,
        inverseProperties,
        mockOptions,
      );

      expect(result).not.toBeNull();
      expect(result).toContain(
        "?oldTarget_1 :parent/:children <http://example.com/person/123>",
      );
      expect(result).toContain(
        "?newTarget_2 :parent/:children <http://example.com/person/123>",
      );
    });
  });
});

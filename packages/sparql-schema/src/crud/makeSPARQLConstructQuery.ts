import { SPARQLCRUDOptions } from "@graviola/edb-core-types";
import df from "@rdfjs/data-model";
import { CONSTRUCT } from "@tpluscode/sparql-builder";

import {
  makeSPARQLWherePart,
  withDefaultPrefix,
} from "@/crud/makeSPARQLWherePart";
import { jsonSchema2construct } from "@/schema2sparql/jsonSchema2construct";
import { JSONSchemaWithInverseProperties } from "@graviola/json-schema-utils";

export const makeSPARQLConstructQuery = (
  entityIRI: string,
  typeIRI: string | undefined,
  schema: JSONSchemaWithInverseProperties,
  options: SPARQLCRUDOptions,
) => {
  const { defaultPrefix, queryBuildOptions, maxRecursion } = options;
  const subjectV = df.variable("subject");
  const wherePart = makeSPARQLWherePart(entityIRI, typeIRI, subjectV);
  const { construct, whereRequired, whereOptionals } = jsonSchema2construct(
    subjectV,
    schema,
    [],
    ["@id", "@type"],
    maxRecursion,
  );
  if (wherePart + whereRequired + whereOptionals === "") {
    throw new Error("makeSPARQLConstructQuery:empty WHERE clause");
  }
  return withDefaultPrefix(
    defaultPrefix,
    CONSTRUCT` ${construct} `
      .WHERE`${wherePart} ${whereRequired}\n${whereOptionals}`.build(
      queryBuildOptions,
    ),
  );
};

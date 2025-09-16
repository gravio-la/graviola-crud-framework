import { SPARQLCRUDOptions } from "@graviola/edb-core-types";
import { DELETE } from "@tpluscode/sparql-builder";
import { JSONSchema7 } from "json-schema";

import {
  makeSPARQLWherePart,
  buildQueryWithPrefixAndGraph,
} from "@/crud/makeSPARQLWherePart";
import { jsonSchema2construct } from "@/schema2sparql/jsonSchema2construct";

export const makeSPARQLDeleteQuery = (
  entityIRI: string,
  typeIRI: string | undefined,
  schema: JSONSchema7,
  options: SPARQLCRUDOptions,
) => {
  const { defaultPrefix, queryBuildOptions } = options;
  const wherePart = typeIRI
    ? makeSPARQLWherePart(entityIRI, typeIRI, "?subject", {
        flavour: options.queryBuildOptions?.sparqlFlavour,
      })
    : "";
  const { construct, whereRequired, whereOptionals } = jsonSchema2construct(
    entityIRI,
    schema,
    ["@id"],
    ["@id", "@type"],
  );
  const deleteQuery = DELETE` ${construct} `
    .WHERE`${wherePart} ${whereRequired}\n${whereOptionals}`;

  return buildQueryWithPrefixAndGraph(
    defaultPrefix,
    options.defaultUpdateGraph,
    deleteQuery,
    queryBuildOptions,
    options.queryBuildOptions?.sparqlFlavour,
  );
};

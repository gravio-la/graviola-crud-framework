import { SPARQLCRUDOptions } from "@graviola/edb-core-types";
import { DELETE } from "@tpluscode/sparql-builder";
import { JSONSchema7 } from "json-schema";

import {
  makeSPARQLWherePart,
  buildQueryWithPrefixAndGraph,
} from "@/crud/makeSPARQLWherePart";

export const makeSPARQLRestoreFromTrashQuery = (
  entityIRI: string | string[],
  typeIRI: string,
  schema: JSONSchema7,
  options: SPARQLCRUDOptions,
) => {
  const s = "?subject";
  const typeIRIWithTrash = typeIRI + "_trash";
  const wherePart = makeSPARQLWherePart(entityIRI, typeIRIWithTrash, s, {
    flavour: options.queryBuildOptions?.sparqlFlavour,
  });
  const deleteInsertQuery = DELETE` ${s} a ?class_trash `
    .INSERT` ${s} a <${typeIRI}> `.WHERE`
    ${wherePart}
    `;

  return buildQueryWithPrefixAndGraph(
    options.defaultPrefix,
    options.defaultUpdateGraph,
    deleteInsertQuery,
    options.queryBuildOptions,
    options.queryBuildOptions?.sparqlFlavour,
  );
};

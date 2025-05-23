import { SPARQLCRUDOptions } from "@graviola/edb-core-types";
import { JSONSchema7 } from "json-schema";

import { makeSPARQLDeleteQuery } from "@/crud/makeSPARQLDeleteQuery";

export const remove = async (
  entityIRI: string,
  typeIRI: string | undefined,
  schema: JSONSchema7,
  deleteFetch: (query: string) => Promise<any>,
  options: SPARQLCRUDOptions,
) => {
  const deleteQuery = makeSPARQLDeleteQuery(
    entityIRI,
    typeIRI,
    schema,
    options,
  );
  return await deleteFetch(deleteQuery);
};

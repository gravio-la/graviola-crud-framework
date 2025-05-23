import { PrimaryField, SPARQLCRUDOptions } from "@graviola/edb-core-types";

import { basicFieldsQuery } from "@/crud/basicFieldsQuery";

export const loadEntityBasics = async (
  entityIRI: string,
  typeIRI: string,
  selectFetch: (query: string) => Promise<any>,
  options: SPARQLCRUDOptions,
): Promise<PrimaryField> => {
  const { queryBuildOptions } = options;
  const query = basicFieldsQuery(entityIRI, typeIRI, queryBuildOptions);
  const results = await selectFetch(query);
  const bindings = results[0];
  return {
    label: "",
    description: "",
    image: "",
    ...Object.fromEntries(
      ["label", "description", "image"]
        .map((key) => [key, bindings[key]?.value])
        .filter(([, value]) => typeof value === "string"),
    ),
  } as PrimaryField;
};

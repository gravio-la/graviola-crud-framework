import {
  NamedAndTypedEntity,
  SPARQLCRUDOptions,
} from "@graviola/edb-core-types";
import {
  dataset2NTriples,
  jsonld2DataSet,
  removeInversePropertiesFromSchema,
} from "@graviola/jsonld-utils";
import { DELETE, INSERT } from "@tpluscode/sparql-builder";
import { JSONSchema7 } from "json-schema";

import { makeSPARQLWherePart, withDefaultPrefix } from "@/crud";
import { jsonSchema2construct } from "@/schema2sparql";

type SaveOptions = SPARQLCRUDOptions & {
  skipRemove?: boolean;
};
export const save = async (
  dataToBeSaved: NamedAndTypedEntity,
  schema: JSONSchema7,
  updateFetch: (query: string) => Promise<any>,
  options: SaveOptions,
) => {
  const { skipRemove, queryBuildOptions, defaultPrefix } = options;
  const entityIRI = dataToBeSaved["@id"];
  const typeIRI = dataToBeSaved["@type"];
  const ds = await jsonld2DataSet(dataToBeSaved);
  const ntriples = await dataset2NTriples(ds);
  const cleanSchema = removeInversePropertiesFromSchema(schema);

  if (skipRemove) {
    const insertQuery = withDefaultPrefix(
      defaultPrefix,
      INSERT.DATA` ${ntriples} `.build(queryBuildOptions),
    );
    return await updateFetch(insertQuery);
  }

  // Get the construct and where parts needed for the DELETE operation
  const { construct, whereRequired, whereOptionals } = jsonSchema2construct(
    entityIRI,
    cleanSchema,
    ["@id"],
    ["@id", "@type"],
  );

  // Combined DELETE and INSERT in one atomic operation
  const deleteInsertQuery = withDefaultPrefix(
    defaultPrefix,
    DELETE` ${construct} `.INSERT` ${ntriples} `
      .WHERE`OPTIONAL { ${makeSPARQLWherePart(entityIRI, typeIRI)} ${whereRequired}\n${whereOptionals} }`.build(
      queryBuildOptions,
    ),
  );

  try {
    return await updateFetch(deleteInsertQuery);
  } catch (e) {
    throw new Error("Failed to save data - DELETE/INSERT operation failed", {
      cause: e,
    });
  }
};

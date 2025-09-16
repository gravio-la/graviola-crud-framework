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

import {
  makeSPARQLWherePart,
  buildQueryWithPrefixAndGraph,
  withDefaultPrefix,
} from "@/crud";
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
    // For INSERT DATA, we need to handle it differently since it doesn't support WITH clause
    // We'll use the string-based approach for this specific case
    let insertQuery = INSERT.DATA` ${ntriples} `.build(queryBuildOptions);

    // Add WITH clause manually if defaultUpdateGraph is provided
    if (options.defaultUpdateGraph) {
      insertQuery = `WITH <${options.defaultUpdateGraph}>\n${insertQuery}`;
    }

    // Apply prefix
    const builtQuery = withDefaultPrefix(defaultPrefix, insertQuery);
    return await updateFetch(builtQuery);
  }

  // Get the construct and where parts needed for the DELETE operation
  const { construct, whereRequired, whereOptionals } = jsonSchema2construct(
    entityIRI,
    cleanSchema,
    ["@id"],
    ["@id", "@type"],
  );

  // Combined DELETE and INSERT in one atomic operation
  const deleteInsertQuery = DELETE` ${construct} `.INSERT` ${ntriples} `
    .WHERE`OPTIONAL { ${makeSPARQLWherePart(entityIRI, typeIRI, "?subject", { flavour: options.queryBuildOptions?.sparqlFlavour })} ${whereRequired}\n${whereOptionals} }`;

  const builtQuery = buildQueryWithPrefixAndGraph(
    defaultPrefix,
    options.defaultUpdateGraph,
    deleteInsertQuery,
    queryBuildOptions,
    options.queryBuildOptions?.sparqlFlavour,
  );

  try {
    return await updateFetch(builtQuery);
  } catch (e) {
    throw new Error("Failed to save data - DELETE/INSERT operation failed", {
      cause: e,
    });
  }
};

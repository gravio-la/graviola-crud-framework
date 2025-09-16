import { SPARQLCRUDOptions } from "@graviola/edb-core-types";
import { buildQueryWithPrefixAndGraph } from "./makeSPARQLWherePart";
import { DELETE } from "@tpluscode/sparql-builder";
import { InversePropertyData } from "@graviola/json-schema-utils";
import { sparql } from "@tpluscode/rdf-string";

const makePrefixed = (key: string) => (key.includes(":") ? key : `:${key}`);
const makePrefixedProperyPath = (path: string[]) =>
  path.map((key) => makePrefixed(key)).join("/");

// Global counter for unique variable names
let globalVarCounter = 0;
const getUniqueVar = (prefix: string) => `?${prefix}_${++globalVarCounter}`;

export type InversePropertyDataWithTypeIRI = InversePropertyData & {
  typeIRI: string;
};

export const makeSPARQLInverseSyncQuery: (
  entityIRI: string,
  inverseProperties: InversePropertyDataWithTypeIRI[],
  options: SPARQLCRUDOptions,
) => string | null = (
  entityIRI: string,
  inverseProperties: InversePropertyDataWithTypeIRI[],
  options: SPARQLCRUDOptions,
) => {
  const { defaultPrefix, queryBuildOptions } = options;

  // Return null if no inverse properties to sync
  if (inverseProperties.length === 0) {
    return null;
  }

  // Reset global counter for each query generation
  globalVarCounter = 0;

  // Build DELETE and INSERT patterns using sparql template literals
  const deletePatterns: string[] = [];
  const insertPatterns: string[] = [];
  const whereParts: string[] = [];

  for (const inverseProp of inverseProperties) {
    const targetPropertyPath = makePrefixedProperyPath(inverseProp.path);
    const oldTargetVar = getUniqueVar("oldTarget");
    const newTargetVar = getUniqueVar("newTarget");
    const targetTypeIRI = inverseProp.typeIRI;

    // DELETE pattern: Remove entity from all current targets
    deletePatterns.push(
      `${oldTargetVar} ${targetPropertyPath} <${entityIRI}> .`,
    );

    // INSERT pattern: Add entity to new targets (only if there are targets)
    if (inverseProp.entityIRIs.length > 0) {
      insertPatterns.push(
        `${newTargetVar} ${targetPropertyPath} <${entityIRI}> .`,
      );
    }

    // WHERE part for finding existing targets to delete
    whereParts.push(`{
      # Find existing targets to delete
      ${oldTargetVar} a <${targetTypeIRI}> ;
        ${targetPropertyPath} <${entityIRI}> .
    } UNION {
      # If no existing targets, bind to a dummy value to ensure variable is bound
      BIND(<http://dummy> AS ${oldTargetVar})
    }`);

    // Define new targets to add (only if there are targets)
    if (inverseProp.entityIRIs.length > 0) {
      const valuesClause = inverseProp.entityIRIs
        .map((iri) => `<${iri}>`)
        .join("\n    ");
      whereParts.push(`VALUES ${newTargetVar} {\n    ${valuesClause}\n  }`);
    }
  }

  // Build the complete DELETE/INSERT query using sparql-builder
  const deleteClause = deletePatterns.join("\n  ");
  const insertClause = insertPatterns.join("\n  ");
  const whereClause = whereParts.join("\n  ");

  // Create the query based on whether we have INSERT patterns
  let query;
  if (insertPatterns.length === 0) {
    // Only DELETE
    query = DELETE`${sparql`${deleteClause}`}`.WHERE`${sparql`${whereClause}`}`;
  } else {
    // DELETE and INSERT
    query = DELETE`${sparql`${deleteClause}`}`
      .INSERT`${sparql`${insertClause}`}`.WHERE`${sparql`${whereClause}`}`;
  }

  return buildQueryWithPrefixAndGraph(
    defaultPrefix,
    options.defaultUpdateGraph,
    query,
    queryBuildOptions,
    options.queryBuildOptions?.sparqlFlavour,
  );
};

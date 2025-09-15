import { SPARQLCRUDOptions } from "@graviola/edb-core-types";
import { withDefaultPrefix } from "./index";
import { InversePropertyData } from "@graviola/json-schema-utils";

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

  const deletePatterns: string[] = [];
  const insertPatterns: string[] = [];
  const whereClauses: string[] = [];

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

    // WHERE clauses
    // Find all current targets to delete - use UNION to handle both existing and non-existing cases
    whereClauses.push(`{
      # Find existing targets to delete
      ${oldTargetVar} a <${targetTypeIRI}>; 
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
      whereClauses.push(`VALUES ${newTargetVar} {\n    ${valuesClause}\n  }`);
    }
  }

  // Build the complete query
  const deleteClause =
    deletePatterns.length > 0
      ? `DELETE {\n  ${deletePatterns.join("\n  ")}\n}`
      : "";
  const insertClause =
    insertPatterns.length > 0
      ? `INSERT {\n  ${insertPatterns.join("\n  ")}\n}`
      : "";
  const whereClause =
    whereClauses.length > 0 ? `WHERE {\n  ${whereClauses.join("\n  ")}\n}` : "";

  // If no INSERT patterns, we only need DELETE
  if (insertPatterns.length === 0) {
    const query = `${deleteClause}\n${whereClause}`;
    return withDefaultPrefix(defaultPrefix, query);
  }

  // Full DELETE/INSERT query
  const query = `${deleteClause}\n${insertClause}\n${whereClause}`;
  return withDefaultPrefix(defaultPrefix, query);
};

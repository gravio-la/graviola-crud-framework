import { Variable } from "@rdfjs/types";
import { SPARQLFlavour } from "@graviola/edb-core-types";
import { WITH } from "@tpluscode/sparql-builder";
import type { DeleteInsertQuery } from "@tpluscode/sparql-builder/lib/DeleteBuilder.js";
import type { InsertQuery } from "@tpluscode/sparql-builder/lib/InsertBuilder.js";

type SPARQLWherePartOptions = {
  useBind?: boolean;
  flavour?: SPARQLFlavour;
};

export const makeSPARQLWherePart = (
  entityIRI: string | string[],
  typeIRI: string,
  subject: string | Variable = "?subject",
  options?: SPARQLWherePartOptions,
) => {
  const s = typeof subject === "string" ? subject : `?${subject.value}`;
  const entityIRIList = Array.isArray(entityIRI) ? entityIRI : [entityIRI];
  if (entityIRIList.length === 0) {
    throw new Error("entityIRIList is empty, would result in invalid SPARQL");
  }
  // Determine whether to use BIND or VALUES based on flavour and options
  const shouldUseBind = options?.useBind ?? options?.flavour === "oxigraph";

  if (entityIRIList.length === 1 && shouldUseBind) {
    // Use BIND for single entity IRI (better performance for Oxigraph)
    const entityIRIValue = `<${entityIRIList[0]}>`;
    return typeIRI
      ? ` BIND(${entityIRIValue} AS ${s}) . ${s} a <${typeIRI}> . `
      : ` BIND(${entityIRIValue} AS ${s}) . ${s} a ?type . `;
  } else {
    // Use VALUES for multiple entity IRIs or when flavour is not oxigraph
    // VALUES avoids SP031 error in Virtuoso and works well for all implementations
    const entityIRIValueString = `<${entityIRIList.join("> <")}>`;
    return typeIRI
      ? ` VALUES ${s} { ${entityIRIValueString} } ${s} a <${typeIRI}> . `
      : ` VALUES ${s} { ${entityIRIValueString} } ${s} a ?type . `;
  }
};

export const withDefaultPrefix = (
  prefix: string | null | undefined,
  query: string,
) => {
  if (!prefix) {
    return query;
  }
  // Find if there's a BASE declaration at the start of the query
  const baseRegex = /^\s*BASE\s+<[^>]+>\s*/i;
  const match = query.match(baseRegex);
  if (match) {
    // Insert PREFIX after BASE
    const baseDecl = match[0];
    const rest = query.slice(baseDecl.length);
    return `${baseDecl}\nPREFIX : <${prefix}>\n\n${rest}`;
  } else {
    // No BASE, PREFIX goes at the top
    return `PREFIX : <${prefix}>\n\n${query}`;
  }
};

export const withGraph = (
  defaultUpdateGraph: string | null | undefined,
  query: DeleteInsertQuery | InsertQuery,
) => {
  if (!defaultUpdateGraph) {
    return query;
  }
  return WITH(defaultUpdateGraph, query);
};

export const buildQueryWithPrefixAndGraph = (
  defaultPrefix: string | null | undefined,
  defaultUpdateGraph: string | null | undefined,
  query: DeleteInsertQuery | InsertQuery,
  queryBuildOptions?: any,
  flavour?: SPARQLFlavour,
) => {
  // Apply graph wrapper first if needed
  const wrappedQuery = withGraph(defaultUpdateGraph, query);

  // Build the query string
  const builtQuery = wrappedQuery.build(queryBuildOptions);

  // Apply prefix
  return withDefaultPrefix(defaultPrefix, builtQuery);
};

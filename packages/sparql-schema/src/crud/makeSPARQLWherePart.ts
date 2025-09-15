import { Variable } from "@rdfjs/types";

export const makeSPARQLWherePart = (
  entityIRI: string | string[],
  typeIRI: string,
  subject: string | Variable = "?subject",
) => {
  const s = typeof subject === "string" ? subject : `?${subject.value}`;
  const entityIRIList = Array.isArray(entityIRI) ? entityIRI : [entityIRI];
  if (entityIRIList.length === 0) {
    throw new Error("entityIRIList is empty, would result in invalid SPARQL");
  }
  if (entityIRIList.length === 1) {
    // Use BIND for single entity IRI for better performance
    const entityIRIValue = `<${entityIRIList[0]}>`;
    return typeIRI
      ? ` BIND(${entityIRIValue} AS ${s}) . ${s} a <${typeIRI}> . `
      : ` BIND(${entityIRIValue} AS ${s}) . ${s} a ?type . `;
  } else {
    // Use VALUES for multiple entity IRIs
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

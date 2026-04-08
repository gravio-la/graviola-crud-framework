/**
 * Logical filter operators for SPARQL
 * Implements: AND, OR, NOT
 */

import { sparql } from "@tpluscode/sparql-builder";
import type { SparqlTemplateResult } from "@tpluscode/sparql-builder";
import df from "@rdfjs/data-model";
import type { FilterContext, FilterResult } from "../types";
import { filterToSparql } from "../filterToSparql";
import { convertIRIToNode } from "../../utils/iriConverter";

/**
 * Sanitize variable name (remove special characters)
 */
function sanitizeVariableName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Create a predicate node from a property name
 */
function createPredicateNode(
  propertyName: string,
  prefixMap: Record<string, string>,
): any {
  const defaultPrefix = prefixMap[""] || "";
  if (defaultPrefix) {
    return convertIRIToNode(defaultPrefix + propertyName, prefixMap);
  }
  return df.namedNode(propertyName);
}

/**
 * Process a multi-property filter (e.g., { price: { gte: 10 }, name: { contains: "x" } })
 * by iterating over properties and calling filterToSparql for each
 */
function processMultiPropertyFilter(
  filter: Record<string, any>,
  baseContext: FilterContext,
): FilterResult {
  const result: FilterResult = { patterns: [], filters: [], optional: false };

  // Check if this is actually a single-property operator-only filter
  const keys = Object.keys(filter);
  const operatorKeys = [
    "equals",
    "not",
    "in",
    "notIn",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "startsWith",
    "endsWith",
    "some",
    "every",
    "none",
    "AND",
    "OR",
    "NOT",
    "mode",
  ];

  // If all keys are operators, this is a single-property filter
  if (keys.every((k) => operatorKeys.includes(k))) {
    return filterToSparql(filter, baseContext);
  }

  // Multi-property filter - iterate over properties
  // Extract schema properties if available
  const schemaProps =
    baseContext.schema &&
    typeof baseContext.schema === "object" &&
    "properties" in baseContext.schema
      ? (baseContext.schema.properties as Record<string, any>)
      : {};

  for (const [propertyName, propertyFilter] of Object.entries(filter)) {
    // Skip logical operators at this level (they should be handled recursively)
    if (["AND", "OR", "NOT"].includes(propertyName)) {
      const logicalResult = filterToSparql(
        { [propertyName]: propertyFilter },
        baseContext,
      );
      result.patterns.push(...logicalResult.patterns);
      result.filters.push(...logicalResult.filters);
      continue;
    }

    // Look up schema type for this property
    const propSchema = schemaProps[propertyName];
    const propSchemaType =
      propSchema && typeof propSchema === "object" && "type" in propSchema
        ? (propSchema.type as string)
        : undefined;

    // Create proper predicate and variable for this property
    const predicateNode = createPredicateNode(
      propertyName,
      baseContext.prefixMap,
    );
    const propertyVar = df.variable(sanitizeVariableName(propertyName));

    // Create context for this specific property with proper predicate and variable
    const propertyContext: FilterContext = {
      ...baseContext,
      property: propertyName,
      propertyVar,
      predicateNode,
      schemaType: propSchemaType,
    };

    const propResult = filterToSparql(propertyFilter, propertyContext);
    result.patterns.push(...propResult.patterns);
    result.filters.push(...propResult.filters);
    result.optional = result.optional || propResult.optional;
  }

  return result;
}

/**
 * AND: Multiple conditions (implicit in SPARQL - just add all patterns)
 * { AND: [{ age: { gte: 18 } }, { verified: true }] }
 * => Combine all patterns and filters
 */
function applyAndOperator(
  conditions: any[],
  context: FilterContext,
): FilterResult {
  const result: FilterResult = { patterns: [], filters: [], optional: false };

  for (const condition of conditions) {
    const condResult = processMultiPropertyFilter(condition, context);
    result.patterns.push(...condResult.patterns);
    result.filters.push(...condResult.filters);
  }

  return result;
}

/**
 * OR: Use UNION pattern for multiple conditions
 * { OR: [{ price: { lte: 25 } }, { name: { contains: "Lap" } }] }
 * => { ?subject :price ?price . FILTER(?price <= 25) }
 *    UNION
 *    { ?subject :name ?name . FILTER(CONTAINS(?name, "Lap")) }
 */
function applyOrOperator(
  conditions: any[],
  context: FilterContext,
): FilterResult {
  const results = conditions.map((c) => processMultiPropertyFilter(c, context));

  // OR requires UNION in SPARQL for proper disjunction semantics
  // Build: { patterns1 filters1 } UNION { patterns2 filters2 } UNION ...
  const unionBlocks: SparqlTemplateResult[] = [];

  for (const condResult of results) {
    const blockParts = [...condResult.patterns, ...condResult.filters];
    if (blockParts.length > 0) {
      // Each block is wrapped in { }
      const block = sparql`{ ${blockParts} }`;
      unionBlocks.push(block);
    }
  }

  if (unionBlocks.length === 0) {
    return { patterns: [], filters: [], optional: false };
  }

  // Join blocks with UNION
  const unionPattern = sparql`${unionBlocks.map((b, i) =>
    i === 0 ? b : sparql`UNION ${b}`,
  )}`;

  return {
    patterns: [unionPattern],
    filters: [],
    optional: false,
  };
}

/**
 * NOT: Use FILTER NOT EXISTS
 * { NOT: { email: { endsWith: "spam.com" } } }
 * => FILTER NOT EXISTS { ?person :email ?email . FILTER(STRENDS(?email, "spam.com")) }
 */
function applyNotOperator(
  condition: any,
  context: FilterContext,
): FilterResult {
  const condResult = processMultiPropertyFilter(condition, context);

  // Wrap in FILTER NOT EXISTS
  const notExistsPattern = sparql`FILTER NOT EXISTS { ${condResult.patterns} ${condResult.filters} }`;

  return {
    patterns: [notExistsPattern],
    filters: [],
    optional: false,
  };
}

/**
 * Dispatch to appropriate logical operator
 */
export function applyLogicalOperator(
  operator: "AND" | "OR" | "NOT",
  value: any,
  context: FilterContext,
): FilterResult {
  const conditions = Array.isArray(value) ? value : [value];

  switch (operator) {
    case "AND":
      return applyAndOperator(conditions, context);
    case "OR":
      return applyOrOperator(conditions, context);
    case "NOT":
      return applyNotOperator(conditions[0], context);
  }
}

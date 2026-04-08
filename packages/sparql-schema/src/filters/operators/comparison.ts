/**
 * Comparison filter operators for SPARQL
 * Implements: equals, not, in, notIn
 */

import { sparql } from "@tpluscode/sparql-builder";
import df from "@rdfjs/data-model";
import type { FilterContext, FilterResult } from "../types";
import { convertIRIToNode } from "../../utils/iriConverter";
import { inferDatatype } from "../utils/datatype";

/**
 * Check if value is a node reference (object with @id property)
 */
function isNodeReference(value: any): value is { "@id": string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "@id" in value &&
    typeof value["@id"] === "string"
  );
}

/**
 * equals: Most efficient - use direct triple pattern
 * { age: { equals: 25 } } => ?person :age 25 .
 * { knows: { equals: { '@id': 'http://example.com/friend' } } } => ?person :knows <http://example.com/friend> .
 */
export function applyEqualsOperator(
  value: any,
  context: FilterContext,
): FilterResult {
  const { subject, predicateNode, prefixMap, schemaType } = context;

  // Check if value is a node reference (object with @id)
  if (isNodeReference(value)) {
    // Convert IRI to proper node (handles prefixes, full IRIs, etc.)
    const nodeValue = convertIRIToNode(value["@id"], prefixMap);

    return {
      patterns: [sparql`${subject} ${predicateNode} ${nodeValue} .`],
      filters: [],
      optional: false, // Required pattern
    };
  }

  // Regular literal value - use proper datatype inference
  const literalNode = inferDatatype(value, schemaType);

  return {
    patterns: [sparql`${subject} ${predicateNode} ${literalNode} .`],
    filters: [],
    optional: false, // Required pattern
  };
}

/**
 * not: Use FILTER with !=
 * { age: { not: 25 } } => ?person :age ?age . FILTER(?age != 25)
 * { knows: { not: { '@id': 'http://example.com/blocked' } } } => ?person :knows ?knows . FILTER(?knows != <http://example.com/blocked>)
 */
export function applyNotOperator(
  value: any,
  context: FilterContext,
): FilterResult {
  const { subject, predicateNode, propertyVar, prefixMap, schemaType } =
    context;

  // Check if value is a node reference (object with @id)
  if (isNodeReference(value)) {
    // Convert IRI to proper node (handles prefixes, full IRIs, etc.)
    const nodeValue = convertIRIToNode(value["@id"], prefixMap);

    return {
      patterns: [sparql`${subject} ${predicateNode} ${propertyVar} .`],
      filters: [sparql`FILTER(${propertyVar} != ${nodeValue})`],
      optional: false,
    };
  }

  return {
    patterns: [sparql`${subject} ${predicateNode} ${propertyVar} .`],
    filters: [
      sparql`FILTER(${propertyVar} != ${inferDatatype(value, schemaType)})`,
    ],
    optional: false,
  };
}

/**
 * in: Use VALUES clause (most efficient for SPARQL)
 * { status: { in: ["active", "pending"] } }
 * => VALUES ?status { "active" "pending" }
 *    ?person :status ?status .
 * { knows: { in: [{ '@id': 'http://ex.com/p1' }, { '@id': 'http://ex.com/p2' }] } }
 * => VALUES ?knows { <http://ex.com/p1> <http://ex.com/p2> }
 *    ?person :knows ?knows .
 */
export function applyInOperator(
  values: any[],
  context: FilterContext,
): FilterResult {
  const { subject, predicateNode, propertyVar, prefixMap, schemaType } =
    context;

  // Build VALUES clause - handle both literals and node references
  const valuesList = values.map((v) => {
    if (isNodeReference(v)) {
      return convertIRIToNode(v["@id"], prefixMap);
    }
    return inferDatatype(v, schemaType);
  });
  const valuesPattern = sparql`VALUES ${propertyVar} { ${valuesList} }`;
  const triplePattern = sparql`${subject} ${predicateNode} ${propertyVar} .`;

  return {
    patterns: [valuesPattern, triplePattern],
    filters: [],
    optional: false,
  };
}

/**
 * notIn: Use FILTER with NOT IN
 * { status: { notIn: ["deleted", "banned"] } }
 * => ?person :status ?status . FILTER(?status NOT IN ("deleted", "banned"))
 * { knows: { notIn: [{ '@id': 'http://ex.com/blocked' }] } }
 * => ?person :knows ?knows . FILTER(?knows NOT IN (<http://ex.com/blocked>))
 */
export function applyNotInOperator(
  values: any[],
  context: FilterContext,
): FilterResult {
  const { subject, predicateNode, propertyVar, prefixMap, schemaType } =
    context;

  // Handle both literals and node references
  const valuesList = values.map((v) => {
    if (isNodeReference(v)) {
      return convertIRIToNode(v["@id"], prefixMap);
    }
    return inferDatatype(v, schemaType);
  });

  return {
    patterns: [sparql`${subject} ${predicateNode} ${propertyVar} .`],
    filters: [sparql`FILTER(${propertyVar} NOT IN (${valuesList}))`],
    optional: false,
  };
}

/**
 * Dispatch to appropriate comparison operator
 */
export function applyComparisonOperator(
  operator: "equals" | "not" | "in" | "notIn",
  value: any,
  context: FilterContext,
): FilterResult {
  switch (operator) {
    case "equals":
      return applyEqualsOperator(value, context);
    case "not":
      return applyNotOperator(value, context);
    case "in":
      return applyInOperator(value, context);
    case "notIn":
      return applyNotInOperator(value, context);
  }
}

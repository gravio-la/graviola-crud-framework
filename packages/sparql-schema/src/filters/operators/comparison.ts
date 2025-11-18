/**
 * Comparison filter operators for SPARQL
 * Implements: equals, not, in, notIn
 */

import { sparql } from "@tpluscode/sparql-builder";
import df from "@rdfjs/data-model";
import type { FilterContext, FilterResult } from "../types";

/**
 * equals: Most efficient - use direct triple pattern
 * { age: { equals: 25 } } => ?person :age 25 .
 */
export function applyEqualsOperator(
  value: any,
  context: FilterContext
): FilterResult {
  const { subject, predicateNode } = context;
  const literalNode = df.literal(String(value)); // TODO: proper datatype inference
  
  return {
    patterns: [sparql`${subject} ${predicateNode} ${literalNode} .`],
    filters: [],
    optional: false, // Required pattern
  };
}

/**
 * not: Use FILTER with !=
 * { age: { not: 25 } } => ?person :age ?age . FILTER(?age != 25)
 */
export function applyNotOperator(
  value: any,
  context: FilterContext
): FilterResult {
  const { subject, predicateNode, propertyVar } = context;
  
  return {
    patterns: [sparql`${subject} ${predicateNode} ${propertyVar} .`],
    filters: [sparql`FILTER(${propertyVar} != ${df.literal(String(value))})`],
    optional: false,
  };
}

/**
 * in: Use VALUES clause (most efficient for SPARQL)
 * { status: { in: ["active", "pending"] } }
 * => VALUES ?status { "active" "pending" }
 *    ?person :status ?status .
 */
export function applyInOperator(
  values: any[],
  context: FilterContext
): FilterResult {
  const { subject, predicateNode, propertyVar } = context;
  
  // Build VALUES clause
  const valuesList = values.map(v => df.literal(String(v)));
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
 */
export function applyNotInOperator(
  values: any[],
  context: FilterContext
): FilterResult {
  const { subject, predicateNode, propertyVar } = context;
  const valuesList = values.map(v => df.literal(String(v)));
  
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
  operator: 'equals' | 'not' | 'in' | 'notIn',
  value: any,
  context: FilterContext
): FilterResult {
  switch (operator) {
    case 'equals':
      return applyEqualsOperator(value, context);
    case 'not':
      return applyNotOperator(value, context);
    case 'in':
      return applyInOperator(value, context);
    case 'notIn':
      return applyNotInOperator(value, context);
  }
}

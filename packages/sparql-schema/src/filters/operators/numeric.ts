/**
 * Numeric filter operators for SPARQL
 * Implements: gt, gte, lt, lte
 */

import { sparql } from "@tpluscode/sparql-builder";
import df from "@rdfjs/data-model";
import type { FilterContext, FilterResult } from "../types";

/**
 * Numeric comparison operators: gt, gte, lt, lte
 * { age: { gte: 18 } } => ?person :age ?age . FILTER(?age >= 18)
 */
export function applyNumericOperator(
  operator: 'gt' | 'gte' | 'lt' | 'lte',
  value: number,
  context: FilterContext
): FilterResult {
  const { subject, predicateNode, propertyVar } = context;
  
  const opSymbol = {
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
  }[operator];
  
  return {
    patterns: [sparql`${subject} ${predicateNode} ${propertyVar} .`],
    filters: [sparql`FILTER(${propertyVar} ${opSymbol} ${df.literal(String(value), df.namedNode('http://www.w3.org/2001/XMLSchema#integer'))})`],
    optional: false,
  };
}

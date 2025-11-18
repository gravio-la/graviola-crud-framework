/**
 * String filter operators for SPARQL
 * Phase 1: Minimal implementation for contains, startsWith, endsWith
 */

import { sparql } from "@tpluscode/sparql-builder";
import df from "@rdfjs/data-model";
import type { FilterContext, FilterResult } from "../types";

/**
 * String operators: contains, startsWith, endsWith
 * Supports case-sensitive (default) and case-insensitive (mode: 'insensitive')
 */
export function applyStringOperator(
  operator: 'contains' | 'startsWith' | 'endsWith',
  value: string,
  mode: 'default' | 'insensitive' = 'default',
  context: FilterContext
): FilterResult {
  const { subject, predicateNode, propertyVar } = context;
  
  let filterExpr: any;
  const valueLiteral = df.literal(value);
  
  if (mode === 'insensitive') {
    // Use REGEX with 'i' flag for case-insensitive
    const pattern = operator === 'contains' ? value :
                    operator === 'startsWith' ? `^${value}` :
                    `${value}$`;
    filterExpr = sparql`FILTER(REGEX(${propertyVar}, ${df.literal(pattern)}, "i"))`;
  } else {
    // Use SPARQL string functions (faster)
    const func = operator === 'contains' ? 'CONTAINS' :
                 operator === 'startsWith' ? 'STRSTARTS' :
                 'STRENDS';
    filterExpr = sparql`FILTER(${func}(${propertyVar}, ${valueLiteral}))`;
  }
  
  return {
    patterns: [sparql`${subject} ${predicateNode} ${propertyVar} .`],
    filters: [filterExpr],
    optional: false,
  };
}

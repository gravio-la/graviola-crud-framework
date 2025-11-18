/**
 * Logical filter operators for SPARQL
 * Implements: AND, OR, NOT
 * Phase 1: Focus on OR with simple combined FILTER
 */

import { sparql } from "@tpluscode/sparql-builder";
import type { FilterContext, FilterResult } from "../types";
import { filterToSparql } from "../filterToSparql";

/**
 * AND: Multiple conditions (implicit in SPARQL - just add all patterns)
 * { AND: [{ age: { gte: 18 } }, { verified: true }] }
 * => Combine all patterns and filters
 */
function applyAndOperator(
  conditions: any[],
  context: FilterContext
): FilterResult {
  const result: FilterResult = { patterns: [], filters: [], optional: false };
  
  for (const condition of conditions) {
    const condResult = filterToSparql(condition, context);
    result.patterns.push(...condResult.patterns);
    result.filters.push(...condResult.filters);
  }
  
  return result;
}

/**
 * OR: Use UNION or combined FILTER with ||
 * Phase 1: Simple case only - combined FILTER
 * For simple cases: FILTER(cond1 || cond2)
 * For complex: { PATTERN1 } UNION { PATTERN2 } (TODO: Phase 2)
 */
function applyOrOperator(
  conditions: any[],
  context: FilterContext
): FilterResult {
  // Strategy: If all conditions are simple FILTER expressions, combine with ||
  // Otherwise, use UNION (to be implemented in Phase 2)
  
  const results = conditions.map(c => filterToSparql(c, context));
  
  // Check if we can use combined FILTER
  const canUseCombinedFilter = results.every(r => 
    r.patterns.length === 1 && r.filters.length === 1
  );
  
  if (canUseCombinedFilter) {
    // Combine filters with ||
    const combinedFilter = sparql`FILTER(${results.map(r => r.filters[0]).join(' || ')})`;
    return {
      patterns: [results[0].patterns[0]], // Use first pattern
      filters: [combinedFilter],
      optional: false,
    };
  } else {
    // Use UNION (more complex, less performant)
    // TODO: Implement UNION pattern generation in Phase 2
    throw new Error('Complex OR with UNION not yet implemented - Phase 2 feature');
  }
}

/**
 * NOT: Use FILTER NOT EXISTS
 * { NOT: { email: { endsWith: "spam.com" } } }
 * => FILTER NOT EXISTS { ?person :email ?email . FILTER(STRENDS(?email, "spam.com")) }
 */
function applyNotOperator(
  condition: any,
  context: FilterContext
): FilterResult {
  const condResult = filterToSparql(condition, context);
  
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
  operator: 'AND' | 'OR' | 'NOT',
  value: any,
  context: FilterContext
): FilterResult {
  const conditions = Array.isArray(value) ? value : [value];
  
  switch (operator) {
    case 'AND':
      return applyAndOperator(conditions, context);
    case 'OR':
      return applyOrOperator(conditions, context);
    case 'NOT':
      return applyNotOperator(conditions[0], context);
  }
}

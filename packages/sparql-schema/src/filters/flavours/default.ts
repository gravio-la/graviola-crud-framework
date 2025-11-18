/**
 * Default SPARQL 1.1 flavour implementation
 * 
 * This is the standard implementation that works with any SPARQL 1.1 compliant endpoint.
 * Other flavours (blazegraph, oxigraph, allegro) can extend this with custom features.
 */

import type { FilterContext, FilterResult } from "../types";

/**
 * Default flavour - no special handling needed
 * All operators use standard SPARQL 1.1 syntax
 */
export const defaultFlavour = {
  name: 'default' as const,
  
  /**
   * Check if this flavour supports a specific operator
   */
  supportsOperator(operator: string): boolean {
    // Default flavour supports all standard operators
    const standardOperators = [
      'equals', 'not', 'in', 'notIn',
      'contains', 'startsWith', 'endsWith',
      'gt', 'gte', 'lt', 'lte',
      'AND', 'OR', 'NOT'
    ];
    return standardOperators.includes(operator);
  }
};

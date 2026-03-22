import df from "@rdfjs/data-model";
import type { Variable } from "@rdfjs/types";

/**
 * Minimal context required for generating unique SPARQL variables.
 * Any context that needs unique variable names can include this type.
 */
export type VarCounterContext = {
  /**
   * Shared mutable counter for generating globally unique SPARQL variable names.
   * Wrapped in an object so the reference is preserved across recursive calls.
   */
  varCounter: { value: number };
};

/**
 * Sanitize a name to be a valid SPARQL variable identifier.
 * Only allows alphanumeric and underscore characters.
 */
export function sanitizeVariableName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!/^[a-zA-Z]/.test(cleaned)) return `var_${cleaned}`;
  return cleaned;
}

/**
 * Single gateway for creating SPARQL variables with globally unique names.
 * Always routes through df.variable() to prevent injection from weird schema property names.
 *
 * @param name - Base name for the variable (will be sanitized)
 * @param ctx - Any object with a varCounter for unique suffixes
 * @returns RDF Variable with a unique, sanitized name
 */
export function createUniqueVar(
  name: string,
  ctx: VarCounterContext,
): Variable {
  return df.variable(`${sanitizeVariableName(name)}_${ctx.varCounter.value++}`);
}

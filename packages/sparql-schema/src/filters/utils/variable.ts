/**
 * Utilities for safe SPARQL variable name generation
 */

/**
 * Generate a safe SPARQL variable name from a property path
 * 
 * @param property - Property name or path
 * @param depth - Depth level for uniqueness
 * @returns Safe variable name without the ? prefix
 */
export function safeVariableName(property: string, depth: number = 0): string {
  // Replace invalid characters with underscores
  const safe = property.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // Add depth suffix for uniqueness
  return depth > 0 ? `${safe}_${depth}` : safe;
}

/**
 * Generate a unique variable name with a counter
 * 
 * @param base - Base variable name
 * @param counter - Counter for uniqueness
 * @returns Variable name with counter
 */
export function uniqueVariable(base: string, counter: number): string {
  return `${base}_${counter}`;
}

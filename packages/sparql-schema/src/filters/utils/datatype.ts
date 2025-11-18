/**
 * Utilities for inferring SPARQL datatypes from JavaScript values
 */

import df from "@rdfjs/data-model";

/**
 * Infer the appropriate XSD datatype for a JavaScript value
 * 
 * @param value - The value to infer type for
 * @param schemaType - Optional JSON Schema type hint
 * @returns RDF literal with appropriate datatype
 */
export function inferDatatype(value: any, schemaType?: string): any {
  // Handle explicit schema type hints
  if (schemaType === 'string') {
    return df.literal(String(value));
  }
  
  if (schemaType === 'integer' || schemaType === 'number') {
    return df.literal(
      String(value),
      df.namedNode('http://www.w3.org/2001/XMLSchema#integer')
    );
  }
  
  if (schemaType === 'boolean') {
    return df.literal(
      String(value),
      df.namedNode('http://www.w3.org/2001/XMLSchema#boolean')
    );
  }
  
  // Infer from JavaScript type
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return df.literal(
        String(value),
        df.namedNode('http://www.w3.org/2001/XMLSchema#integer')
      );
    } else {
      return df.literal(
        String(value),
        df.namedNode('http://www.w3.org/2001/XMLSchema#decimal')
      );
    }
  }
  
  if (typeof value === 'boolean') {
    return df.literal(
      String(value),
      df.namedNode('http://www.w3.org/2001/XMLSchema#boolean')
    );
  }
  
  if (value instanceof Date) {
    return df.literal(
      value.toISOString(),
      df.namedNode('http://www.w3.org/2001/XMLSchema#dateTime')
    );
  }
  
  // Default to string
  return df.literal(String(value));
}

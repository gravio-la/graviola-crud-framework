/**
 * Internal types for filter translation
 */

import type { SparqlTemplateResult } from "@tpluscode/sparql-builder";
import type { SPARQLFlavour, Prefixes } from "@graviola/edb-core-types";

/**
 * Context for filter translation - everything needed to generate SPARQL patterns
 */
export type FilterContext = {
  subject: any;           // RDF term (subject of triple)
  property: string;       // Property name (e.g., "email")
  propertyVar: any;       // Variable for property value (e.g., ?email_0)
  predicateNode: any;     // Predicate node (e.g., :email)
  schemaType?: string;    // JSON Schema type ('string' | 'number' | 'boolean' | etc.)
  prefixMap: Prefixes;
  flavour: SPARQLFlavour;
  depth: number;
};

/**
 * Result of filter translation
 */
export type FilterResult = {
  patterns: SparqlTemplateResult[];  // Additional WHERE patterns (e.g., triple patterns)
  filters: SparqlTemplateResult[];   // FILTER expressions
  optional: boolean;                 // Whether the base pattern should be OPTIONAL
};

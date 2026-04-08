/**
 * New graph extractor implementation with normalized schemas
 *
 * This module provides a cleaner, more modular approach to extracting data
 * from RDF graphs using JSON Schemas. Key improvements:
 *
 * - Uses normalized schemas (all $refs resolved)
 * - Schema structure controls depth (no cycle detection needed)
 * - Supports Prisma-style filtering (select/include/omit)
 * - Pagination support for arrays
 * - Structured logging facade
 * - Better handling of anyOf/oneOf patterns
 *
 * @module extractor
 */

// Main extraction function
export { extractFromGraph } from "./extract";

// Component extractors (for advanced use cases)
export { extractObject } from "./extractObject";
export { extractLiteral } from "./extractLiteral";

// Utilities
export { expandPropertyName } from "./expandPropertyName";
export {
  normalizeOrderBy,
  compareByOrderBy,
  sortObjectArrayByOrderBy,
} from "./applyOrderBy";

// Types
export type {
  ExtractionContext,
  ExtractedValue,
  PropertyExtractor,
  PaginationMetadata,
} from "./types";

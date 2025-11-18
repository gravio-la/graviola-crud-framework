/**
 * SPARQL filter system - Prisma-style WHERE clause support
 * 
 * This module provides type-safe filtering with automatic SPARQL pattern generation.
 * 
 * @example
 * ```typescript
 * import { filterToSparql } from '@graviola/sparql-schema/filters';
 * 
 * const where = {
 *   name: { contains: 'John' },
 *   age: { gte: 18 }
 * };
 * 
 * const result = filterToSparql(where.name, context);
 * ```
 */

export * from "./types";
export * from "./filterToSparql";
export * from "./operators";
export * from "./utils";
export * from "./flavours";

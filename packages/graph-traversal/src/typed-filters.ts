/**
 * Type-safe filter system for SPARQL graph traversal
 * 
 * This module provides TypeScript types for building Prisma-style WHERE clauses
 * with full type safety and schema inference.
 */

/**
 * String-specific filter operators
 * Available for properties of type string
 */
export type StringFilterOperators = {
  equals?: string;
  not?: string;
  in?: string[];
  notIn?: string[];
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  mode?: 'default' | 'insensitive';
};

/**
 * Number-specific filter operators
 * Available for properties of type number
 */
export type NumberFilterOperators = {
  equals?: number;
  not?: number;
  in?: number[];
  notIn?: number[];
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
};

/**
 * Boolean filter operators
 * Available for properties of type boolean
 */
export type BooleanFilterOperators = {
  equals?: boolean;
  not?: boolean;
};

/**
 * DateTime filter operators (for xsd:dateTime strings)
 * Available for Date types or dateTime format strings
 */
export type DateTimeFilterOperators = {
  equals?: string | Date;
  not?: string | Date;
  lt?: string | Date;
  lte?: string | Date;
  gt?: string | Date;
  gte?: string | Date;
};

/**
 * Flavour-specific filter operators (future extensibility)
 * These are only available when the appropriate flavour is set
 */
export type GeoFilterOperators = {
  inCircle?: {
    center: { lat: number; lon: number };
    radius: number; // km
  };
  inBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
};

/**
 * Map TypeScript types to appropriate filter operators
 * This is the key to type-safe filtering - each type gets its own operators
 */
export type FilterOperatorsForType<T> = 
  // String type gets string operators
  T extends string
    ? string | StringFilterOperators
  // Number type gets number operators
  : T extends number
    ? number | NumberFilterOperators
  // Boolean type gets boolean operators
  : T extends boolean
    ? boolean | BooleanFilterOperators
  // Date type gets datetime operators
  : T extends Date
    ? string | Date | DateTimeFilterOperators
  // Array types - recurse into element type
  : T extends Array<infer U>
    ? TypedWhereInput<U> | TypedWhereInput<U>[]
  // Object types - recurse into object properties
  : T extends object
    ? TypedWhereInput<T>
  // Fallback for unknown types
  : any;

/**
 * Type-safe WHERE input that derives filter operators from type T
 * Similar to TypedIncludePattern but for filtering
 *
 * Each property gets operators based on its type:
 * - string: equals, contains, startsWith, endsWith, in, notIn, mode
 * - number: equals, gt, gte, lt, lte, in, notIn
 * - boolean: equals, not
 * - Date: equals, gt, gte, lt, lte
 * - Array<T>: nested where for array elements
 * - Object: nested where for object properties
 *
 * Supports union types (e.g., string | number gets both string and number operators)
 *
 * @template T - The type to derive filter from (typically z.infer<typeof schema>)
 */
export type TypedWhereInput<T> = {
  [K in keyof T]?: FilterOperatorsForType<NonNullable<T[K]>>;
} & {
  // Logical operators at any level
  AND?: TypedWhereInput<T> | TypedWhereInput<T>[];
  OR?: TypedWhereInput<T> | TypedWhereInput<T>[];
  NOT?: TypedWhereInput<T> | TypedWhereInput<T>[];
};

/**
 * Flavour-aware WHERE input that adds flavour-specific operators
 * 
 * @template T - The type to derive filter from
 * @template F - The SPARQL flavour ('default' | 'blazegraph' | 'oxigraph' | 'allegro')
 */
export type FlavourAwareWhereInput<
  T,
  F extends 'default' | 'blazegraph' | 'oxigraph' | 'allegro' = 'default'
> = TypedWhereInput<T> & (
  F extends 'blazegraph'
    ? {
        // Blazegraph-specific: geo filters on string properties (coordinates)
        [K in keyof T]?: T[K] extends string
          ? FilterOperatorsForType<T[K]> | GeoFilterOperators
          : FilterOperatorsForType<NonNullable<T[K]>>;
      }
    : {}
);

/**
 * Select pattern - simplified placeholder for now
 * Will be properly typed in the future
 */
export type TypedSelectPattern<T> = {
  [K in keyof T]?: boolean;
};

/**
 * Include pattern - simplified placeholder for now
 * Will be properly typed in the future
 */
export type TypedIncludePattern<T> = {
  [K in keyof T]?: boolean | TypedIncludePattern<NonNullable<T[K]>>;
};

/**
 * Omit pattern - simplified placeholder for now
 * Will be properly typed in the future
 */
export type TypedOmitPattern<T> = {
  [K in keyof T]?: boolean;
};

/**
 * Placeholder for GraphTraversalFilterOptions - will be imported from core-types
 * This is a minimal definition for now
 */
export type GraphTraversalFilterOptions = {
  select?: any;
  include?: any;
  omit?: any;
  where?: any;
  includeRelationsByDefault?: boolean;
  defaultPaginationLimit?: number;
  excludeJsonLdMetadata?: boolean;
};

/**
 * Type-safe graph traversal filter options
 * Extends the base GraphTraversalFilterOptions with typed versions
 */
export type TypedGraphTraversalFilterOptions<
  T,
  F extends 'default' | 'blazegraph' | 'oxigraph' | 'allegro' = 'default'
> = Omit<
  GraphTraversalFilterOptions,
  "select" | "include" | "omit" | "where"
> & {
  select?: TypedSelectPattern<T>;
  include?: TypedIncludePattern<T>;
  omit?: TypedOmitPattern<T>;
  where?: FlavourAwareWhereInput<T, F>;
};

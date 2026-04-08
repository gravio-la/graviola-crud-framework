import type { Bindings, DatasetCore, Quad, ResultStream } from "@rdfjs/types";
import type { NamespaceBuilder } from "@rdfjs/namespace";
export type * from "./settings";
export type * from "./typed-filters";

export type Prefixes = {
  [k: string]: string;
};

export interface FetchConfig {
  accept: string;
  contentType: string;
  cache?: RequestCache;
  cors?: RequestMode;
}

export type AuthConfig = {
  username?: string;
  password?: string;
  token?: string;
};

export type NamespaceBuilderPrefixes = {
  prefixes: Record<string, NamespaceBuilder>;
};

export type FieldExtractDeclaration<T = any> =
  | string
  | ((entry: T) => string)
  | { path: string };

export type PrimaryField = Partial<{
  label: string;
  description: string;
  image: string;
}>;
export type PrimaryFieldExtract<T> = Partial<{
  label: FieldExtractDeclaration<T>;
  description: FieldExtractDeclaration<T>;
  image: FieldExtractDeclaration<T>;
}>;
export type PrimaryFieldDeclaration<Key extends string = string> = {
  [typeName: Key]: PrimaryField;
};

export type PrimaryFieldExtractDeclaration<
  T = any,
  Key extends string = string,
> = {
  [typeName: Key]: PrimaryFieldExtract<T>;
};

export type PrimaryFieldResults<T> = {
  label: T | null;
  description: T | null;
  image: T | null;
};

export type NamedEntityData = {
  "@id": string;
  [key: string]: any;
};
export type NamedAndTypedEntity = NamedEntityData & {
  "@type": string;
};

export type StringToIRIFn = (property: string) => string;
export type IRIToStringFn = (iri: string) => string;
export interface SparqlBuildOptions {
  base?: string;
  prefixes?: Record<string, string>;
  propertyToIRI: StringToIRIFn;
  typeIRItoTypeName: IRIToStringFn;
  primaryFields: PrimaryFieldDeclaration;
  primaryFieldExtracts: PrimaryFieldExtractDeclaration;
  sparqlFlavour?: SPARQLFlavour;
}
export interface SelectFetchOptions {
  withHeaders?: boolean;
}

export type SPARQLCRUDOptions = {
  queryBuildOptions?: SparqlBuildOptions;
  defaultPrefix: string;
  maxRecursion?: number;
  /** Max depth at which inverse (x-inverseOf) properties are resolved. Default 0 = root only. */
  resolveInverseMaxDepth?: number;
  defaultUpdateGraph?: string;
};

export type SPARQLQueryType = "construct" | "select" | "ask" | "update";

export type SPARQLQueryLogMeta = {
  durationMs: number;
  error?: unknown;
};

export type SPARQLQueryOptions = {
  queryKey?: string;
};

export type SPARQLCRUDLogger = {
  logger?: Logger;
  /** Called after each SPARQL round-trip; fourth argument carries timing and optional error. */
  logQuery?: (
    queryKey: string | undefined,
    query: string,
    queryType: SPARQLQueryType,
    meta?: SPARQLQueryLogMeta,
  ) => void;
};

export type ResultBindings = any[];

export type RDFSelectResult = {
  head: {
    vars: string[];
  };
  results: {
    bindings: ResultBindings;
  };
};

export type SelectFetchOverload = {
  (
    query: string,
    options: { withHeaders: true } & SPARQLQueryOptions,
  ): Promise<RDFSelectResult>;
  (
    query: string,
    options?: { withHeaders?: false } & SPARQLQueryOptions,
  ): Promise<ResultBindings>;
};

export type CRUDFunctions = {
  updateFetch: (
    query: string,
    options?: SPARQLQueryOptions,
  ) => Promise<
    | ResultStream<any>
    | boolean
    | void
    | ResultStream<Bindings>
    | ResultStream<Quad>
    | Response
  >;
  constructFetch: (
    query: string,
    options?: SPARQLQueryOptions,
  ) => Promise<DatasetCore>;
  selectFetch: SelectFetchOverload;
  askFetch: (query: string, options?: SPARQLQueryOptions) => Promise<boolean>;
};

export type SparqlEndpoint = {
  label?: string;
  endpoint: string;
  active: boolean;
  auth?: AuthConfig;
  additionalHeaders?: Record<string, string>;
  provider?:
    | "allegro"
    | "oxigraph"
    | "worker"
    | "blazegraph"
    | "virtuoso"
    | "qlever"
    | "rest";
  defaultUpdateGraph?: string;
};

/**
 * **"sparql12"** — SPARQL 1.2 engines (e.g. Jena ARQ, Oxigraph) that support
 * `LATERAL`. For relationship arrays with `include.take` / `orderBy`, the query
 * emits `OPTIONAL { LATERAL { SELECT ?subject ?item … ORDER BY … LIMIT … } }`.
 * The **subject variable must be projected** in that SELECT so the LATERAL
 * `inject` step correlates per outer row (SEP-0006). Sort order in JSON is still
 * finalized in extraction (`applyIncludeOrderBy`) after CONSTRUCT.
 */
export type SPARQLFlavour =
  | "default"
  | "oxigraph"
  | "oxigraph-local"
  | "blazegraph"
  | "allegro"
  | "sparql12";

export type WorkerProvider = Record<
  NonNullable<SparqlEndpoint["provider"]>,
  | (<T = Record<string, any>>(
      endpointConfig: SparqlEndpoint,
      options?: T,
    ) => CRUDFunctions)
  | null
>;

export type QueryOptions = {
  defaultPrefix: string;
  queryBuildOptions: SparqlBuildOptions;
};

export type BasicThingInformation = {
  id: string;
  label: string;
  secondary?: string;
  avatar?: string;
  category?: string;
  allProps?: Record<string, any>;
};

export type QueryBuilderOptions = {
  prefixes: Prefixes;
  defaultPrefix: string;
};

export type Permission = {
  view: boolean;
  edit: boolean;
};

export type PermissionDeclaration<T extends string> = {
  [typeName in T]: Permission;
};

export type SameAsTypeMap = Record<string, string | string[]>;

export type NormDataMapping<MappingType> = {
  label: string;
  mapping: MappingType;
  sameAsTypeMap: SameAsTypeMap;
};

export type NormDataMappings<MappingType> = Record<
  string,
  NormDataMapping<MappingType>
>;

export type AutocompleteSuggestion = {
  label: string;
  value: string | null;
  image?: string;
  description?: string;
};

export type ColumnDesc<T> = {
  index: number;
  value: T;
  letter: string;
};

export type WalkerOptions = {
  omitEmptyArrays: boolean;
  omitEmptyObjects: boolean;
  maxRecursionEachRef: number;
  maxRecursion: number;
  skipAtLevel: number;
  doNotRecurseNamedNodes?: boolean;
};

/**
 * Sort order for ordering query results
 */
export type SortOrder = "asc" | "desc";

/**
 * Order by clause for a single property (Prisma-style)
 * Example: { name: 'asc' } or { createdAt: 'desc' }
 */
export type OrderByClause<T = any> = {
  [K in keyof T]?: SortOrder;
};

/**
 * Pagination options for limiting and offsetting relationship queries
 * Supports Prisma-style orderBy for sorting results
 */
export type PaginationOptions = {
  /** Maximum number of items to return */
  take?: number;
  /** Number of items to skip before returning results */
  skip?: number;
  /**
   * Order by clause(s) for sorting results (Prisma-style)
   * Can be a single object or array of objects
   * Example: { name: 'asc' } or [{ name: 'asc' }, { createdAt: 'desc' }]
   * Note: Required for pagination on blank nodes (unnamed nodes)
   */
  orderBy?: OrderByClause | OrderByClause[];
};

/**
 * Pagination metadata that can be attached to array schemas
 *
 * The `_stage` field records where pagination is applied (same meaning everywhere:
 * `include` options, `extractArrayProperty`, and `ConstructResult.paginationMetadata`):
 * - "extraction": Sort/slice during graph traversal (default when SPARQL returns the full relation)
 * - "query": LIMIT/OFFSET already applied in SPARQL (`sparql12` LATERAL subselect); extraction must not re-slice
 *
 * The `orderBy` field specifies sort criteria (Prisma-style):
 * - Required for consistent pagination on blank nodes (unnamed nodes)
 * - Optional for named nodes
 * - Can be single object or array: { name: 'asc' } or [{ name: 'asc' }, { createdAt: 'desc' }]
 */
export type PaginationMetadata = PaginationOptions & {
  _stage?: "query" | "extraction";
};

/**
 * Include pattern for relationships with support for nested includes and pagination
 * - Set to `true` to include the relationship with default settings
 * - Set to an object to configure pagination and nested includes
 *
 * @template T - The type to derive include pattern from (optional, defaults to any for backward compatibility)
 *
 * @example
 * ```typescript
 * // With Zod type inference for type safety
 * import { z } from 'zod';
 * const schema = z.object({ name: z.string(), friends: z.array(z.object({ name: z.string() })) });
 * type Person = z.infer<typeof schema>;
 *
 * const include: IncludePattern<Person> = {
 *   friends: { take: 10, include: { name: true } }
 * };
 *
 * // Without type parameter (backward compatible)
 * const include2: IncludePattern = {
 *   friends: { take: 10 }
 * };
 * ```
 */

/**
 * Validation mode for runtime filter validation
 * - 'throw': Throw an error if filter validation fails
 * - 'warn': Log a warning to console if filter validation fails
 * - 'ignore': Skip validation entirely (default)
 */
export type FilterValidationMode = "throw" | "warn" | "ignore";

// Re-export type-safe filter types from typed-filters module
export type {
  StringFilterOperators,
  NumberFilterOperators,
  BooleanFilterOperators,
  DateTimeFilterOperators,
  GeoFilterOperators,
  FilterOperatorsForType,
  TypedWhereInput as WhereInput,
  FlavourAwareWhereInput,
  TypedSelectPattern as SelectPattern,
  TypedOmitPattern as OmitPattern,
  TypedIncludePattern as IncludePattern,
  TypedGraphTraversalFilterOptions as GraphTraversalFilterOptions,
} from "./typed-filters";

/**
 * Extended walker options combining legacy options with new filter capabilities
 *
 * @template T - The type to derive filter patterns from (optional, defaults to any for backward compatibility)
 */
export type ExtendedWalkerOptions<T = any> = WalkerOptions &
  GraphTraversalFilterOptions<T>;

export type Entity = {
  entityIRI: string;
  typeIRI: string;
  // @deprecated use entityIRI instead
  value: string;
  name?: string;
  label?: string;
  description?: string;
  image?: string;
};

// Legacy runtime (non-typed) filter operators - kept for backward compatibility
// @deprecated Use the typed versions above instead
export type WhereOperators = {
  equals?: any;
  not?: any;
  in?: any[];
  notIn?: any[];
  // String operators
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  mode?: "default" | "insensitive";
  // Numeric operators
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
};

/**
 * Log levels for the logger
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger interface for structured logging during graph extraction
 * Provides a facade that can be implemented by any logging framework
 */
export interface Logger {
  /**
   * Start a timer with a label
   * @param label The label to identify the timer
   */
  time(label: string): void;
  /**
   * Stop a timer with a label
   * @param label The label to identify the timer
   */
  timeEnd(label: string): void;
  /**
   * Log debug information (detailed execution flow)
   * @param message Human-readable message
   * @param context Optional structured data for context
   */
  debug(message: string, context?: Record<string, any>): void;

  /**
   * Log informational messages (high-level operations)
   * @param message Human-readable message
   * @param context Optional structured data for context
   */
  info(message: string, context?: Record<string, any>): void;

  /**
   * Log warning messages (non-fatal issues)
   * @param message Human-readable message
   * @param context Optional structured data for context
   */
  warn(message: string, context?: Record<string, any>): void;

  /**
   * Log error messages (failures)
   * @param message Human-readable message
   * @param context Optional structured data for context
   */
  error(message: string, context?: Record<string, any>): void;
}

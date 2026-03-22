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
  /** Optional schema validator facade (e.g. AJV). When absent, only structural checks are performed. */
  validator?: SchemaValidator;
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
  (query: string, options: { withHeaders: true }): Promise<RDFSelectResult>;
  (query: string, options?: { withHeaders?: false }): Promise<ResultBindings>;
};

export type CRUDFunctions = {
  updateFetch: (
    query: string,
  ) => Promise<
    | ResultStream<any>
    | boolean
    | void
    | ResultStream<Bindings>
    | ResultStream<Quad>
    | Response
  >;
  constructFetch: (query: string) => Promise<DatasetCore>;
  selectFetch: SelectFetchOverload;
  askFetch: (query: string) => Promise<boolean>;
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

export type SPARQLFlavour = "default" | "oxigraph" | "blazegraph" | "allegro";

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
 * The `_stage` field indicates where pagination was applied:
 * - "extraction": Apply during graph traversal (default)
 * - "query": Already applied at SPARQL CONSTRUCT query stage (skip during extraction)
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

/**
 * Scalar value types supported for partial patch mutations
 */
export type PatchScalarValue = string | number | boolean | null;

/**
 * A nested object value for patch mutation (blank node in RDF).
 * Objects without @id become blank nodes; objects with @id are entity references.
 */
export type PatchObjectValue = {
  "@id"?: string;
  "@type"?: string;
  [key: string]:
    | PatchScalarValue
    | PatchObjectValue
    | PatchObjectValue[]
    | PatchScalarValue[]
    | undefined;
};

/**
 * A single field value in a patch data payload.
 * Phase 1: scalars, nested objects, or full array overwrite.
 * Phase 2 will add { append, remove, where } wrappers for list operations.
 */
export type PatchFieldValue =
  | PatchScalarValue
  | PatchObjectValue
  | PatchScalarValue[]
  | PatchObjectValue[];

/**
 * The data payload for a partial update (patch) mutation.
 * Keys are property names; values are the new values to set.
 *
 * When typed (T provided), only keys of T are allowed.
 * When untyped, any string key is accepted and runtime schema validation is used.
 */
export type PatchData<T = Record<string, PatchFieldValue>> = {
  [K in keyof T]?: T[K];
};

/**
 * Options for a partial update (patch) mutation
 */
export type PatchOptions<T = Record<string, PatchFieldValue>> = {
  /** The fields to update. Keys are property names from the schema. */
  data: PatchData<T>;
};

/**
 * Facade for a JSON Schema validator (e.g. AJV).
 * When provided during store initialization, patch operations will use this
 * to validate values against the sub-schema at each property path.
 * When absent, all values are accepted without validation.
 */
export type SchemaValidator = {
  /** Validate data against a JSON Schema. Returns true if valid. */
  validate(schema: object, data: unknown): boolean;
  /** Validation errors from the last call to validate (null/undefined if valid). */
  errors?: Array<{ message?: string; instancePath?: string }> | null;
};

/**
 * Result of a patch operation
 */
export type PatchResult = {
  /** The entity IRI that was patched */
  entityIRI: string;
  /** The property names that were updated */
  updatedProperties: string[];
  /** Whether the patch was successful */
  success: boolean;
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

import type {
  IRIToStringFn,
  SparqlEndpoint,
  StringToIRIFn,
  WalkerOptions,
  Entity,
  TypedGraphTraversalFilterOptions,
  PatchFieldValue,
  PatchResult,
} from "@graviola/edb-core-types";
import type { NamespaceBuilder } from "@rdfjs/namespace";
import type { JsonLdContext } from "jsonld-context-parser";
import type { JSONSchema7 } from "json-schema";
import type { Term } from "@rdfjs/types";

export type EdbConfRaw = {
  BASE_IRI: string;
  namespaceBase: string;
  walkerOptions: Partial<WalkerOptions>;
  defaultPrefix: string;
  defaultJsonldContext: object;
  defaultQueryBuilderOptions: {
    prefixes: Record<string, string | NamespaceBuilder>;
  };
  sparqlEndpoint: SparqlEndpoint;
};
export type Config = Omit<EdbConfRaw, "namespaceBase"> & {
  namespace: NamespaceBuilder<string>;
};

export type SimplifiedEndpointConfig = {
  baseIRI: string;
  entityBaseIRI: string;
  endpoint: SparqlEndpoint;
  jsonldContext?: object;
};

export type PaginationState = {
  pageIndex: number;
  pageSize: number;
};

export type QueryPagination = {
  pagination: PaginationState;
};

export type QuerySorting = {
  sorting: {
    id: string;
    desc?: boolean;
  }[];
};

export type QuerySearch = {
  search: string;
};

export type QueryFields = {
  fields: string[];
};

export type QueryType = Partial<
  QueryPagination & QuerySorting & QuerySearch & QueryFields
>;

export type DatastoreBaseConfig = {
  schema: JSONSchema7;
};

export type InitDatastoreFunction<
  T extends DatastoreBaseConfig,
  S extends AbstractDatastore = AbstractDatastore,
> = (dataStoreConfig: T) => S;

export type CountAndIterable<DocumentResult> = {
  amount: number;
  iterable: AsyncIterable<DocumentResult>;
};

/**
 * Options for filtering a single typed document
 * Generic enough to work with any datastore implementation (SPARQL, Prisma, etc.)
 */
export type TypedDocumentFilterOptions<T = any> =
  TypedGraphTraversalFilterOptions<T> & {
    /** Walker options for graph/document traversal */
    walkerOptions?: Partial<WalkerOptions>;
    /** Maximum recursion depth for nested objects */
    maxRecursion?: number;
  };

/**
 * Options for finding multiple typed documents
 * Adds search and pagination on top of filter options
 */
export type TypedDocumentsSearchOptions<T = any> =
  TypedDocumentFilterOptions<T> & {
    /** Search string to filter entities by label/name */
    searchString?: string | null;
    /** Maximum number of entities to return */
    limit?: number;
  };

export type AbstractDatastoreIterable<
  TypeName extends string = string,
  DocumentResultTypeMap extends Record<string, any> = Record<string, any>,
  DocumentResult = any,
> = {
  listDocuments: <T extends TypeName>(
    typeName: T,
    limit?: number,
  ) => Promise<
    CountAndIterable<
      DocumentResultTypeMap[T] extends undefined
        ? DocumentResult
        : DocumentResultTypeMap[T]
    >
  >;
  findDocuments: <T extends TypeName>(
    typeName: T,
    query: QueryType,
    limit?: number,
  ) => Promise<
    CountAndIterable<
      DocumentResultTypeMap[T] extends undefined
        ? DocumentResult
        : DocumentResultTypeMap[T]
    >
  >;
};

export type AbstractDatastore<
  TypeName extends string = string,
  DocumentResultTypeMap extends Record<string, any> = Record<string, any>,
  FindResultTypeMap extends Record<string, any[]> =
    DocumentResultTypeMap extends undefined
      ? Record<string, any[]>
      : { [K in keyof DocumentResultTypeMap]: DocumentResultTypeMap[K][] },
  UpsertResultTypeMap extends Record<string, any> = DocumentResultTypeMap,
  UpsertDocumentTypeMap extends Record<string, any> = DocumentResultTypeMap,
  RemoveResultTypeMap extends Record<string, any> = DocumentResultTypeMap,
  UpsertResult = any,
  LoadResult = any,
  FindResult = any[],
  RemoveResult = any,
  DocumentResult = LoadResult,
  UpsertDocument = any,
  ImportResult = any,
  BulkImportResult = any,
> = {
  typeNameToTypeIRI: StringToIRIFn;
  typeIRItoTypeName: IRIToStringFn;
  removeDocument: (
    typeName: TypeName,
    entityIRI: string,
  ) => Promise<RemoveResult>;
  importDocument: (
    typeName: TypeName,
    entityIRI: any,
    importStore: AbstractDatastore,
  ) => Promise<ImportResult>;
  importDocuments: (
    typeName: TypeName,
    importStore: AbstractDatastore,
    limit: number,
  ) => Promise<BulkImportResult>;
  loadDocument: <T extends TypeName>(
    typeName: T,
    entityIRI: string,
  ) => Promise<
    DocumentResultTypeMap[T] extends undefined
      ? LoadResult
      : DocumentResultTypeMap[T] | undefined | null
  >;
  existsDocument: (typeName: TypeName, entityIRI: string) => Promise<boolean>;
  upsertDocument: (
    typeName: TypeName,
    entityIRI: string,
    document: UpsertDocumentTypeMap[T] extends undefined
      ? UpsertDocument
      : UpsertDocumentTypeMap[T],
  ) => Promise<
    UpsertResultTypeMap[T] extends undefined
      ? UpsertResult
      : UpsertResultTypeMap[T]
  >;
  listDocuments: <T extends TypeName>(
    typeName: T,
    limit?: number,
    cb?: (
      document: DocumentResultTypeMap[T] extends undefined
        ? DocumentResult
        : DocumentResultTypeMap[T],
    ) => Promise<any>,
  ) => Promise<
    FindResultTypeMap[T] extends undefined ? FindResult : FindResultTypeMap[T]
  >;
  findDocuments: <T extends TypeName>(
    typeName: T,
    query: QueryType,
    limit?: number,
    cb?: (
      document: DocumentResultTypeMap[T] extends undefined
        ? DocumentResult
        : DocumentResultTypeMap[T],
    ) => Promise<any>,
  ) => Promise<
    FindResultTypeMap[T] extends undefined ? FindResult : FindResultTypeMap[T]
  >;
  findEntityByTypeName?: (
    typeName: TypeName,
    searchString: string,
    limit?: number,
  ) => Promise<Entity[]>;
  findDocumentsByLabel?: <T extends TypeName>(
    typeName: T,
    label: string,
    limit?: number,
  ) => Promise<
    FindResultTypeMap[T] extends undefined ? FindResult : FindResultTypeMap[T]
  >;
  findDocumentsByAuthorityIRI?: <T extends TypeName>(
    typeName: T,
    authorityIRI: string,
    repositoryIRI?: string,
    limit?: number,
  ) => Promise<
    FindResultTypeMap[T] extends undefined ? FindResult : FindResultTypeMap[T]
  >;
  findDocumentsAsFlatResultSet?: <T extends TypeName>(
    typeName: T,
    query: QueryType,
    limit?: number,
  ) => Promise<any>;
  countDocuments?: (
    typeName: TypeName,
    query?: Partial<QuerySearch>,
  ) => Promise<number>;
  getClasses?: (entityIRI: string) => Promise<string[]>;
  /**
   * Get entities with their classes filtered by type-safe where clause
   * Used to find all entities matching a filter and return their type IRIs
   *
   * @template T - Type for filter validation (e.g., z.infer<typeof schema>)
   * @param options - Type-safe filter options (primarily where clause)
   * @returns Promise resolving to Map of entity IRI -> array of type IRIs
   *
   * @example
   * ```typescript
   * // Find all entities with geoFeature relationship
   * const entityClassMap = await dataStore.getEntitiesWithClassesByFilter({
   *   where: { geoFeature: { '@id': 'http://example.com/feature/1' } }
   * });
   * // Returns: Map { 'http://example.com/patch/1' => ['http://...#Patch'], ... }
   * ```
   */
  getEntitiesWithClassesByFilter?: <T = any>(
    options: TypedDocumentsSearchOptions<T>,
  ) => Promise<Map<string, string[]>>;
  /**
   * Load a single document with type-safe filters
   * Supports Prisma-style where/include/select with full TypeScript inference
   *
   * @template T - Type of the document (e.g., z.infer<typeof PersonSchema>)
   * @param typeName - Name of the type/class
   * @param entityIRI - IRI of the entity to load
   * @param options - Type-safe filter options (where, include, select, etc.)
   * @returns Promise resolving to the filtered document of type T or null if no document found
   */
  filterTypedDocument?: <T = any>(
    typeName: TypeName,
    entityIRI: string,
    options?: TypedDocumentFilterOptions<T>,
  ) => Promise<T | null>;
  /**
   * Find multiple documents by type with type-safe filters
   * Supports Prisma-style where/include/select with search and pagination
   *
   * @template T - Type of the documents (e.g., z.infer<typeof PersonSchema>)
   * @param typeName - Name of the type/class to search for
   * @param options - Type-safe filter and search options
   * @returns Promise resolving to array of filtered documents of type T[]
   */
  filterTypedDocuments?: <T = any>(
    typeName: TypeName,
    options?: TypedDocumentsSearchOptions<T>,
  ) => Promise<T[]>;
  /**
   * Partially update specific properties of a document without loading/saving the full document.
   * Phase 1: supports setting scalars, nested objects (shallow merge), and full array overwrites.
   * Fails if the entity does not exist.
   *
   * @template T - Type of the document for type-safe data payload
   * @param typeName - Name of the type/class
   * @param entityIRI - IRI of the entity to patch
   * @param options - Patch options containing the data fields to update
   * @returns Promise resolving to the patch result
   */
  patchDocument?: <T = any>(
    typeName: TypeName,
    entityIRI: string,
    options: { data: Partial<Record<string, any>> },
  ) => Promise<PatchResult>;
  iterableImplementation?: AbstractDatastoreIterable<
    TypeName,
    DocumentResultTypeMap,
    DocumentResult
  >;
};

export type JSONLDConfig = {
  defaultPrefix: string;
  jsonldContext?: JsonLdContext;
  allowUnsafeSourceIRIs?: boolean;
};

export type RootNode = {
  id: string | number;
  properties: NodePropertyTree;
};

export type NodePropertyTree = {
  [key: string]: NodePropertyItem[];
};

export type NodePropertyItem = {
  value: string;
  term: Term;
  termType: string;
  properties?: NodePropertyTree;
};

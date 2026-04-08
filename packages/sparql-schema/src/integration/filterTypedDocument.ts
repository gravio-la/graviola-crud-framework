/**
 * Type-safe document filtering and loading with Prisma-style API
 *
 * This module provides high-level functions that combine:
 * - buildTypedSPARQLQuery for type-safe query generation
 * - SPARQL execution via constructFetch
 * - Data extraction via traverseGraphExtractBySchema
 *
 * Features:
 * - Single and batch entity loading by IRI
 * - Finding entities by type with filters
 * - Full TypeScript type safety
 * - Prisma-style where/include/select API
 */

import type { JSONSchema7 } from "json-schema";
import type { DatasetCore } from "@rdfjs/types";
import type {
  WalkerOptions,
  Entity,
  SparqlBuildOptions,
  ExtendedWalkerOptions,
  SPARQLFlavour,
} from "@graviola/edb-core-types";
import {
  extractFromGraph,
  sortObjectArrayByOrderBy,
} from "@graviola/edb-graph-traversal";
import { buildTypedSPARQLQuery } from "../schema2sparql/buildTypedSPARQLQuery";
import type { BuildTypedSPARQLQueryOptions } from "../schema2sparql/buildTypedSPARQLQuery";
import df from "@rdfjs/data-model";
import {
  OptionalStringOrStringArray,
  QUERY_RESULT_SUBJECT_IRI_NODE,
} from "@/base";
import { rdf } from "@tpluscode/rdf-ns-builders";

/**
 * Options for filterTypedDocument
 * Extends BuildTypedSPARQLQueryOptions with CRUD-specific options
 */
export interface TypedFilterOptions<
  T = any,
> extends BuildTypedSPARQLQueryOptions<T> {
  /** Walker options for graph traversal */
  walkerOptions?: Partial<WalkerOptions>;
  /** Default prefix for IRI resolution */
  defaultPrefix?: string;
  /** Query build options for SPARQL generation */
  queryBuildOptions?: SparqlBuildOptions;
}

/**
 * Walk the `include` options tree and sort (and optionally slice) any
 * extracted array properties whose include entry specifies `orderBy`.
 *
 * SPARQL CONSTRUCT builds an unordered triple set: ORDER BY in a SUBSELECT
 * determines *which* triples are included (via LIMIT/OFFSET), but the order
 * in which clownface iterates them is arbitrary. Post-extraction sorting makes
 * the ordering deterministic regardless of the SPARQL engine.
 *
 * When `applySlicing` is true (all flavours except `"sparql12"`), skip/take are
 * applied here after sorting — SPARQL does not paginate nested arrays for those
 * flavours. For `"sparql12"`, LIMIT/OFFSET run in `LATERAL { SELECT … }`; we only
 * sort here to fix JSON array order after CONSTRUCT.
 *
 * Only top-level array properties are handled here; nested `orderBy` (e.g.
 * friends.posts.orderBy) is not yet supported.
 */
function applyIncludeOrderBy<T>(
  result: T,
  include: Record<string, any> | undefined,
  applySlicing: boolean,
): T {
  if (!include || typeof result !== "object" || result === null) return result;

  const obj = result as Record<string, any>;
  for (const [property, includeValue] of Object.entries(include)) {
    if (
      typeof includeValue !== "object" ||
      includeValue === null ||
      !includeValue.orderBy
    )
      continue;

    const arr = obj[property];
    if (!Array.isArray(arr)) continue;

    let sorted = sortObjectArrayByOrderBy(arr, includeValue.orderBy);

    if (applySlicing) {
      const skip: number | undefined = includeValue.skip;
      const take: number | undefined = includeValue.take;
      const start = skip !== undefined && skip > 0 ? skip : 0;
      const end = take !== undefined ? start + take : undefined;
      if (start > 0 || end !== undefined) {
        sorted = sorted.slice(start, end);
      }
    }

    obj[property] = sorted;
  }
  return result;
}

/**
 * For `sparql12`, relationship LIMIT/OFFSET run inside `LATERAL { SELECT … }`.
 * Set `include.*._stage: "query"` (same field as `PaginationMetadata._stage` / construct
 * metadata) so `extractArrayProperty` does not re-apply skip/take (double-slice).
 */
function markIncludeQueryStageForSparql12(
  include: Record<string, any> | undefined,
  flavour: SPARQLFlavour,
): Record<string, any> | undefined {
  if (!include || flavour !== "sparql12") return include;
  return Object.fromEntries(
    Object.entries(include).map(([key, value]) => [
      key,
      typeof value === "object" &&
      value !== null &&
      (value.take !== undefined || value.skip !== undefined)
        ? { ...value, _stage: "query" as const }
        : value,
    ]),
  );
}

/**
 * Load a single entity or batch of entities by IRI with type-safe filters
 *
 * This function combines:
 * 1. buildTypedSPARQLQuery - generates type-safe SPARQL CONSTRUCT query
 * 2. constructFetch - executes the query
 * 3. traverseGraphExtractBySchema - extracts structured data from RDF graph
 *
 * @template T - The type to derive filters from (typically z.infer<typeof schema>)
 * @param entityIRIs - optional single IRI or array of IRIs to load
 * @param typeIRIs - optional single IRI or array of IRIs to filter by
 * @param schema - JSON Schema (should already have correct definition at top via bringDefinitionToTop)
 * @param constructFetch - Function to execute CONSTRUCT queries
 * @param options - Type-safe filter options (select, include, where, etc.)
 * @returns Single document or array of documents matching type T
 *
 * @example
 * ```typescript
 * // Single entity
 * const person = await filterTypedDocument<Person>(
 *   'http://example.com/person/1',
 *   'http://example.com/Person',
 *   personSchema,
 *   constructFetch,
 *   {
 *     select: { name: true, age: true },
 *     include: { friends: { take: 10 } },
 *     where: { age: { gte: 18 } },
 *     defaultPrefix: 'http://example.com/'
 *   }
 * );
 *
 * // Batch loading
 * const people = await filterTypedDocuments<Person>(
 *   ['http://example.com/person/1', 'http://example.com/person/2'],
 *   'http://example.com/Person',
 *   personSchema,
 *   constructFetch,
 *   { select: { name: true } }
 * );
 * ```
 */
export async function filterTypedDocuments<T = any>(
  entityIRIs: OptionalStringOrStringArray,
  typeIRIs: OptionalStringOrStringArray,
  schema: JSONSchema7,
  constructFetch: (query: string) => Promise<DatasetCore>,
  options: TypedFilterOptions<T> = {},
): Promise<T[]> {
  const {
    walkerOptions,
    defaultPrefix = "",
    prefixMap = {},
    ...buildOptions
  } = options;

  // Build prefix map from defaultPrefix if not provided
  const finalPrefixMap =
    Object.keys(prefixMap).length > 0
      ? prefixMap
      : defaultPrefix
        ? { "": defaultPrefix }
        : {};

  // Resolve the effective SPARQL flavour from the options.
  // Direct `flavour` field takes precedence; fall back to the store-level
  // `queryBuildOptions.sparqlFlavour` forwarded by initSPARQLStore.
  const effectiveFlavour: SPARQLFlavour =
    (buildOptions as any).flavour ??
    (buildOptions as any).queryBuildOptions?.sparqlFlavour ??
    "default";

  // Step 1: Build type-safe SPARQL query (includes flavour for SPARQL dialect)
  const { query } = buildTypedSPARQLQuery<T>(entityIRIs, typeIRIs, schema, {
    ...buildOptions,
    prefixMap: finalPrefixMap,
    flavour: effectiveFlavour,
  });

  // Step 2: Execute CONSTRUCT query
  const dataset = await constructFetch(query);

  const include = (options as Record<string, any>).include as
    | Record<string, any>
    | undefined;

  const useExtractionSlicing = effectiveFlavour !== "sparql12";

  // Build extraction options: graph-traversal fields only.
  const extractionOptions: Partial<ExtendedWalkerOptions<T>> = {
    ...walkerOptions,
    include: markIncludeQueryStageForSparql12(include, effectiveFlavour) as
      | ExtendedWalkerOptions<T>["include"]
      | undefined,
    select: (options as any).select,
    where: (options as any).where,
    omit: (options as any).omit,
    includeRelationsByDefault: (options as any).includeRelationsByDefault,
    maxRecursion: (options as any).maxRecursion ?? walkerOptions?.maxRecursion,
  };

  const extract = (iri: string): T =>
    applyIncludeOrderBy(
      extractFromGraph<T>(
        iri,
        dataset,
        schema,
        extractionOptions,
        defaultPrefix,
      ),
      include,
      useExtractionSlicing,
    );

  if (Array.isArray(entityIRIs) && entityIRIs.length > 0) {
    return entityIRIs.map(extract);
  }

  if (typeof entityIRIs === "string") {
    return [extract(entityIRIs)];
  }

  const subjectIRIs = dataset.match(
    null,
    rdf.type,
    QUERY_RESULT_SUBJECT_IRI_NODE,
  );
  const results: T[] = [];
  for (const quad of subjectIRIs) {
    results.push(extract(quad.subject.value));
  }
  return results;
}

/**
 * New safe SPARQL CONSTRUCT query builder that operates on normalized schemas
 *
 * Key features:
 * - Works on normalized schemas (all $refs resolved)
 * - Uses @tpluscode/sparql-builder for safe query construction
 * - Prevents injection attacks through proper escaping
 * - Supports pagination with query-stage marking
 * - Cache-friendly design (normalized schemas can be reused)
 */

import {
  sparql,
  SparqlTemplateResult,
  SELECT,
} from "@tpluscode/sparql-builder";
import { rdf } from "@tpluscode/rdf-ns-builders";
import { JSONSchema7 } from "json-schema";
import { isJSONSchema } from "@graviola/json-schema-utils";
import type { NormalizedSchema } from "@graviola/edb-graph-traversal";
import type {
  Prefixes,
  OrderByClause,
  PaginationMetadata,
  GraphTraversalFilterOptions,
  SPARQLFlavour,
} from "@graviola/edb-core-types";
import df from "@rdfjs/data-model";
import type { Variable } from "@rdfjs/types";
import get from "lodash-es/get";
import { convertIRIToNode, createBindOrValuesPattern } from "@/utils";
import {
  isNilOrEmpty,
  OptionalStringOrStringArray,
  QUERY_RESULT_SUBJECT_IRI_NODE,
} from "@/base";
import { filterToSparql } from "@/filters/filterToSparql";
import type { FilterContext } from "@/filters/types";

/**
 * Context for query construction
 * Carries all necessary state through the recursion
 * Similar to ExtractionContext in graph-traversal
 */
export type QueryConstructionContext = {
  /** The current schema being processed */
  schema: NormalizedSchema;
  /** Filter options (select, include, omit, where) carried through recursion */
  filterOptions: GraphTraversalFilterOptions;
  /** SPARQL dialect for BIND/VALUES and filter generation */
  flavour: SPARQLFlavour;
  /** Prefix mappings for property names */
  prefixMap: Prefixes;
  /** Current recursion depth */
  depth: number;
  /** Maximum recursion depth */
  maxRecursion: number;
  /** Properties to exclude from the query */
  excludedProperties: string[];
  /** Max depth at which inverse (x-inverseOf) properties are resolved. Default 0 = root only. */
  resolveInverseMaxDepth: number;
  /**
   * Shared mutable counter for generating globally unique SPARQL variable names.
   * Wrapped in an object so the reference is preserved across recursive calls.
   */
  varCounter: { value: number };
};

/**
 * Result of CONSTRUCT query generation
 */
export type ConstructResult = {
  /** CONSTRUCT clause patterns */
  constructPatterns: SparqlTemplateResult[];
  /** WHERE clause patterns */
  wherePatterns: SparqlTemplateResult[];
  /**
   * Pagination metadata for arrays with source marked as "query"
   * This indicates pagination was applied at the SPARQL query stage
   */
  paginationMetadata: Map<string, PaginationMetadata & { source: "query" }>;
};

/**
 * Tree structure for WHERE clause patterns
 * Allows proper nesting of OPTIONAL blocks
 */
export type WherePart = OptionalWherePart | RequiredWherePart;

export type OptionalWherePart = {
  required: false;
  whereTemplates: SparqlTemplateResult[];
  children?: WherePart[];
};

export type RequiredWherePart = {
  required: true;
  whereTemplates: SparqlTemplateResult[];
  children?: WherePart[];
};

/**
 * Type guard to check if a WherePart is optional
 */
function isOptional(part: WherePart): part is OptionalWherePart {
  return part.required === false;
}

/**
 * Type guard to check if a WherePart is required
 */
function isRequired(part: WherePart): part is RequiredWherePart {
  return part.required === true;
}

/**
 * Helper function to create an OPTIONAL WHERE pattern
 * Makes code more readable by clearly indicating optional patterns
 */
function createOptionalWherePattern(
  pattern: SparqlTemplateResult,
): SparqlTemplateResult {
  return sparql`OPTIONAL { ${pattern} }`;
}

/**
 * Helper function to create a required WHERE pattern
 * For consistency with createOptionalWherePattern, though this is just a pass-through
 */
function createRequiredWherePattern(
  pattern: SparqlTemplateResult,
): SparqlTemplateResult {
  return pattern;
}

/**
 * Helper function to add a pattern to WHERE clause based on whether it's required
 */
function addWherePattern(
  wherePatterns: SparqlTemplateResult[],
  pattern: SparqlTemplateResult,
  isRequired: boolean,
): void {
  wherePatterns.push(
    isRequired
      ? createRequiredWherePattern(pattern)
      : createOptionalWherePattern(pattern),
  );
}

/**
 * Materialize WHERE tree structure into properly nested SPARQL patterns
 *
 * This function converts the tree structure of WhereParts into a flat array
 * of SparqlTemplateResults with proper nesting of OPTIONAL blocks.
 *
 * Key behaviors:
 * - Required parts: patterns added directly, children processed recursively
 * - Optional parts: all patterns and children wrapped in single OPTIONAL block
 * - Preserves semantic nesting from schema hierarchy
 *
 * @param parts - Array of WherePart nodes to materialize
 * @param indentLevel - Current indentation level (for debugging/readability)
 * @returns Flat array of properly nested SPARQL patterns
 */
function materializeWhereParts(
  parts: WherePart[],
  indentLevel: number = 0,
): SparqlTemplateResult[] {
  const results: SparqlTemplateResult[] = [];

  for (const part of parts) {
    if (isRequired(part)) {
      // Required: Add patterns directly without OPTIONAL wrapper
      results.push(...part.whereTemplates);

      // Recursively add children
      if (part.children && part.children.length > 0) {
        results.push(...materializeWhereParts(part.children, indentLevel));
      }
    } else {
      // Optional: Wrap patterns and children in single OPTIONAL block
      const childPatterns: SparqlTemplateResult[] = [];

      // Add this level's patterns first
      childPatterns.push(...part.whereTemplates);

      // Then add nested children (which may contain their own OPTIONALs)
      if (part.children && part.children.length > 0) {
        childPatterns.push(
          ...materializeWhereParts(part.children, indentLevel + 1),
        );
      }

      // Combine all into single OPTIONAL block
      if (childPatterns.length > 0) {
        // Create combined pattern for all child patterns
        const combined = childPatterns.reduce((acc, pattern, idx) => {
          if (idx === 0) return pattern;
          return sparql`${acc}\n${pattern}`;
        }, childPatterns[0]);

        results.push(sparql`OPTIONAL { ${combined} }`);
      }
    }
  }

  return results;
}

/**
 * Type for nested filter options object (from IncludePattern)
 */
type NestedFilterOptions = {
  include?: any;
  select?: any;
  omit?: any;
  where?: any;
  skip?: number;
  take?: number;
  orderBy?: any;
};

/**
 * Type guard to check if a value is a nested filter options object (not boolean)
 */
function isNestedFilterOptions(value: unknown): value is NestedFilterOptions {
  return typeof value === "object" && value !== null;
}

/**
 * Extract nested filter options from include value
 * Uses lodash get for safe property access
 */
function extractNestedFilterOptions(
  includeValue: unknown,
): Partial<GraphTraversalFilterOptions> {
  if (!isNestedFilterOptions(includeValue)) {
    return {};
  }

  return {
    include: get(includeValue, "include"),
    select: get(includeValue, "select"),
    omit: get(includeValue, "omit"),
    where: get(includeValue, "where"),
  };
}

/**
 * True if this include value or any nested `include` subtree has a `where` clause.
 * Used to promote the relationship traversal to a required WHERE spine (not OPTIONAL),
 * so filters actually constrain the solution set instead of living only inside OPTIONAL.
 */
function hasFilterInSubtree(includeValue: unknown): boolean {
  if (typeof includeValue !== "object" || includeValue === null) {
    return false;
  }
  if ("where" in includeValue) {
    return true;
  }
  const nested = (includeValue as NestedFilterOptions).include;
  if (!nested || typeof nested !== "object") {
    return false;
  }
  return Object.values(nested).some((v) => hasFilterInSubtree(v));
}

/**
 * Keys that `filterToSparql` interprets as operators at the top level — not Prisma field names.
 */
const FILTER_WHERE_TOP_LEVEL_OPERATORS = new Set([
  "equals",
  "not",
  "in",
  "notIn",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "startsWith",
  "endsWith",
  "some",
  "every",
  "none",
  "AND",
  "OR",
  "NOT",
  "mode",
]);

/**
 * True for a single operator bag (`{ gte: 21 }`, `{ AND: [...] }`), false for
 * Prisma-style object filters (`{ age: { gte: 21 }, email: { contains: "x" } }`).
 */
function isOperatorOnlyWhereClause(where: Record<string, unknown>): boolean {
  const keys = Object.keys(where);
  if (keys.length === 0) {
    return true;
  }
  return keys.every((k) => FILTER_WHERE_TOP_LEVEL_OPERATORS.has(k));
}

/**
 * Apply `include.<rel>.where` when it lists fields of the related item (same shape as top-level `where`).
 */
function applyFieldKeyedIncludeWhere(
  whereClause: Record<string, unknown>,
  relatedSubjectVar: Variable,
  itemSchema: JSONSchema7,
  ctx: QueryConstructionContext,
  flavour: SPARQLFlavour,
): { patterns: SparqlTemplateResult[]; filters: SparqlTemplateResult[] } {
  const patterns: SparqlTemplateResult[] = [];
  const filters: SparqlTemplateResult[] = [];
  const itemProps =
    itemSchema.type === "object" && itemSchema.properties
      ? itemSchema.properties
      : {};

  for (const [fieldName, fieldFilter] of Object.entries(whereClause)) {
    if (FILTER_WHERE_TOP_LEVEL_OPERATORS.has(fieldName)) {
      continue;
    }

    const nestedPred = createPredicate(fieldName, ctx.prefixMap);
    const nestedVar = createUniqueVar(fieldName, ctx);
    const nestedPropSchema = itemProps[fieldName];
    const nestedSchemaType =
      nestedPropSchema &&
      typeof nestedPropSchema === "object" &&
      nestedPropSchema !== null
        ? (nestedPropSchema as JSONSchema7).type
        : undefined;

    const nestedFilterContext: FilterContext = {
      subject: relatedSubjectVar,
      property: fieldName,
      propertyVar: nestedVar,
      predicateNode: nestedPred,
      schemaType: nestedSchemaType as string | undefined,
      prefixMap: ctx.prefixMap,
      flavour,
      depth: ctx.depth,
      schema:
        nestedPropSchema && typeof nestedPropSchema === "object"
          ? (nestedPropSchema as JSONSchema7)
          : undefined,
    };

    const filterResult = filterToSparql(fieldFilter, nestedFilterContext);
    patterns.push(...filterResult.patterns);
    filters.push(...filterResult.filters);
  }

  return { patterns, filters };
}

/**
 * Build nested query construction context with filter options
 * Increments depth and applies nested filter options
 */
function createNestedContext(
  ctx: QueryConstructionContext,
  propertyName: string,
  nestedSchema?: NormalizedSchema,
): QueryConstructionContext {
  const includeValue = ctx.filterOptions.include?.[propertyName];
  const nestedFilterOptions: Partial<GraphTraversalFilterOptions> =
    extractNestedFilterOptions(includeValue);

  return {
    ...ctx,
    schema: nestedSchema || ctx.schema,
    filterOptions: {
      ...ctx.filterOptions,
      ...nestedFilterOptions,
    },
    depth: ctx.depth + 1,
  };
}

/**
 * Normalize orderBy to array format
 * Converts single object or array of objects to consistent array format
 * Example: { name: 'asc' } => [{ name: 'asc' }]
 */
function normalizeOrderBy(
  orderBy: OrderByClause | OrderByClause[] | undefined,
): OrderByClause[] {
  if (!orderBy) {
    return [];
  }
  return Array.isArray(orderBy) ? orderBy : [orderBy];
}

/**
 * Check if pagination has orderBy specified
 * Important: For blank nodes (unnamed nodes), orderBy is required for consistent pagination
 */
function hasOrderBy(paginationMeta: any): boolean {
  return paginationMeta && paginationMeta.orderBy !== undefined;
}

/**
 * Create a paginated SUBSELECT with ORDER BY for array relationships
 *
 * Uses the SPARQL query builder's SELECT to build a proper SUBSELECT.
 * The SUBSELECT:
 * 1. Selects the array items with proper ordering
 * 2. Applies LIMIT and OFFSET for pagination
 * 3. Includes necessary properties for ORDER BY
 *
 * Example output:
 * {
 *   SELECT ?friend WHERE {
 *     <subject> :friends ?friend .
 *     OPTIONAL { ?friend :name ?name }
 *   }
 *   ORDER BY ?name
 *   LIMIT 10
 *   OFFSET 5
 * }
 *
 * @param subject - The subject node
 * @param predicate - The property predicate
 * @param objectVar - Variable for the array items
 * @param itemSchema - Schema for array items
 * @param paginationMeta - Pagination metadata with orderBy, take, skip
 * @param ctx - Query construction context
 * @returns SPARQL SUBSELECT query using SELECT builder
 */
function createPaginatedSubselect(
  subject: any,
  predicate: any,
  objectVar: any,
  itemSchema: JSONSchema7,
  paginationMeta: any,
  ctx: QueryConstructionContext,
): SparqlTemplateResult {
  // Start with SELECT builder - select the object variable (dots required by SPARQL syntax)
  let query = SELECT`${objectVar}`
    .WHERE`${subject} ${predicate} ${objectVar} .`;

  // Track ORDER BY property variables so we can reuse them between WHERE and ORDER BY
  const orderByVars = new Map<string, Variable>();

  if (paginationMeta.orderBy) {
    const normalized = normalizeOrderBy(paginationMeta.orderBy);

    for (const clause of normalized) {
      for (const property of Object.keys(clause)) {
        const propPredicate = createPredicate(property, ctx.prefixMap);
        const propVar = createUniqueVar(property, ctx);
        orderByVars.set(property, propVar);

        query = query.WHERE`OPTIONAL { ${objectVar} ${propPredicate} ${propVar} . }`;
      }
    }
  }

  if (paginationMeta.orderBy) {
    const normalized = normalizeOrderBy(paginationMeta.orderBy);
    let orderBuilder = query.ORDER();

    for (let i = 0; i < normalized.length; i++) {
      const clause = normalized[i];
      for (const [property, order] of Object.entries(clause)) {
        if (!order) continue;

        const propVar = orderByVars.get(property);
        if (!propVar) continue;
        const isDesc = order === "desc";

        if (i === 0 && Object.keys(clause).indexOf(property) === 0) {
          query = orderBuilder.BY(propVar, isDesc);
        } else {
          query = (query as any).THEN.BY(propVar, isDesc);
        }
      }
    }
  }

  // Apply LIMIT if specified
  if (paginationMeta.take !== undefined) {
    query = query.LIMIT(paginationMeta.take);
  }

  // Apply OFFSET if specified
  if (paginationMeta.skip !== undefined && paginationMeta.skip > 0) {
    query = query.OFFSET(paginationMeta.skip);
  }

  // Return the query - when used in a WHERE clause, it will automatically be wrapped in { }
  return query as any as SparqlTemplateResult;
}

/**
 * Generate SPARQL CONSTRUCT query from a normalized schema
 *
 *
 * @param subjectIRI - The IRI(s) of the subject(s) to construct (single IRI or array of IRIs) or undefined/null to construct all subjects
 * @param typeIRIs - The IRI(s) of the type(s) to construct (single IRI or array of IRIs) or undefined/null to construct all types
 * @param normalizedSchema - Schema with all $refs resolved
 * @param options - Optional configuration
 * @returns CONSTRUCT and WHERE patterns with metadata
 */
export function normalizedSchema2construct(
  subjectIRI: OptionalStringOrStringArray,
  typeIRIs: OptionalStringOrStringArray | undefined,
  normalizedSchema: NormalizedSchema,
  options?: {
    excludedProperties?: string[];
    maxRecursion?: number;
    resolveInverseMaxDepth?: number;
    prefixMap?: Prefixes; // Prefix mappings (e.g., { "foaf": "http://xmlns.com/foaf/0.1/" })
    filterOptions?: GraphTraversalFilterOptions; // Filter options for nested queries
    flavour?: SPARQLFlavour; // SPARQL flavour for BIND vs VALUES optimization
  },
): ConstructResult {
  // Create query construction context
  const ctx: QueryConstructionContext = {
    schema: normalizedSchema,
    filterOptions: options?.filterOptions || {},
    flavour: options?.flavour || "default",
    prefixMap: options?.prefixMap || {},
    depth: 0,
    maxRecursion: options?.maxRecursion || 4,
    excludedProperties: options?.excludedProperties || [],
    resolveInverseMaxDepth: options?.resolveInverseMaxDepth ?? 0,
    varCounter: { value: 0 },
  };

  const constructPatterns: SparqlTemplateResult[] = [];
  const whereParts: WherePart[] = [];
  const paginationMetadata = new Map<
    string,
    {
      skip?: number;
      take?: number;
      orderBy?: OrderByClause | OrderByClause[];
      source: "query";
    }
  >();

  // Create subject variable
  const subjectVar = df.variable("subject");

  if (!isNilOrEmpty(subjectIRI)) {
    // Use BIND or VALUES pattern to bind subject IRI(s) to variable
    // This handles both single and multiple subjects efficiently
    const subjectBindPattern = createBindOrValuesPattern(
      subjectIRI,
      subjectVar,
      {
        flavour: options?.flavour,
        prefixMap: options?.prefixMap,
      },
    );

    // Add the BIND/VALUES pattern as required WHERE part
    whereParts.push({
      required: true,
      whereTemplates: [subjectBindPattern],
    });
  }

  // Use subject variable instead of concrete node
  const subject = subjectVar;

  // Add rdf:type pattern
  const typeVar = df.variable("type");
  const typePattern = sparql`${subject} ${rdf.type} ${typeVar} .`;

  if (!isNilOrEmpty(typeIRIs)) {
    const typeBindPattern = createBindOrValuesPattern(typeIRIs, typeVar, {
      flavour: options?.flavour,
      prefixMap: options?.prefixMap,
    });
    // Type with VALUES is required
    whereParts.push({
      required: true,
      whereTemplates: [typeBindPattern, typePattern],
    });
  } else {
    // Type without VALUES is optional
    whereParts.push({
      required: false,
      whereTemplates: [typePattern],
    });
  }
  constructPatterns.push(typePattern);

  //mark each subject as graviola:QueryResultSubject (construct pattern)
  const queryResultSubjectPattern = sparql`${subject} ${rdf.type} ${QUERY_RESULT_SUBJECT_IRI_NODE} .`;
  constructPatterns.push(queryResultSubjectPattern);

  // Walk through schema properties
  if (normalizedSchema.properties) {
    Object.entries(normalizedSchema.properties).forEach(
      ([propertyName, propertySchema]) => {
        // Skip explicitly excluded properties
        // Note: JSON-LD metadata properties (@id, @type, etc.) should already be
        // filtered out during schema normalization (via excludeJsonLdMetadata flag)
        if (ctx.excludedProperties.includes(propertyName)) {
          return;
        }

        if (!isJSONSchema(propertySchema)) {
          return; // Skip boolean schemas
        }

        // Create property patterns
        const propertyPatterns = createPropertyPatterns(
          subject,
          propertyName,
          propertySchema as JSONSchema7,
          ctx,
        );

        constructPatterns.push(...propertyPatterns.construct);
        whereParts.push(...propertyPatterns.whereParts);

        // Apply top-level WHERE filters to main entity properties
        // Check if there's a where clause for this property at the top level
        const topLevelWhereClause = ctx.filterOptions.where?.[propertyName];
        if (topLevelWhereClause && propertyPatterns.objectVar) {
          const predicate = createPredicate(propertyName, ctx.prefixMap);

          const filterContext: FilterContext = {
            subject: subject,
            property: propertyName,
            propertyVar: propertyPatterns.objectVar,
            predicateNode: predicate,
            schemaType:
              typeof propertySchema !== "boolean"
                ? ((propertySchema as JSONSchema7).type as string)
                : undefined,
            prefixMap: ctx.prefixMap,
            flavour: ctx.flavour,
            depth: ctx.depth,
            schema:
              typeof propertySchema !== "boolean"
                ? (propertySchema as JSONSchema7)
                : undefined,
          };

          const filterResult = filterToSparql(
            topLevelWhereClause,
            filterContext,
          );

          // Add top-level filter as required WHERE part
          const filterPatterns: SparqlTemplateResult[] = [
            ...filterResult.patterns,
            ...filterResult.filters,
          ];

          if (filterPatterns.length > 0) {
            whereParts.push({
              required: true,
              whereTemplates: filterPatterns,
            });
          }
        }

        // Collect pagination metadata if present
        if (propertyPatterns.pagination) {
          // Mark with source: "query" to tell extractor not to paginate again
          paginationMetadata.set(propertyName, {
            ...propertyPatterns.pagination,
            source: "query", // Critical: prevents double-pagination!
          });
        }
      },
    );
  }

  // Materialize WHERE parts into properly nested patterns
  const wherePatterns = materializeWhereParts(whereParts);

  return {
    constructPatterns,
    wherePatterns,
    paginationMetadata,
  };
}

/**
 * Parse x-inverseOf inverseOf string to get the inverse property path (e.g. ["groups"] from "#/definitions/Person/properties/groups").
 * Used so WHERE matches triples stored on the other side (e.g. ?person :groups ?group) while CONSTRUCT still outputs subject :members object.
 */
function getInversePathFromAnnotation(
  propertySchema: JSONSchema7,
): string[] | null {
  const inverseOf = (
    propertySchema as { "x-inverseOf"?: { inverseOf: string[] } }
  )["x-inverseOf"]?.inverseOf;
  if (!inverseOf?.[0]) return null;
  const parts = inverseOf[0].split("/");
  const idx =
    parts.indexOf("definitions") !== -1
      ? parts.indexOf("definitions") + 1
      : parts.indexOf("$defs") + 1;
  if (idx === 0) return null;
  const path = parts.slice(idx).filter((p) => p !== "properties");
  const typeName = path.shift();
  if (!typeName || path.length === 0) return null;
  return path;
}

/**
 * Create SPARQL patterns for a single property
 */
function createPropertyPatterns(
  subject: any,
  propertyName: string,
  propertySchema: JSONSchema7,
  ctx: QueryConstructionContext,
): {
  construct: SparqlTemplateResult[];
  whereParts: WherePart[];
  pagination?: any;
  objectVar?: Variable;
} {
  const construct: SparqlTemplateResult[] = [];
  const whereParts: WherePart[] = [];

  // Stop if max recursion reached
  if (ctx.depth > ctx.maxRecursion) {
    return { construct, whereParts };
  }

  const predicate = createPredicate(propertyName, ctx.prefixMap);
  const objectVar = createUniqueVar(propertyName, ctx);

  // When property has x-inverseOf, triples are stored as (object inversePredicate subject). WHERE must use that pattern; CONSTRUCT still outputs (subject predicate object).
  const inversePath = getInversePathFromAnnotation(propertySchema);
  const useInverseWhere = inversePath != null && inversePath.length > 0;
  const inversePredicate =
    useInverseWhere && inversePath
      ? inversePath.length === 1
        ? createPredicate(inversePath[0], ctx.prefixMap)
        : null
      : null;
  const inverseWherePattern =
    useInverseWhere && inversePredicate
      ? sparql`${objectVar} ${inversePredicate} ${subject} .`
      : null;

  // Skip inverse properties that are deeper than the allowed max depth
  if (useInverseWhere && ctx.depth > ctx.resolveInverseMaxDepth) {
    return { construct, whereParts };
  }

  // Create triple patterns (dots required by SPARQL syntax). CONSTRUCT always uses subject-predicate-object.
  const triplePattern = sparql`${subject} ${predicate} ${objectVar} .`;

  construct.push(triplePattern);

  // WHERE pattern: use inverse when available so we match stored triples (e.g. ?person :groups ?group)
  const whereTriplePattern = inverseWherePattern ?? triplePattern;

  // Handle different property types
  if (propertySchema.type === "array" && propertySchema.items) {
    // Get pagination and where filters from filter options (carried through context)
    const includeValue = ctx.filterOptions.include?.[propertyName];
    const paginationMeta =
      typeof includeValue === "object" && includeValue !== null
        ? {
            skip: includeValue.skip,
            take: includeValue.take,
            orderBy: includeValue.orderBy,
          }
        : undefined;

    // Extract WHERE clause for relationship filtering
    const whereClause =
      typeof includeValue === "object" && includeValue !== null
        ? includeValue.where
        : undefined;

    // Handle array items
    const itemSchema = Array.isArray(propertySchema.items)
      ? propertySchema.items[0]
      : propertySchema.items;

    // Check if we need a SUBSELECT for pagination with ORDER BY
    const needsSubselect =
      paginationMeta &&
      (paginationMeta.take !== undefined || hasOrderBy(paginationMeta));

    const isRequired = ctx.schema.required?.includes(propertyName) || false;
    const relationshipPatterns: SparqlTemplateResult[] = [];

    if (needsSubselect) {
      // Use SUBSELECT for pagination with ORDER BY
      const subselect = createPaginatedSubselect(
        subject,
        predicate,
        objectVar,
        itemSchema as JSONSchema7,
        paginationMeta,
        ctx,
      );
      relationshipPatterns.push(subselect);
    } else {
      // Regular pattern without pagination (use inverse WHERE when x-inverseOf)
      relationshipPatterns.push(whereTriplePattern);
    }

    // Apply WHERE filters for relationship filtering
    if (whereClause && typeof whereClause === "object") {
      const flavour = ctx.flavour;

      if (isOperatorOnlyWhereClause(whereClause as Record<string, unknown>)) {
        const filterContext: FilterContext = {
          subject: subject,
          property: propertyName,
          propertyVar: objectVar,
          predicateNode: predicate,
          schemaType:
            typeof itemSchema !== "boolean"
              ? (itemSchema.type as string)
              : undefined,
          prefixMap: ctx.prefixMap,
          flavour,
          depth: ctx.depth,
          schema: typeof itemSchema !== "boolean" ? itemSchema : undefined,
        };

        const filterResult = filterToSparql(whereClause, filterContext);
        relationshipPatterns.push(...filterResult.patterns);
        relationshipPatterns.push(...filterResult.filters);
      } else if (typeof itemSchema !== "boolean") {
        const { patterns: fieldPatterns, filters: fieldFilters } =
          applyFieldKeyedIncludeWhere(
            whereClause as Record<string, unknown>,
            objectVar,
            itemSchema as JSONSchema7,
            ctx,
            flavour,
          );
        relationshipPatterns.push(...fieldPatterns);
        relationshipPatterns.push(...fieldFilters);
      }
    }

    // Build nested structure for array items
    const nestedWhereParts: WherePart[] = [];
    if (
      typeof itemSchema !== "boolean" &&
      (itemSchema as JSONSchema7).type === "object"
    ) {
      // Array of objects - recurse into nested structure with filter options
      const nestedPatterns = handleNestedObject(
        objectVar,
        itemSchema as JSONSchema7,
        createNestedContext(ctx, propertyName),
      );
      construct.push(...nestedPatterns.construct);
      nestedWhereParts.push(...nestedPatterns.whereParts);
    }
    // For array of primitives, no further recursion needed

    const hasFilterAnywhere =
      whereClause !== undefined || hasFilterInSubtree(includeValue);

    // Create WHERE part with proper nesting
    const wherePart: WherePart = {
      required: isRequired || hasFilterAnywhere,
      whereTemplates: relationshipPatterns,
      children: nestedWhereParts.length > 0 ? nestedWhereParts : undefined,
    };

    return {
      construct,
      whereParts: [wherePart],
      pagination: paginationMeta,
      objectVar,
    };
  } else if (propertySchema.type === "object" && propertySchema.properties) {
    // Handle nested object - recurse into its properties
    const isRequired = ctx.schema.required?.includes(propertyName) || false;

    // Recurse into nested object with filter options
    const nestedPatterns = handleNestedObject(
      objectVar,
      propertySchema,
      createNestedContext(ctx, propertyName),
    );
    construct.push(...nestedPatterns.construct);

    // Create WHERE part with nested children (use inverse WHERE when x-inverseOf)
    const wherePart: WherePart = {
      required: isRequired,
      whereTemplates: [whereTriplePattern],
      children: nestedPatterns.whereParts,
    };

    return { construct, whereParts: [wherePart], objectVar };
  } else {
    // For primitive types (string, number, boolean), create simple WHERE part
    const isRequired = ctx.schema.required?.includes(propertyName) || false;
    const wherePart: WherePart = {
      required: isRequired,
      whereTemplates: [whereTriplePattern],
    };

    return { construct, whereParts: [wherePart], objectVar };
  }
}

/**
 * Handle nested object properties
 */
function handleNestedObject(
  subject: any,
  objectSchema: JSONSchema7,
  ctx: QueryConstructionContext,
): { construct: SparqlTemplateResult[]; whereParts: WherePart[] } {
  const construct: SparqlTemplateResult[] = [];
  const whereParts: WherePart[] = [];

  // Stop if max recursion reached
  if (ctx.depth > ctx.maxRecursion) {
    return { construct, whereParts };
  }

  const typeVar = createUniqueVar("__type", ctx);
  const nestedTypePattern = sparql`${subject} ${rdf.type} ${typeVar} .`;
  construct.push(nestedTypePattern);

  // Type pattern is always optional
  const typeWherePart: OptionalWherePart = {
    required: false,
    whereTemplates: [nestedTypePattern],
  };
  whereParts.push(typeWherePart);

  // Create a minimal NormalizedSchema for nested property processing
  // This allows createPropertyPatterns to check for required properties
  const nestedNormalizedSchema: NormalizedSchema = {
    ...objectSchema,
    _normalized: true,
  };

  // Walk through nested properties
  if (objectSchema.properties) {
    Object.entries(objectSchema.properties).forEach(
      ([nestedPropName, nestedPropSchema]) => {
        // Note: JSON-LD metadata properties should already be filtered during normalization
        if (!isJSONSchema(nestedPropSchema)) {
          return; // Skip boolean schemas
        }

        // Use createPropertyPatterns to handle all property types (including arrays with pagination)
        const nestedPatterns = createPropertyPatterns(
          subject,
          nestedPropName,
          nestedPropSchema as JSONSchema7,
          {
            ...ctx,
            schema: nestedNormalizedSchema,
          },
        );

        construct.push(...nestedPatterns.construct);
        whereParts.push(...nestedPatterns.whereParts);
      },
    );
  }

  return { construct, whereParts };
}

/**
 * Create a predicate node from a property name
 *
 * Uses the shared convertIRIToNode utility for consistent IRI handling.
 *
 * @param propertyName - The property name from the schema
 * @param prefixMap - Prefix mappings (e.g., { "foaf": "http://xmlns.com/foaf/0.1/" })
 * @returns Predicate for SPARQL pattern
 */
function createPredicate(propertyName: string, prefixMap: Prefixes): any {
  return convertIRIToNode(propertyName, prefixMap);
}

/**
 * Sanitize variable name to be valid in SPARQL
 * Only allow alphanumeric and underscore
 */
function sanitizeVariableName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!/^[a-zA-Z]/.test(cleaned)) return `var_${cleaned}`;
  return cleaned;
}

/**
 * Single gateway for creating SPARQL variables with globally unique names.
 * Always routes through df.variable() to prevent injection from weird schema property names.
 */
function createUniqueVar(
  name: string,
  ctx: QueryConstructionContext,
): Variable {
  return df.variable(`${sanitizeVariableName(name)}_${ctx.varCounter.value++}`);
}

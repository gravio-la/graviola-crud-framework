import type { JSONSchema7 } from "json-schema";
import ds from "@rdfjs/data-model";
import { rdf } from "@tpluscode/rdf-ns-builders";
import type clownface from "clownface";
import type { ExtractionContext } from "./types";
import { expandPropertyName } from "./expandPropertyName";
import { extractLiteral } from "./extractLiteral";

/**
 * Type guard to check if a value is a nested filter options object (not boolean)
 */
function isNestedFilterOptions(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extract nested filter options from include value
 * Removes pagination properties (take, skip, orderBy, _stage) and returns only filter options
 */
function extractNestedFilterOptions(
  includeValue: boolean | Record<string, any> | undefined,
): Record<string, any> {
  if (!includeValue || includeValue === true) {
    return {};
  }
  if (isNestedFilterOptions(includeValue)) {
    // Extract only the filter-related properties (not pagination)
    const { take, skip, orderBy, _stage, ...filterOptions } = includeValue;
    return filterOptions;
  }
  return {};
}

/**
 * Build nested extraction context with filter options
 */
function buildNestedContext(
  ctx: ExtractionContext,
  nestedFilterOptions: Record<string, any>,
): ExtractionContext {
  return {
    ...ctx,
    options: { ...ctx.options, ...nestedFilterOptions },
    depth: ctx.depth + 1,
  };
}

/**
 * Extracts properties from an object node recursively following the schema structure
 *
 * This is the core recursive extractor that walks through object properties.
 * Since the schema is normalized (no $refs), we just follow the schema structure.
 * The depth is controlled by the schema itself - when we reach a stub (only @id property),
 * we stop recursing.
 *
 * @param node The RDF node to extract from
 * @param schema The normalized schema for this object
 * @param ctx Extraction context
 * @returns Extracted object with properties
 */
export function extractObject(
  node: clownface.GraphPointer,
  schema: JSONSchema7,
  ctx: ExtractionContext,
): Record<string, any> | undefined {
  const { baseIRI, context, options, logger, depth } = ctx;

  // Check depth limits
  if (options.maxRecursion !== undefined && depth > options.maxRecursion) {
    logger.debug("Max recursion depth reached", { depth });
    return undefined;
  }

  // Initialize result object
  let result: Record<string, any> = {};

  // Handle NamedNode - extract @id
  if (node.term?.termType === "NamedNode") {
    result["@id"] = node.term.value;

    // Check doNotRecurseNamedNodes option - if set and depth > 0, return just @id
    if (options.doNotRecurseNamedNodes && depth > 0) {
      logger.debug("Stopping recursion at NamedNode", {
        iri: node.term.value,
        depth,
      });
      return result;
    }
  }

  // Extract @type if present
  const typeNode = node.out(rdf.type);
  if (typeNode.value) {
    result["@type"] = typeNode.value;
  }

  // If schema only has @id property, it's a stub - return early
  if (
    schema.properties &&
    Object.keys(schema.properties).length === 1 &&
    "@id" in schema.properties
  ) {
    logger.debug("Reached schema stub", { nodeId: result["@id"] });
    return result;
  }

  // Extract properties according to schema
  if (!schema.properties) {
    return result;
  }

  for (const [propertyName, propSchema] of Object.entries(schema.properties)) {
    // Skip @id and @type as they're handled above
    if (propertyName === "@id" || propertyName === "@type") {
      continue;
    }

    if (typeof propSchema === "boolean") {
      continue; // Skip boolean schemas
    }

    // Expand property name to full IRI
    const expandedProp = expandPropertyName(propertyName, baseIRI, context);
    const propertyNode = node.out(ds.namedNode(expandedProp));

    // Extract value based on schema type
    const value = extractPropertyValue(
      propertyNode,
      propSchema as JSONSchema7,
      propertyName,
      ctx,
    );

    // Only include defined values
    if (value !== undefined) {
      result[propertyName] = value;
    }
  }

  // Apply omitEmpty options (don't count @id and @type)
  const meaningfulKeys = Object.keys(result).filter(
    (k) => k !== "@id" && k !== "@type",
  );
  if (options.omitEmptyObjects && meaningfulKeys.length === 0) {
    return undefined;
  }

  return result;
}

/**
 * Extracts a single property value based on its schema type
 *
 * @param node The property node (clownface pointer with dataset context)
 * @param schema The property schema
 * @param propertyName The name of the property being extracted (for nested filter lookup)
 * @param ctx Extraction context
 * @returns The extracted value
 */
function extractPropertyValue(
  node: clownface.GraphPointer,
  schema: JSONSchema7,
  propertyName: string,
  ctx: ExtractionContext,
): any {
  const { logger } = ctx;

  // Handle array type
  if (schema.type === "array") {
    return extractArrayProperty(node, schema, propertyName, ctx);
  }

  // Handle object type (nested object)
  if (schema.type === "object" || schema.properties) {
    // For single object properties, clownface may return multiple pointers
    // We take the first one (most common case: single relationship)
    const firstPointer = node.toArray()[0];

    if (!firstPointer) {
      return undefined;
    }

    // Extract nested filter options for this property
    const includeValue = ctx.options.include?.[propertyName];
    const nestedFilterOptions = extractNestedFilterOptions(includeValue);

    // Extract from the first pointer, which maintains dataset context
    // Pass nested filter options through context
    return extractObject(
      firstPointer,
      schema,
      buildNestedContext(ctx, nestedFilterOptions),
    );
  }

  // Handle primitive types (string, number, boolean, etc.)
  return extractLiteral(node as any, schema, ctx);
}

/**
 * Extracts an array property with optional pagination
 *
 * IMPORTANT: Pagination can occur at two stages:
 * 1. Query stage: SPARQL CONSTRUCT with LIMIT/OFFSET (dataset already paginated)
 * 2. Extraction stage: In-memory pagination during graph walk
 *
 * We check the pagination source to avoid double-paginating!
 *
 * @param node The property node (clownface pointer with multiple values)
 * @param schema The array schema
 * @param propertyName The name of the property being extracted (for filter lookup)
 * @param ctx Extraction context
 * @returns Array of extracted values
 */
function extractArrayProperty(
  node: clownface.GraphPointer,
  schema: JSONSchema7,
  propertyName: string,
  ctx: ExtractionContext,
): any[] | undefined {
  const { logger, options } = ctx;

  // Check if node has any values
  if (!node.values || node.values.length === 0) {
    return options.omitEmptyArrays ? undefined : [];
  }

  // Get pagination from filter options (carried through context)
  const includeValue = options.include?.[propertyName];
  const paginationOptions = isNestedFilterOptions(includeValue)
    ? (includeValue as any)
    : undefined;

  // Determine if we should apply pagination at extraction stage.
  // When `orderBy` is set, sorting + slicing happen in `applyIncludeOrderBy` after
  // the full array is extracted — do not slice pointers here.
  const shouldPaginate =
    paginationOptions &&
    (paginationOptions.take !== undefined ||
      paginationOptions.skip !== undefined) &&
    (!paginationOptions._stage || paginationOptions._stage === "extraction") &&
    paginationOptions.orderBy === undefined;

  let itemsToExtract: clownface.GraphPointer[];

  // Collect all pointers
  const allPointers: clownface.GraphPointer[] = [];
  node.forEach((pointer) => {
    allPointers.push(pointer);
  });

  if (shouldPaginate) {
    const { skip = 0, take } = paginationOptions;

    itemsToExtract = allPointers.slice(skip, take ? skip + take : undefined);

    logger.debug("Applying pagination at extraction stage", {
      total: allPointers.length,
      skip,
      take,
      processing: itemsToExtract.length,
    });
  } else {
    if (paginationOptions?._stage === "query") {
      logger.debug(
        "Pagination already applied at query stage, skipping extraction pagination",
        {
          total: node.values.length,
        },
      );
    }

    itemsToExtract = allPointers;
  }

  // Determine item schema
  if (!schema.items || typeof schema.items === "boolean") {
    // No item schema - return values as-is
    return itemsToExtract.map((pointer) => pointer.value);
  }

  const itemSchema = Array.isArray(schema.items)
    ? schema.items[0]
    : schema.items;

  if (!itemSchema || typeof itemSchema === "boolean") {
    return itemsToExtract.map((pointer) => pointer.value);
  }

  // Extract nested filter options for array items
  const nestedFilterOptions = extractNestedFilterOptions(includeValue);

  // Extract each item according to its schema
  // Each pointer maintains the clownface dataset context
  const items = itemsToExtract
    .map((itemPointer) => {
      if (
        (itemSchema as JSONSchema7).type === "object" ||
        (itemSchema as JSONSchema7).properties
      ) {
        // For objects, extract recursively with nested filter options
        return extractObject(
          itemPointer,
          itemSchema as JSONSchema7,
          buildNestedContext(ctx, nestedFilterOptions),
        );
      } else {
        // For primitives, use extractLiteral
        return extractLiteral(itemPointer, itemSchema as JSONSchema7, ctx);
      }
    })
    .filter((item) => item !== undefined);

  return options.omitEmptyArrays && items.length === 0 ? undefined : items;
}

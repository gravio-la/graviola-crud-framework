/**
 * Partial entity update via targeted DELETE/INSERT SPARQL query.
 *
 * Uses the same safe SPARQL construction style as normalizedSchema2construct:
 * - sparql`` template strings for injection-safe query fragments
 * - df.variable() via createUniqueVar for globally unique variable names
 * - convertIRIToNode for proper prefix handling of property predicates
 */

import type { Prefixes, SPARQLCRUDOptions } from "@graviola/edb-core-types";
import {
  isJSONSchema,
  resolveSchema,
  validatePatchData,
} from "@graviola/json-schema-utils";
import { dataset2NTriples, jsonld2DataSet } from "@graviola/jsonld-utils";
import {
  sparql,
  SparqlTemplateResult,
  DELETE,
} from "@tpluscode/sparql-builder";
import df from "@rdfjs/data-model";
import { JSONSchema7, JSONSchema7Definition } from "json-schema";

import { buildQueryWithPrefixAndGraph } from "@/crud/makeSPARQLWherePart";
import { exists } from "@/crud/exists";
import { convertIRIToNode, createUniqueVar } from "@/utils";
import type { VarCounterContext } from "@/utils";

export type PatchOptions = SPARQLCRUDOptions & {
  jsonldContext?: object | string;
};

/**
 * Context for patch query construction.
 * Extends VarCounterContext for unique variable generation.
 */
type PatchContext = VarCounterContext & {
  /** Prefix mappings for property names */
  prefixMap: Prefixes;
};

const resolvePropertySchema = (
  propSchema: JSONSchema7Definition,
  rootSchema: JSONSchema7,
): JSONSchema7 | undefined => {
  if (!isJSONSchema(propSchema)) return undefined;
  if (propSchema.$ref) {
    const resolved = resolveSchema(propSchema, "", rootSchema);
    return resolved && isJSONSchema(resolved as JSONSchema7Definition)
      ? (resolved as JSONSchema7)
      : undefined;
  }
  return propSchema;
};

/**
 * Determines if a schema represents an entity reference (has @id property)
 * vs an inline/blank node object. Follows the same convention as
 * isRelationshipSchema() in graph-traversal.
 */
const isEntityReferenceSchema = (schema: JSONSchema7): boolean =>
  !!(schema.properties && "@id" in schema.properties);

/**
 * Create a predicate node from a property name using the shared IRI converter.
 */
function createPredicate(propertyName: string, prefixMap: Prefixes) {
  return convertIRIToNode(propertyName, prefixMap);
}

/**
 * Generates DELETE/WHERE patterns for a nested object (blank node), recursively
 * deleting all triples of the blank node based on the schema structure.
 *
 * For shallow merge, we only generate patterns for schema properties that are
 * present in the patch data — unmentioned properties are preserved.
 *
 * @param dataKeys - The property names from the patch data (used to scope shallow merge)
 */
function generateNestedDeletePatterns(
  subjectVar: ReturnType<typeof df.variable>,
  propertyName: string,
  dataKeys: string[],
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
  ctx: PatchContext,
): {
  deletePatterns: SparqlTemplateResult[];
  wherePatterns: SparqlTemplateResult[];
} {
  const deletePatterns: SparqlTemplateResult[] = [];
  const wherePatterns: SparqlTemplateResult[] = [];
  const predicate = createPredicate(propertyName, ctx.prefixMap);
  const objectVar = createUniqueVar(`patch_${propertyName}`, ctx);

  // We need to find the existing blank node first
  wherePatterns.push(
    sparql`OPTIONAL { ${subjectVar} ${predicate} ${objectVar} .`,
  );

  // Iterate over schema properties that are present in the patch data
  const schemaProps = schema.properties || {};
  for (const nestedKey of dataKeys) {
    if (nestedKey.startsWith("@")) continue;
    if (!(nestedKey in schemaProps)) continue;

    const nestedPredicate = createPredicate(nestedKey, ctx.prefixMap);
    const nestedVar = createUniqueVar(`patch_${nestedKey}`, ctx);

    const nestedSchema = resolvePropertySchema(
      schemaProps[nestedKey],
      rootSchema,
    );
    if (
      nestedSchema &&
      (nestedSchema.type === "object" || nestedSchema.properties) &&
      !isEntityReferenceSchema(nestedSchema)
    ) {
      // Recurse into nested blank node object
      // For deeper nesting, we use all schema properties (full replace at depth > 1)
      const nestedDataKeys = Object.keys(nestedSchema.properties || {});
      const nested = generateNestedDeletePatterns(
        objectVar,
        nestedKey,
        nestedDataKeys,
        nestedSchema,
        rootSchema,
        ctx,
      );
      deletePatterns.push(...nested.deletePatterns);
      wherePatterns.push(...nested.wherePatterns);
      continue;
    }

    // Leaf property or entity reference: delete old value
    wherePatterns.push(
      sparql`OPTIONAL { ${objectVar} ${nestedPredicate} ${nestedVar} . }`,
    );
    deletePatterns.push(sparql`${objectVar} ${nestedPredicate} ${nestedVar} .`);
  }

  wherePatterns.push(sparql`}`); // Close the outer OPTIONAL

  return { deletePatterns, wherePatterns };
}

/**
 * Generates DELETE/WHERE patterns for a property based on its schema definition.
 * For scalars/references/arrays: simple triple pattern.
 * For nested objects (blank nodes): recursive schema-driven patterns.
 *
 * @param dataKeys - For nested objects, the property names from the patch data (for shallow merge at top level)
 */
function generateDeletePatterns(
  subjectVar: ReturnType<typeof df.variable>,
  propertyName: string,
  dataKeys: string[] | undefined,
  propSchema: JSONSchema7 | undefined,
  rootSchema: JSONSchema7,
  ctx: PatchContext,
): {
  deletePatterns: SparqlTemplateResult[];
  wherePatterns: SparqlTemplateResult[];
} {
  const predicate = createPredicate(propertyName, ctx.prefixMap);
  const oldVar = createUniqueVar(`patch_old_${propertyName}`, ctx);

  // Nested object (blank node) with shallow merge — determined by schema, not value
  if (
    propSchema &&
    (propSchema.type === "object" || propSchema.properties) &&
    !isEntityReferenceSchema(propSchema)
  ) {
    // Use data keys for shallow merge at top level, falling back to all schema properties
    const keysToDelete = dataKeys || Object.keys(propSchema.properties || {});
    return generateNestedDeletePatterns(
      subjectVar,
      propertyName,
      keysToDelete,
      propSchema,
      rootSchema,
      ctx,
    );
  }

  // Scalar, entity reference, array, or null: delete all old values for this predicate
  return {
    deletePatterns: [sparql`${subjectVar} ${predicate} ${oldVar} .`],
    wherePatterns: [
      sparql`OPTIONAL { ${subjectVar} ${predicate} ${oldVar} . }`,
    ],
  };
}

/**
 * Partially update specific properties of an entity using a targeted DELETE/INSERT SPARQL query.
 *
 * Unlike `save()` which replaces the entire document, `patch()` only modifies
 * the specified properties. Nested objects use shallow merge (only the specified
 * sub-properties are updated, unmentioned ones are preserved).
 *
 * @param entityIRI - IRI of the entity to patch
 * @param typeIRI - Type IRI (for existence check)
 * @param data - Object with property names as keys and new values
 * @param schema - JSON Schema for the entity type (already brought to top)
 * @param updateFetch - Function to execute SPARQL UPDATE queries
 * @param askFetch - Function to execute SPARQL ASK queries (for existence check)
 * @param options - SPARQL options (prefix, graph, build options)
 */
export const patch = async (
  entityIRI: string,
  typeIRI: string,
  data: Record<string, unknown>,
  schema: JSONSchema7,
  updateFetch: (query: string) => Promise<any>,
  askFetch: (query: string) => Promise<boolean>,
  options: PatchOptions,
): Promise<void> => {
  const { defaultPrefix, queryBuildOptions, validator } = options;
  const prefixMap = queryBuildOptions?.prefixes || {};

  // Filter out JSON-LD metadata
  const dataKeys = Object.keys(data).filter((k) => !k.startsWith("@"));

  if (dataKeys.length === 0) {
    return; // Nothing to patch
  }

  // Validate data against schema (delegates type/format checks to validator if present)
  const validationErrors = validatePatchData(
    data,
    schema,
    undefined,
    validator,
  );
  if (validationErrors.length > 0) {
    throw new Error(
      `Patch validation failed: ${validationErrors.map((e) => `${e.property}: ${e.message}`).join("; ")}`,
    );
  }

  // Check entity exists
  const entityExists = await exists(entityIRI, typeIRI, askFetch);
  if (!entityExists) {
    throw new Error(`Entity does not exist: ${entityIRI} (type: ${typeIRI})`);
  }

  const ctx: PatchContext = {
    varCounter: { value: 0 },
    prefixMap,
  };

  const subjectNode = df.namedNode(entityIRI);
  const allDeletePatterns: SparqlTemplateResult[] = [];
  const allWherePatterns: SparqlTemplateResult[] = [];

  // We need a variable alias for the subject in delete/where patterns
  // because generateDeletePatterns works with variables for recursion.
  // For the top-level entity, we use the concrete IRI directly via a bound variable.
  const subjectVar = df.variable("patch_subject");
  allWherePatterns.push(sparql`BIND(${subjectNode} AS ${subjectVar})`);

  // Collect non-null entries for INSERT
  const insertData: Record<string, unknown> = {};

  for (const key of dataKeys) {
    const value = data[key];
    const propSchema = schema.properties?.[key];
    const resolved = propSchema
      ? resolvePropertySchema(propSchema, schema)
      : undefined;

    // For nested objects, extract the data keys for shallow merge
    const nestedDataKeys =
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.keys(value).filter((k) => !k.startsWith("@"))
        : undefined;

    const { deletePatterns, wherePatterns } = generateDeletePatterns(
      subjectVar,
      key,
      nestedDataKeys,
      resolved,
      schema,
      ctx,
    );

    allDeletePatterns.push(...deletePatterns);
    allWherePatterns.push(...wherePatterns);

    // Collect non-null values for INSERT
    if (value !== null) {
      insertData[key] = value;
    }
  }

  // Build the INSERT triples using the JSON-LD pipeline
  let insertTriples = "";
  if (Object.keys(insertData).length > 0) {
    const jsonldContext: Record<string, unknown> = { "@vocab": defaultPrefix };

    // Add prefix mappings to the JSON-LD context so prefixed properties resolve correctly
    for (const [prefix, iri] of Object.entries(prefixMap)) {
      jsonldContext[prefix] = iri;
    }

    const partialDoc: Record<string, unknown> = {
      "@id": entityIRI,
      ...insertData,
      "@context": jsonldContext,
    };
    const ds = await jsonld2DataSet(partialDoc);
    const allTriples = await dataset2NTriples(ds);

    insertTriples = allTriples;
  }

  // Combine SparqlTemplateResult arrays into single template results
  const deleteClause = allDeletePatterns.reduce(
    (acc, pattern) => sparql`${acc}\n${pattern}`,
    sparql``,
  );
  const whereClause = allWherePatterns.reduce(
    (acc, pattern) => sparql`${acc}\n${pattern}`,
    sparql``,
  );

  // Build the combined query using the builder
  let query;
  if (insertTriples) {
    query = DELETE`${deleteClause}`.INSERT`${insertTriples}`
      .WHERE`${whereClause}`;
  } else {
    // Only deleting (all values are null)
    query = DELETE`${deleteClause}`.WHERE`${whereClause}`;
  }

  const builtQuery = buildQueryWithPrefixAndGraph(
    defaultPrefix,
    options.defaultUpdateGraph,
    query,
    queryBuildOptions,
    queryBuildOptions?.sparqlFlavour,
  );

  try {
    await updateFetch(builtQuery);
  } catch (e) {
    throw new Error("Failed to execute partial update - SPARQL UPDATE failed", {
      cause: e,
    });
  }
};

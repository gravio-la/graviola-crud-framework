import { SPARQLCRUDOptions, SchemaValidator } from "@graviola/edb-core-types";
import {
  isJSONSchema,
  resolveSchema,
  validatePatchData,
} from "@graviola/json-schema-utils";
import { dataset2NTriples, jsonld2DataSet } from "@graviola/jsonld-utils";
import { DELETE, INSERT } from "@tpluscode/sparql-builder";
import { JSONSchema7, JSONSchema7Definition } from "json-schema";

import {
  buildQueryWithPrefixAndGraph,
  makeSPARQLWherePart,
} from "@/crud/makeSPARQLWherePart";
import { exists } from "@/crud/exists";

export type PatchOptions = SPARQLCRUDOptions & {
  jsonldContext?: object | string;
  /** Optional schema validator facade (e.g. AJV). When absent, only structural checks are performed. */
  validator?: SchemaValidator;
};

const makePrefixed = (key: string) => (key.includes(":") ? key : `:${key}`);

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
 * Determines if a value represents an entity reference (has @id) vs an inline/blank node object.
 */
const isEntityReference = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "@id" in value &&
  typeof (value as Record<string, unknown>)["@id"] === "string";

/**
 * Generates DELETE patterns for a nested object (blank node), recursively
 * deleting all triples of the blank node based on the schema structure.
 *
 * For shallow merge, we only generate patterns for the properties being set,
 * not all properties of the nested object.
 */
const generateNestedDeletePatterns = (
  subjectVar: string,
  propertyName: string,
  value: Record<string, unknown>,
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
  varCounter: { value: number },
): { deletePatterns: string[]; wherePatterns: string[] } => {
  const deletePatterns: string[] = [];
  const wherePatterns: string[] = [];
  const predicate = makePrefixed(propertyName);
  const objectVar = `?_patch_${propertyName}_${varCounter.value++}`;

  // We need to find the existing blank node first
  wherePatterns.push(`OPTIONAL { ${subjectVar} ${predicate} ${objectVar} .`);

  // For each property in the value, generate delete patterns for old values
  for (const [nestedKey, nestedValue] of Object.entries(value)) {
    if (nestedKey.startsWith("@")) continue;

    const nestedPredicate = makePrefixed(nestedKey);
    const nestedVar = `?_patch_${nestedKey}_${varCounter.value++}`;

    if (
      typeof nestedValue === "object" &&
      nestedValue !== null &&
      !Array.isArray(nestedValue) &&
      !isEntityReference(nestedValue) &&
      schema.properties?.[nestedKey]
    ) {
      const nestedSchema = resolvePropertySchema(
        schema.properties[nestedKey],
        rootSchema,
      );
      if (
        nestedSchema &&
        (nestedSchema.type === "object" || nestedSchema.properties)
      ) {
        // Recursively handle deeper nesting
        const nested = generateNestedDeletePatterns(
          objectVar,
          nestedKey,
          nestedValue as Record<string, unknown>,
          nestedSchema,
          rootSchema,
          varCounter,
        );
        deletePatterns.push(...nested.deletePatterns);
        wherePatterns.push(...nested.wherePatterns);
        continue;
      }
    }

    // Leaf property: delete old value
    wherePatterns.push(
      `OPTIONAL { ${objectVar} ${nestedPredicate} ${nestedVar} . }`,
    );
    deletePatterns.push(`${objectVar} ${nestedPredicate} ${nestedVar} .`);
  }

  wherePatterns.push(`}`); // Close the outer OPTIONAL

  return { deletePatterns, wherePatterns };
};

/**
 * Generates DELETE patterns for a property.
 * For scalars/references: simple triple pattern.
 * For nested objects: recursive schema-driven patterns.
 * For arrays: delete all old values for the predicate.
 */
const generateDeletePatterns = (
  subjectVar: string,
  propertyName: string,
  value: unknown,
  propSchema: JSONSchema7 | undefined,
  rootSchema: JSONSchema7,
  varCounter: { value: number },
): { deletePatterns: string[]; wherePatterns: string[] } => {
  const predicate = makePrefixed(propertyName);
  const oldVar = `?_patch_old_${propertyName}_${varCounter.value++}`;

  // Nested object (blank node) with shallow merge
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !isEntityReference(value) &&
    propSchema &&
    (propSchema.type === "object" || propSchema.properties)
  ) {
    return generateNestedDeletePatterns(
      subjectVar,
      propertyName,
      value as Record<string, unknown>,
      propSchema,
      rootSchema,
      varCounter,
    );
  }

  // Scalar, reference, array, or null: delete all old values for this predicate
  return {
    deletePatterns: [`${subjectVar} ${predicate} ${oldVar} .`],
    wherePatterns: [`OPTIONAL { ${subjectVar} ${predicate} ${oldVar} . }`],
  };
};

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

  const varCounter = { value: 0 };
  const allDeletePatterns: string[] = [];
  const allWherePatterns: string[] = [];

  // Collect non-null entries for INSERT
  const insertData: Record<string, unknown> = {};

  for (const key of dataKeys) {
    const value = data[key];
    const propSchema = schema.properties?.[key];
    const resolved = propSchema
      ? resolvePropertySchema(propSchema, schema)
      : undefined;

    const { deletePatterns, wherePatterns } = generateDeletePatterns(
      `<${entityIRI}>`,
      key,
      value,
      resolved,
      schema,
      varCounter,
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
    const partialDoc: Record<string, unknown> = {
      "@id": entityIRI,
      ...insertData,
      "@context": { "@vocab": defaultPrefix },
    };
    const ds = await jsonld2DataSet(partialDoc);
    const allTriples = await dataset2NTriples(ds);

    // Filter out rdf:type triples — we don't want to re-insert the type
    insertTriples = allTriples
      .split("\n")
      .filter(
        (line) =>
          !line.includes("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      )
      .join("\n");
  }

  // Build the combined query
  const deleteClause = allDeletePatterns.join("\n");
  const whereClause = allWherePatterns.join("\n");

  let query: any;
  if (insertTriples) {
    query = DELETE` ${deleteClause} `.INSERT` ${insertTriples} `
      .WHERE` ${whereClause} `;
  } else {
    // Only deleting (all values are null)
    query = DELETE` ${deleteClause} `.WHERE` ${whereClause} `;
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

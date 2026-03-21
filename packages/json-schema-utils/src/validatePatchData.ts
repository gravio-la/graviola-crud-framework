import { JSONSchema7, JSONSchema7Definition } from "json-schema";

import { isJSONSchema, isPrimitive } from "./jsonSchema";
import { resolveSchema } from "./resolver";

export type PatchValidationError = {
  property: string;
  message: string;
  expectedType?: string;
  actualType?: string;
};

const getActualType = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
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

const validateValue = (
  propertyPath: string,
  value: unknown,
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
): PatchValidationError[] => {
  const errors: PatchValidationError[] = [];

  // null means "delete property" — always valid
  if (value === null) return errors;

  const schemaType = schema.type as string | undefined;

  if (schemaType === "array") {
    if (!Array.isArray(value)) {
      errors.push({
        property: propertyPath,
        message: `expected array, got ${getActualType(value)}`,
        expectedType: "array",
        actualType: getActualType(value),
      });
      return errors;
    }
    // Validate each element against items schema
    if (schema.items && isJSONSchema(schema.items as JSONSchema7Definition)) {
      const itemSchema = resolvePropertySchema(
        schema.items as JSONSchema7Definition,
        rootSchema,
      );
      if (itemSchema) {
        for (let i = 0; i < value.length; i++) {
          errors.push(
            ...validateValue(
              `${propertyPath}[${i}]`,
              value[i],
              itemSchema,
              rootSchema,
            ),
          );
        }
      }
    }
    return errors;
  }

  if (schemaType === "object" || schema.properties) {
    if (typeof value !== "object" || Array.isArray(value)) {
      errors.push({
        property: propertyPath,
        message: `expected object, got ${getActualType(value)}`,
        expectedType: "object",
        actualType: getActualType(value),
      });
      return errors;
    }
    // For objects with @id, it's an entity reference — skip property validation
    if (
      typeof value === "object" &&
      value !== null &&
      "@id" in value &&
      typeof (value as Record<string, unknown>)["@id"] === "string"
    ) {
      return errors;
    }
    // Validate nested properties (shallow merge context)
    if (schema.properties) {
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (key.startsWith("@")) continue; // skip JSON-LD metadata
        const nestedPropSchema = schema.properties[key];
        if (nestedPropSchema === undefined) {
          errors.push({
            property: `${propertyPath}.${key}`,
            message: `property does not exist in schema`,
          });
          continue;
        }
        const resolved = resolvePropertySchema(nestedPropSchema, rootSchema);
        if (resolved) {
          errors.push(
            ...validateValue(
              `${propertyPath}.${key}`,
              obj[key],
              resolved,
              rootSchema,
            ),
          );
        }
      }
    }
    return errors;
  }

  if (isPrimitive(schemaType)) {
    const actual = getActualType(value);
    if (schemaType === "string" && actual !== "string") {
      errors.push({
        property: propertyPath,
        message: `expected string, got ${actual}`,
        expectedType: "string",
        actualType: actual,
      });
    } else if (schemaType === "number" && actual !== "number") {
      errors.push({
        property: propertyPath,
        message: `expected number, got ${actual}`,
        expectedType: "number",
        actualType: actual,
      });
    } else if (schemaType === "integer") {
      if (actual !== "number") {
        errors.push({
          property: propertyPath,
          message: `expected integer, got ${actual}`,
          expectedType: "integer",
          actualType: actual,
        });
      } else if (!Number.isInteger(value)) {
        errors.push({
          property: propertyPath,
          message: `expected integer, got float`,
          expectedType: "integer",
          actualType: "float",
        });
      }
    } else if (schemaType === "boolean" && actual !== "boolean") {
      errors.push({
        property: propertyPath,
        message: `expected boolean, got ${actual}`,
        expectedType: "boolean",
        actualType: actual,
      });
    }
  }

  return errors;
};

/**
 * Validates mutation/patch data against a JSON Schema.
 * Checks that each property exists in the schema and that value types match.
 *
 * @param data - The patch data to validate (property name -> new value)
 * @param schema - The JSON Schema for the type (should already be brought to top level)
 * @param rootSchema - The root schema for $ref resolution (defaults to schema)
 * @returns Array of validation errors (empty = valid)
 */
export const validatePatchData = (
  data: Record<string, unknown>,
  schema: JSONSchema7,
  rootSchema?: JSONSchema7,
): PatchValidationError[] => {
  const root = rootSchema ?? schema;
  const errors: PatchValidationError[] = [];

  if (!schema.properties) {
    errors.push({
      property: "",
      message: "schema has no properties defined",
    });
    return errors;
  }

  for (const [key, value] of Object.entries(data)) {
    // Skip JSON-LD metadata properties
    if (key.startsWith("@")) continue;

    const propSchema = schema.properties[key];
    if (propSchema === undefined) {
      errors.push({
        property: key,
        message: `property does not exist in schema`,
      });
      continue;
    }

    const resolved = resolvePropertySchema(propSchema, root);
    if (!resolved) {
      // Schema is a boolean (true/false) — skip validation
      continue;
    }

    errors.push(...validateValue(key, value, resolved, root));
  }

  return errors;
};

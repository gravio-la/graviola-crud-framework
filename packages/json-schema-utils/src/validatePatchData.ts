import type { SchemaValidator } from "@graviola/edb-core-types";
import { JSONSchema7, JSONSchema7Definition } from "json-schema";

import { isJSONSchema } from "./jsonSchema";
import { resolveSchema } from "./resolver";

export type PatchValidationError = {
  property: string;
  message: string;
  expectedType?: string;
  actualType?: string;
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
 * Validates a single value against its sub-schema using the validator facade.
 * Walks nested objects/arrays to validate each leaf against its positional sub-schema.
 * If no validator is provided, all values are accepted.
 */
const validateValue = (
  propertyPath: string,
  value: unknown,
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
  validator?: SchemaValidator,
): PatchValidationError[] => {
  const errors: PatchValidationError[] = [];

  // null means "delete property" — always valid
  if (value === null) return errors;

  const schemaType = schema.type as string | undefined;

  // For objects with @id, it's an entity reference — skip property validation
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "@id" in value &&
    typeof (value as Record<string, unknown>)["@id"] === "string"
  ) {
    return errors;
  }

  // For nested objects: walk into sub-properties to validate at leaf level
  if (
    (schemaType === "object" || schema.properties) &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    if (schema.properties) {
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (key.startsWith("@")) continue;
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
              validator,
            ),
          );
        }
      }
    }
    return errors;
  }

  // For arrays: validate each element against items schema
  if (schemaType === "array" && Array.isArray(value)) {
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
              validator,
            ),
          );
        }
      }
    }
    return errors;
  }

  // Leaf value: delegate to the validator facade if present
  if (validator) {
    const valid = validator.validate(schema, value);
    if (!valid && validator.errors?.length) {
      for (const err of validator.errors) {
        errors.push({
          property: propertyPath,
          message:
            err.message ??
            `validation failed against schema at ${propertyPath}`,
        });
      }
    } else if (!valid) {
      errors.push({
        property: propertyPath,
        message: `validation failed against schema at ${propertyPath}`,
      });
    }
  }
  // No validator → accept any value

  return errors;
};

/**
 * Validates mutation/patch data against a JSON Schema.
 * Walks the schema path for each property in the patch data and delegates
 * value validation to the provided SchemaValidator facade.
 *
 * If no validator is provided, only structural checks are performed
 * (property existence in schema). Type/format validation is skipped.
 *
 * @param data - The patch data to validate (property name -> new value)
 * @param schema - The JSON Schema for the type (should already be brought to top level)
 * @param rootSchema - The root schema for $ref resolution (defaults to schema)
 * @param validator - Optional SchemaValidator facade (e.g. AJV instance)
 * @returns Array of validation errors (empty = valid)
 */
export const validatePatchData = (
  data: Record<string, unknown>,
  schema: JSONSchema7,
  rootSchema?: JSONSchema7,
  validator?: SchemaValidator,
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

    errors.push(...validateValue(key, value, resolved, root, validator));
  }

  return errors;
};

import { JSONSchema7 } from "json-schema";
import { resolveSchema } from "./resolver";
import { filterUndefOrNull } from "@graviola/edb-core-utils";

/**
 * Interface for inverse property annotations in JSON Schema
 * Uses the x- prefix to follow JSON Schema vendor extension conventions
 */
export interface InversePropertyAnnotation {
  /**
   * The name of the inverse property
   */
  inverseOf: string[];
  /**
   * Optional description of the inverse relationship
   */
  description?: string;
}

/**
 * Extended JSON Schema type that includes inverse property annotations
 */
export interface JSONSchemaWithInverseProperties extends JSONSchema7 {
  /**
   * Annotation for inverse properties
   * Follows JSON Schema vendor extension pattern with x- prefix
   */
  "x-inverseOf"?: InversePropertyAnnotation;
}

/**
 * Type guard to check if a schema has inverse property annotations
 */
export function hasInversePropertyAnnotation(
  schema: JSONSchema7,
): schema is JSONSchemaWithInverseProperties {
  return (
    schema != null && typeof schema === "object" && "x-inverseOf" in schema
  );
}

/**
 * Extract inverse property annotation from a JSON Schema property
 */
export function getInversePropertyAnnotation(
  schema: JSONSchema7,
): InversePropertyAnnotation | undefined {
  if (hasInversePropertyAnnotation(schema)) {
    return schema["x-inverseOf"];
  }
  return undefined;
}

export type InversePropertyResolution = {
  path: string[];
  typeName: string;
  schema: JSONSchema7 | undefined;
};

export type InversePropertyData = {
  path: string[];
  typeName: string;
  schema: JSONSchema7 | undefined;
  entityIRIs: string[];
};

export const resolveInverseProperties: (
  schema: JSONSchemaWithInverseProperties,
  rootSchema: JSONSchemaWithInverseProperties,
) => InversePropertyResolution[] | null = (schema, rootSchema) => {
  const inverseProperties = schema["x-inverseOf"]?.inverseOf;
  if (!inverseProperties) return null;
  return inverseProperties
    .map((inverseProperty) => {
      //resolve the path
      let path = inverseProperty.split("/");
      //we need to get the key after defintiions or $defs and then the property path
      const index =
        path.indexOf("definitions") !== -1
          ? path.indexOf("definitions") + 1
          : path.indexOf("$defs") + 1;
      path = path.slice(index).filter((p) => p !== "properties");
      const typeName = path.shift();
      if (!typeName) return null;
      const resolvedSubSchema = resolveSchema(
        rootSchema,
        inverseProperty,
        rootSchema,
      );
      return { path, typeName, schema: resolvedSubSchema as JSONSchema7 };
    })
    .filter((p) => p !== null);
};

export const getInverseProperties = (
  rootSchema: JSONSchema7,
  schema: JSONSchema7,
  data: any,
): InversePropertyData[] => {
  if (schema["x-inverseOf"]) {
    const resolvedInverse = resolveInverseProperties(schema, rootSchema);
    if (resolvedInverse) {
      return resolvedInverse.map((inverse) => {
        return {
          path: inverse.path,
          typeName: inverse.typeName,
          schema: inverse.schema,
          entityIRIs: filterUndefOrNull(
            (Array.isArray(data) ? data : [data]).map((d) => d?.["@id"]),
          ),
        };
      });
    }
  }
  if (schema.type === "object" && schema.properties) {
    return Object.entries(schema.properties)
      .map(([key, value]) => {
        return getInverseProperties(
          rootSchema,
          value as JSONSchema7,
          data?.[key],
        );
      })
      .flat();
  }
  if (schema.type === "array" && typeof schema.items === "object") {
    return getInverseProperties(rootSchema, schema.items as JSONSchema7, data);
  }
  return [];
};

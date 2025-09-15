import {
  isJSONSchema,
  isJSONSchemaDefinition,
  JSONSchemaWithInverseProperties,
  resolveInverseProperties,
  resolveSchema,
} from "@graviola/json-schema-utils";
import { Variable } from "@rdfjs/types";
import { JSONSchema7, JSONSchema7Definition } from "json-schema";

const propertiesContainStopSymbol = (
  properties: object,
  stopSymbols: string[],
) => {
  const propKeys = Object.keys(properties);
  for (const stopSymbol of stopSymbols) {
    if (propKeys.includes(stopSymbol)) return true;
  }
  return false;
};

const MAX_RECURSION = 4;
const makePrefixed = (key: string) => (key.includes(":") ? key : `:${key}`);
const makePrefixedProperyPath = (path: string[]) =>
  path.map((key) => makePrefixed(key)).join("/");
const mkSubject = (subjectURI: string) =>
  subjectURI.startsWith("?") ? subjectURI : `<${subjectURI}>`;
export const jsonSchema2construct: (
  subjectURI: string | Variable,
  rootSchema: JSONSchemaWithInverseProperties,
  stopSymbols?: string[],
  excludedProperties?: string[],
  maxRecursion?: number,
) => { whereRequired: string; whereOptionals: string; construct: string } = (
  subjectURI,
  rootSchema,
  stopSymbols = [],
  excludedProperties = [],
  maxRecursion = MAX_RECURSION,
) => {
  let construct = "",
    whereOptionals = "",
    varIndex = 0;
  const whereRequired = "";
  const s = mkSubject(
    typeof subjectURI === "string" ? subjectURI : `?${subjectURI.value}`,
  );
  const propertiesToSPARQLPatterns = (
    sP: string,
    subSchema: JSONSchemaWithInverseProperties,
    level: number,
  ) => {
    if (level > maxRecursion) {
      return;
    }
    if (
      level > 0 &&
      propertiesContainStopSymbol(subSchema.properties || {}, stopSymbols)
    ) {
      return;
    }
    const __type = `?__type_${varIndex++}`;
    whereOptionals += `OPTIONAL { ${sP} a ${__type} . }\n`;
    construct += `${sP} a ${__type} .\n`;
    Object.entries(subSchema.properties || {}).map(([property, schema]) => {
      if (isJSONSchema(schema) && !excludedProperties.includes(property)) {
        const required = subSchema.required?.includes(property),
          p = makePrefixed(property),
          o = `?${property}_${varIndex++}`;

        if (schema["x-inverseOf"]) {
          const resolvedInverse = resolveInverseProperties(schema, rootSchema);
          if (resolvedInverse) {
            resolvedInverse.forEach((inverse) => {
              const ipp = makePrefixedProperyPath(inverse.path);
              if (!required) {
                whereOptionals += `OPTIONAL {\n ${o} ${ipp} ${sP} .\n`;
              } else {
                whereOptionals += `${o} ${ipp} ${sP} .\n`;
              }
              construct += `${sP} ${p} ${o} .\n`;
            });
          }
        } else {
          if (!required) {
            whereOptionals += `OPTIONAL {\n${sP} ${p} ${o} .\n`;
          } else {
            whereOptionals += `${sP} ${p} ${o} .\n`;
          }
          construct += `${sP} ${p} ${o} .\n`;
        }
        if (schema.$ref) {
          const subSchema = resolveSchema(
            schema as JSONSchema7,
            "",
            rootSchema as JSONSchema7,
          );
          if (
            subSchema &&
            subSchema.properties &&
            !propertiesContainStopSymbol(subSchema.properties, stopSymbols)
          ) {
            propertiesToSPARQLPatterns(o, subSchema as JSONSchema7, level + 1);
          }
        } else if (
          schema.properties &&
          !propertiesContainStopSymbol(schema.properties, stopSymbols)
        ) {
          propertiesToSPARQLPatterns(o, schema, level + 1);
        } else if (schema.items) {
          if (
            isJSONSchemaDefinition(schema.items) &&
            isJSONSchema(schema.items) &&
            schema.items.properties &&
            !propertiesContainStopSymbol(schema.items.properties, stopSymbols)
          ) {
            propertiesToSPARQLPatterns(o, schema.items, level + 1);
          }
          if (
            isJSONSchemaDefinition(schema.items) &&
            isJSONSchema(schema.items) &&
            schema.items.$ref
          ) {
            //const ref = schema.items.$ref
            const subSchema = resolveSchema(
              schema.items as JSONSchema7,
              "",
              rootSchema as JSONSchema7,
            );
            if (
              subSchema &&
              isJSONSchemaDefinition(subSchema as JSONSchema7Definition) &&
              isJSONSchema(subSchema as JSONSchema7)
            ) {
              propertiesToSPARQLPatterns(
                o,
                subSchema as JSONSchema7,
                level + 1,
              );
            }
          }
        }
        if (!required) {
          whereOptionals += "}\n";
        }
      }
    });
  };
  propertiesToSPARQLPatterns(s, rootSchema, 0);
  if (
    isJSONSchemaDefinition(rootSchema.items) &&
    isJSONSchema(rootSchema.items) &&
    rootSchema.items.properties
  ) {
    propertiesToSPARQLPatterns(s, rootSchema.items, 0);
  }
  return { construct, whereRequired, whereOptionals };
};

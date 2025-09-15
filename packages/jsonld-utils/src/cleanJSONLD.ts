import type { NamedEntityData, WalkerOptions } from "@graviola/edb-core-types";
import { filterUndefOrNull } from "@graviola/edb-core-utils";
import { traverseGraphExtractBySchema } from "@graviola/edb-graph-traversal";
import datasetFactory from "@rdfjs/dataset";
import type { Dataset } from "@rdfjs/types";
import type { JSONSchema7 } from "json-schema";

import { jsonld2DataSet } from "./jsonld2DataSet";

type Uri = string;
type Language = string;
interface IJsonLdContext {
  "@base"?: Uri | null;
  "@vocab"?: Uri | null;
  "@language"?: Language;
  [id: string]: any;
  "@version"?: number;
}
type JsonLdContext = IJsonLdContext | string | (IJsonLdContext | string)[];

type CleanJSONLDOptions = {
  walkerOptions?: Partial<WalkerOptions>;
  jsonldContext?: JsonLdContext;
  defaultPrefix: string;
  keepContext?: boolean;
  removeInverseProperties?: boolean;
};

export const defaultWalkerOptions: Partial<WalkerOptions> = {
  omitEmptyArrays: true,
  omitEmptyObjects: true,
  maxRecursionEachRef: 2,
  maxRecursion: 3,
  skipAtLevel: 3,
  doNotRecurseNamedNodes: true,
};

export const cleanProperty = (data: any) => {
  return Array.isArray(data)
    ? filterUndefOrNull(data).map(cleanProperty)
    : typeof data === "object" && data !== null
      ? Object.keys(data).reduce((acc, key) => {
          const prop = data[key];
          if (typeof prop === "object") {
            const cleanedProp = cleanProperty(prop);
            if (Array.isArray(cleanedProp) && prop.length === 0) return acc;
            if (
              !Array.isArray(cleanedProp) &&
              cleanedProp !== null &&
              (Object.keys(cleanedProp).length === 0 ||
                (Object.keys(cleanedProp).length === 1 && cleanedProp["@type"]))
            ) {
              return acc;
            }
            return {
              ...acc,
              [key]: cleanedProp,
            };
          }
          return {
            ...acc,
            [key]: prop,
          };
        }, {})
      : data;
};

export const removeInversePropertiesFromSchema = (schema: JSONSchema7) => {
  if (schema.type === "object" && schema.properties) {
    return {
      ...schema,
      properties: Object.fromEntries(
        Object.entries(schema.properties)
          .filter(([key, value]) => !value["x-inverseOf"])
          .map(([key, value]) => [
            key,
            removeInversePropertiesFromSchema(value as JSONSchema7),
          ]),
      ),
    };
  }
  if (schema.type === "array" && typeof schema.items === "object") {
    return {
      ...schema,
      items: removeInversePropertiesFromSchema(schema.items as JSONSchema7),
    };
  }
  return schema;
};

const prepareSchema = (
  schema: JSONSchema7,
  removeInverseProperties?: boolean,
) => {
  if (removeInverseProperties) {
    return removeInversePropertiesFromSchema(schema);
  }
  return schema;
};

export const cleanJSONLD = async (
  data: NamedEntityData,
  schema: JSONSchema7,
  {
    jsonldContext,
    defaultPrefix,
    walkerOptions: walkerOptionsPassed = {},
    keepContext,
    removeInverseProperties,
  }: CleanJSONLDOptions,
) => {
  const entityIRI = data["@id"];
  const walkerOptions = {
    ...defaultWalkerOptions,
    ...walkerOptionsPassed,
  };

  const finalJsonldContext =
    typeof jsonldContext === "object"
      ? {
          ...jsonldContext,
        }
      : {};

  const jsonldDoc = {
    ...cleanProperty(data),
    ...(finalJsonldContext ? { "@context": finalJsonldContext } : {}),
  };

  let ds = datasetFactory.dataset();
  try {
    ds = await jsonld2DataSet(jsonldDoc);
  } catch (e) {
    throw new Error("Cannot convert JSONLD to dataset", { cause: e });
  }
  try {
    const res = traverseGraphExtractBySchema(
      defaultPrefix,
      entityIRI,
      ds as Dataset,
      prepareSchema(schema, removeInverseProperties),
      walkerOptions,
    );
    return keepContext && finalJsonldContext
      ? { ...res, "@context": finalJsonldContext }
      : res;
  } catch (e) {
    throw new Error("Cannot convert JSONLD to document", { cause: e });
  }
};

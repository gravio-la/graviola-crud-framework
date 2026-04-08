import { IRIToStringFn, StringToIRIFn } from "@graviola/edb-core-types";

import { AbstractPrismaClient, PropertiesAndConnects } from "../types";

export const getPropertiesAndConnects = async <
  TPrisma extends AbstractPrismaClient = AbstractPrismaClient,
>(
  typeNameOrigin: string,
  document: any,
  prisma: TPrisma,
  importError: Set<string>,
  prefix: string = "",
  options: {
    IRItoId?: IRIToStringFn;
    typeNameToTypeIRI?: StringToIRIFn;
    typeIsNotIRI?: boolean;
    debug?: boolean;
  },
  middleware?: (
    typeIRI: string | undefined,
    entityIRI: string,
    document: any,
    importError: Set<string>,
  ) => Promise<boolean>,
): Promise<PropertiesAndConnects> => {
  const { id, ...rest } = Object.fromEntries(
    Object.entries(document)
      .filter(([key, value]) => typeof value !== "object")
      .map(([key, value]) => {
        if (key === "@id" && options.IRItoId) {
          return [
            `${prefix}${key.replace("@", "")}`,
            options.IRItoId(value as string),
          ];
        } else if (
          key === "@type" &&
          options.typeIsNotIRI &&
          options.typeNameToTypeIRI
        ) {
          return [
            `${prefix}${key.replace("@", "")}`,
            options.typeNameToTypeIRI(value as string),
          ];
        } else {
          return [`${prefix}${key.replace("@", "")}`, value];
        }
      }),
  );
  let connects: Record<string, { id: string } | { id: string }[]> = {};
  let properties: Record<string, any> = rest;
  const documentObjects = Object.entries(document).filter(
    ([key, value]) => typeof value === "object",
  ) as [string, any];
  for (let [key, value] of documentObjects) {
    if (Array.isArray(value)) {
      const connectsTemp: { id: string }[] = [];
      for (let item of value) {
        if (typeof item["@id"] === "string") {
          if (middleware) {
            const success = await middleware(
              item["@type"],
              item["@id"],
              item,
              importError,
            );
            if (success) connectsTemp.push({ id: item["@id"] });
          } else {
            connectsTemp.push({ id: item["@id"] });
          }
        } else if (typeof item !== "object") {
          // Handle primitive values
          if (!properties[key]) {
            properties[key] = [item];
          } else if (Array.isArray(properties[key])) {
            properties[key].push(item);
          } else {
            properties[key] = [properties[key], item];
          }
        } else {
          //console.log("not implemented")
        }
      }
      if (connectsTemp.length > 0) connects[key] = connectsTemp;
    } else {
      if (typeof value["@id"] === "string") {
        if (middleware) {
          const success = await middleware(
            value["@type"],
            value["@id"],
            value,
            importError,
          );
          if (success) connects[key] = { id: value["@id"] };
        } else {
          connects[key] = { id: value["@id"] };
        }
      } else if (!value["@id"]) {
        const { properties: subProperties, connects: subConnects } =
          await getPropertiesAndConnects(
            typeNameOrigin,
            value,
            prisma,
            importError,
            `${key}_`,
            options,
            middleware,
          );
        properties = {
          ...properties,
          ...subProperties,
        };
        connects = {
          ...connects,
          ...subConnects,
        };
      } else {
        //console.log("not implemented")
      }
    }
  }
  return {
    id: typeof id === "string" ? id : undefined,
    properties,
    connects,
  };
};

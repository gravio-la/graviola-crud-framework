import { IRIToStringFn, StringToIRIFn } from "@graviola/edb-core-types";
import {
  bringDefinitionToTop,
  prepareStubbedSchema,
} from "@graviola/json-schema-utils";
import { cleanJSONLD } from "@graviola/jsonld-utils";
import type { JSONSchema7 } from "json-schema";

import { save } from "./save";
import type { AbstractPrismaClient } from "./types";

function logTree(message: string, debug: boolean, depth: number = 0) {
  if (!debug) return;

  const indent = "  ".repeat(depth);
  console.log(`${indent}${depth > 0 ? "└─ " : ""}${message}`);
}

export interface UpsertOptions<
  TPrisma extends AbstractPrismaClient = AbstractPrismaClient,
> {
  prisma: TPrisma;
  schema: JSONSchema7;
  defaultPrefix: string;
  jsonldContext?: any;
  keepContext?: boolean;
  allowNonTransactionalFallback?: boolean;
  allowUnknownNestedElementCreation?: boolean;
  isAllowedNestedElement?: (element: any) => boolean;
  idToIRI?: StringToIRIFn;
  typeNameToTypeIRI: StringToIRIFn;
  typeIsNotIRI?: boolean;
  typeIRItoTypeName: IRIToStringFn;
  debug?: boolean;
}

interface NestedElement {
  element: any;
  depth: number;
}

async function cleanAndSave<
  TPrisma extends AbstractPrismaClient = AbstractPrismaClient,
>(
  typeName: string,
  doc: any,
  prisma: TPrisma,
  error: Set<string>,
  options: {
    schema: JSONSchema7;
    defaultPrefix: string;
    jsonldContext?: any;
    keepContext?: boolean;
    idToIRI?: StringToIRIFn;
    typeNameToTypeIRI?: StringToIRIFn;
    typeIsNotIRI?: boolean;
    allowNonTransactionalFallback?: boolean;
  },
) {
  const { schema: rootSchema } = options;

  const schema = bringDefinitionToTop(
    prepareStubbedSchema(rootSchema),
    typeName,
  );
  const cleanData = await cleanJSONLD(doc, schema, {
    jsonldContext: options.jsonldContext,
    defaultPrefix: options.defaultPrefix,
    keepContext: options.keepContext,
    pruneLinkedDocuments: true,
  });

  const {
    allowNonTransactionalFallback,
    idToIRI,
    typeNameToTypeIRI,
    typeIsNotIRI,
  } = options;

  await save(typeName, cleanData, prisma, error, {
    idToIRI,
    typeNameToTypeIRI,
    typeIsNotIRI,
    allowNonTransactionalFallback,
  });

  return cleanData;
}

function collectNestedElements(
  doc: any,
  depth: number = 0,
  isAllowedNestedElement?: (element: any) => boolean,
  path: string[] = [],
  debug: boolean = false,
): NestedElement[] {
  if (!doc || typeof doc !== "object") {
    return [];
  }

  const elements: NestedElement[] = [];

  // Handle arrays
  if (Array.isArray(doc)) {
    logTree(`Array[${doc.length}]`, debug, depth);
    for (let i = 0; i < doc.length; i++) {
      elements.push(
        ...collectNestedElements(
          doc[i],
          depth + 1,
          isAllowedNestedElement,
          [...path, `[${i}]`],
          debug,
        ),
      );
    }
    return elements;
  }

  // Check if this is a nested element that needs to be created
  if (doc["@id"] && isAllowedNestedElement?.(doc)) {
    const type = doc["@type"] || "Unknown";
    logTree(`Found ${type} (${doc["@id"]})`, debug, depth);
    elements.push({ element: doc, depth });
  } else if (Object.keys(doc).length > 0) {
    logTree(`Object`, debug, depth);
  }

  // Recursively process all object properties
  for (const [key, value] of Object.entries(doc)) {
    if (typeof value === "object" && value !== null) {
      elements.push(
        ...collectNestedElements(
          value,
          depth + 1,
          isAllowedNestedElement,
          [...path, key],
          debug,
        ),
      );
    }
  }

  return elements;
}

async function createNestedElements<
  TPrisma extends AbstractPrismaClient = AbstractPrismaClient,
>(
  doc: any,
  prisma: TPrisma,
  error: Set<string>,
  options: {
    schema: JSONSchema7;
    defaultPrefix: string;
    jsonldContext?: any;
    keepContext?: boolean;
    idToIRI?: StringToIRIFn;
    typeNameToTypeIRI: StringToIRIFn;
    typeIRItoTypeName: IRIToStringFn;
    typeIsNotIRI?: boolean;
    isAllowedNestedElement?: (element: any) => boolean;
    debug: boolean;
    allowNonTransactionalFallback?: boolean;
  },
) {
  const { typeIRItoTypeName, debug } = options;
  logTree("Starting nested element collection...", debug);
  // First collect all nested elements that need to be created
  const elements = collectNestedElements(
    doc,
    0,
    options.isAllowedNestedElement,
    [],
    debug,
  );

  logTree("Sorting elements by depth...", debug);
  // Sort by depth in descending order (deepest first)
  elements.sort((a, b) => b.depth - a.depth);

  logTree("Creating elements (deepest first):", debug);
  // Create elements from deepest to shallowest
  for (const { element, depth } of elements) {
    try {
      const type = element["@type"];
      if (!type) {
        throw new Error(`No type found for element: ${element["@id"]}`);
      }
      const typeName = typeIRItoTypeName(type);
      logTree(`Creating ${typeName} (${element["@id"]})`, debug, depth);
      await cleanAndSave(typeName, element, prisma, error, options);
      logTree(`✓ Created ${typeName} (${element["@id"]})`, debug, depth);
    } catch (e: unknown) {
      const errorMessage = `Failed to create nested element: ${e instanceof Error ? e.message : String(e)}`;
      logTree(`✗ ${errorMessage}`, debug, depth);
      error.add(errorMessage);
    }
  }
}

export async function upsert<
  TPrisma extends AbstractPrismaClient = AbstractPrismaClient,
>(typeName: string, doc: any, options: UpsertOptions<TPrisma>) {
  const {
    prisma,
    schema: rootSchema,
    jsonldContext,
    defaultPrefix,
    keepContext = false,
    idToIRI,
    typeNameToTypeIRI,
    typeIRItoTypeName,
    typeIsNotIRI,
    allowNonTransactionalFallback,
    allowUnknownNestedElementCreation,
    isAllowedNestedElement,
    debug = false,
  } = options;

  const error = new Set<string>();

  logTree(`Starting upsert for ${typeName}...`, debug);

  // If allowUnknownNestedElementCreation is true, first walk through the document
  // and create any nested elements that have an ID and pass the isAllowedNestedElement check
  if (allowUnknownNestedElementCreation) {
    await createNestedElements(doc, prisma, error, {
      schema: rootSchema,
      defaultPrefix,
      jsonldContext,
      keepContext,
      idToIRI,
      typeNameToTypeIRI,
      typeIRItoTypeName,
      typeIsNotIRI,
      isAllowedNestedElement,
      debug,
      allowNonTransactionalFallback,
    });
  }

  logTree(`Creating main document...`, debug);

  const cleanData = await cleanAndSave(typeName, doc, prisma, error, {
    schema: rootSchema,
    defaultPrefix,
    jsonldContext,
    keepContext,
    idToIRI,
    typeNameToTypeIRI,
    typeIsNotIRI,
    allowNonTransactionalFallback,
  });

  if (error.size > 0) {
    logTree("✗ Errors occurred during processing:", debug);
    error.forEach((err) => logTree(`  ${err}`, debug, 1));
    throw new Error("Error while saving data");
  }

  logTree("✓ Upsert completed successfully", debug);

  return {
    ...(jsonldContext ? { "@context": jsonldContext } : {}),
    ...cleanData,
  };
}

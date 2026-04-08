import { IRIToStringFn, StringToIRIFn } from "@graviola/edb-core-types";
import { AbstractDatastore } from "@graviola/edb-global-types";

import { importDocument } from "./importDocument";
import { startBulkImport } from "./startBulkImport";
import type { AbstractPrismaClient } from "../types";

/**
 * Import all documents of a given type, will either use the iterable implementation if implemented within the importStore implementation
 * or the listDocuments function as a fallback
 * The iterable implementation will have the effect that a progress bar will be displayed
 * @param typeName What type to import
 * @param importStore The store to import from
 * @param prisma The prisma client to import to
 * @param limit The limit of documents to import
 */
export const importAllDocuments = async <
  TPrisma extends AbstractPrismaClient = AbstractPrismaClient,
>(
  typeName: string,
  importStore: AbstractDatastore,
  prisma: TPrisma,
  limit: number = 10000,
  options: {
    IRItoId?: IRIToStringFn;
    typeNameToTypeIRI?: StringToIRIFn;
    typeIsNotIRI?: boolean;
  } = {},
): Promise<any> =>
  importStore.iterableImplementation
    ?.listDocuments(typeName, limit)
    .then(async (result) =>
      startBulkImport(typeName, importStore, prisma, limit, result),
    ) ||
  importStore.listDocuments(typeName, limit, (doc) =>
    importDocument(
      typeName,
      doc,
      importStore,
      prisma,
      new Set(),
      new Set<string>(),
      options,
    ),
  );

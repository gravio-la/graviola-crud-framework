import {
  AbstractDatastore,
  CountAndIterable,
} from "@graviola/edb-global-types";
import cliProgress from "cli-progress";

import { importDocument } from "./importDocument";
import type { AbstractPrismaClient } from "../types";

/**
 * Start the bulk import of a given type
 * WIll import all documents of a given type from the importStore to the prisma store
 * optionally limited by the limit parameter
 * @param typeName the type to import
 * @param importStore the store to import from
 * @param prisma the prisma client to import to
 * @param limit how many documents to import
 * @param result
 */
export const startBulkImport = async <
  TPrisma extends AbstractPrismaClient = AbstractPrismaClient,
>(
  typeName: string,
  importStore: AbstractDatastore,
  prisma: TPrisma,
  limit: number,
  result: CountAndIterable<any>,
) => {
  const visited = new Set<string>();
  const errored = new Set<string>();
  const { amount, iterable: docs } = result;
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(amount, 0);
  for await (let doc of docs) {
    try {
      await importDocument(
        typeName,
        doc,
        importStore,
        prisma,
        visited,
        errored,
      );
    } catch (e) {
      console.error(e);
    }
    bar.increment();
  }
  bar.stop();
};

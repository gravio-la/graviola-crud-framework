import type { PrimaryFieldDeclaration } from "@graviola/edb-core-types";
import type { AbstractDatastore, QueryType } from "@graviola/edb-global-types";
import {
  jsonSchema2PrismaFlatSelect,
  jsonSchema2PrismaSelect,
} from "@graviola/json-schema-prisma-utils";
import { defs } from "@graviola/json-schema-utils";
import type { JSONSchema7 } from "json-schema";

import { toJSONLD } from "./helper";
import { bindings2RDFResultSet } from "./helper/bindings2RDFResultSet";
import { importAllDocuments, importSingleDocument } from "./import";
import type { AbstractPrismaClient, PrismaStoreOptions } from "./types";
import { upsert } from "./upsert";

/** Prisma accepts `mode` on string filters only for some connectors. */
function prismaDatasourceSupportsStringMode(provider: string): boolean {
  const p = provider.toLowerCase();
  return ["postgresql", "postgres", "cockroachdb", "mongodb"].includes(p);
}

type PrismaContainsFilter = {
  contains: string;
  mode?: "insensitive";
};

function buildPrimaryLabelContainsFilter(
  searchString: string,
  likeInsensitive: boolean,
  datasourceProvider: string,
  onCaseSensitiveNotEnforceable: () => void,
): PrismaContainsFilter {
  const supportsMode = prismaDatasourceSupportsStringMode(datasourceProvider);

  if (likeInsensitive !== false) {
    if (supportsMode) {
      return { contains: searchString, mode: "insensitive" };
    } else {
      onCaseSensitiveNotEnforceable();
    }
  }

  return { contains: searchString };
}

/**
 * Initialize a prisma store with the given prisma client
 *
 * The schema and the prisma client must be compatible otherwise the store will not work as expected
 *
 * The store will use the jsonld context to convert the data to jsonld
 *
 *
 * @param prisma The prisma client to be used
 * @param rootSchema The root schema of the data
 * @param primaryFields The primary fields of the data (labels, descriptions, etc.)
 * @param jsonldContext The jsonld context to be used
 * @param options The options to be used
 * @param options.defaultPrefix The default prefix to be used
 * @param options.typeNameToTypeIRI A function to convert a type name to a type IRI
 * @param options.typeIRItoTypeName A function to convert a type IRI to a type name
 * @param options.idToIRI A function to convert an id to an IRI (if empty it is assumed that the id is already an IRI)
 * @param options.IRItoId A function to convert an IRI to an id (if empty it is assumed that the id is already an id)
 * @param options.allowUnknownNestedElementCreation Whether to allow unknown nested elements to be created
 * @param options.isAllowedNestedElement A function to check if a nested element is allowed to be created
 * @param options.datasourceProvider Prisma `datasource db` provider string (e.g. `sqlite`, `postgresql`)
 */
export function initPrismaStore<
  TPrisma extends AbstractPrismaClient = AbstractPrismaClient,
>(
  prisma: TPrisma,
  rootSchema: JSONSchema7,
  primaryFields: Partial<PrimaryFieldDeclaration>,
  {
    jsonldContext,
    defaultPrefix,
    typeNameToTypeIRI,
    typeIRItoTypeName,
    idToIRI,
    IRItoId,
    typeIsNotIRI,
    allowUnknownNestedElementCreation,
    allowNonTransactionalFallback,
    isAllowedNestedElement,
    maxRecursionDepth = 4,
    debug,
    datasourceProvider,
  }: PrismaStoreOptions,
): AbstractDatastore {
  const primarySearchFilter = (
    searchString: string,
    likeInsensitive: boolean,
  ) =>
    buildPrimaryLabelContainsFilter(
      searchString,
      likeInsensitive,
      datasourceProvider,
      () => {
        //TODO: decide what to do here (warn/throw/ignore)
      },
    );
  const toJSONLDWithOptions = (entry: any) => {
    return toJSONLD(entry, new WeakSet(), {
      idToIRI,
      ...(typeIsNotIRI ? { typeNameToTypeIRI } : {}),
    });
  };
  const load = async (typeName: string, entityIRI: string) => {
    const select = jsonSchema2PrismaSelect(typeName, rootSchema, {
      maxRecursion: maxRecursionDepth,
    });
    const entry = await prisma[typeName].findUnique({
      where: {
        id: entityIRI,
      },
      select,
    });
    return toJSONLDWithOptions(entry);
  };

  const loadMany = async (typeName: string, limit?: number) => {
    const select = jsonSchema2PrismaSelect(typeName, rootSchema, {
      maxRecursion: maxRecursionDepth,
    });
    const entries = await prisma[typeName].findMany({
      take: limit,
      select,
    });
    return entries.map(toJSONLDWithOptions);
  };

  const loadManyFlat = async (
    typeName: string,
    queryOptions: QueryType,
    limit?: number,
    innerLimit?: number,
  ) => {
    const query = jsonSchema2PrismaFlatSelect(
      typeName,
      rootSchema,
      primaryFields,
      { takeLimit: innerLimit ?? limit ?? 0 },
    );
    const entries = await prisma[typeName].findMany({
      take: queryOptions.pagination?.pageSize ?? limit,
      skip: queryOptions.pagination?.pageIndex
        ? queryOptions.pagination.pageIndex *
          (queryOptions.pagination.pageSize ?? limit ?? 0)
        : 0,
      ...query,
    });
    return entries;
  };

  const searchMany = async (
    typeName: string,
    searchString: string,
    likeInsensitive: boolean,
    limit?: number,
  ) => {
    const select = jsonSchema2PrismaSelect(typeName, rootSchema, {
      maxRecursion: maxRecursionDepth,
    });
    const prim = primaryFields[typeName];
    if (!prim) {
      throw new Error("No primary field found for type " + typeName);
    }
    const entries = await prisma[typeName].findMany({
      where: {
        [prim.label]: primarySearchFilter(searchString, likeInsensitive),
      },
      take: limit,
      select,
    });
    return entries.map(toJSONLDWithOptions);
  };
  const dataStore: AbstractDatastore = {
    typeNameToTypeIRI: typeNameToTypeIRI,
    typeIRItoTypeName: typeIRItoTypeName,
    importDocument: (typeName, entityIRI, importStore) =>
      importSingleDocument(typeName, entityIRI, importStore, prisma, {
        IRItoId,
        typeNameToTypeIRI,
        typeIsNotIRI,
      }),
    importDocuments: (typeName, importStore, limit) =>
      importAllDocuments(typeName, importStore, prisma, limit, {
        IRItoId,
        typeNameToTypeIRI,
        typeIsNotIRI,
      }),
    loadDocument: async (typeName: string, entityIRI: string) => {
      return load(typeName, IRItoId ? IRItoId(entityIRI) : entityIRI);
    },
    findDocuments: async (typeName, query, limit, cb) => {
      const entries =
        query.search && query.search.length > 0
          ? await searchMany(
              typeName,
              query.search,
              query.insensitive !== false,
              limit,
            )
          : await loadMany(typeName, limit);
      if (cb) {
        for (const entry of entries) {
          await cb(entry);
        }
      }
      return entries;
    },
    existsDocument: async (typeName: string, entityIRI: string) => {
      const entry = await prisma[typeName].findUnique({
        where: {
          id: IRItoId ? IRItoId(entityIRI) : entityIRI,
        },
        select: {
          id: true,
        },
      });
      return Boolean(entry);
    },
    removeDocument: async (typeName: string, entityIRI: string) => {
      return await prisma[typeName].delete({
        where: {
          id: IRItoId ? IRItoId(entityIRI) : entityIRI,
        },
      });
    },
    upsertDocument: async (typeName: string, entityIRI, document: any) => {
      const doc = {
        ...document,
        "@id": entityIRI,
        "@type": typeNameToTypeIRI(typeName),
      };
      return await upsert(typeName, doc, {
        prisma,
        schema: rootSchema,
        jsonldContext,
        defaultPrefix,
        keepContext: false,
        allowUnknownNestedElementCreation,
        allowNonTransactionalFallback,
        isAllowedNestedElement,
        idToIRI,
        typeNameToTypeIRI,
        typeIRItoTypeName,
        typeIsNotIRI,
        debug,
      });
    },
    listDocuments: async (typeName: string, limit: number = 10, cb) => {
      const entries = await loadMany(typeName, limit);
      if (cb) {
        for (const entry of entries) {
          await cb(entry);
        }
      }
      return entries;
    },
    findDocumentsAsFlatResultSet: async (typeName, query, limit) => {
      const bindings = await loadManyFlat(typeName, query, limit, 2);
      return bindings2RDFResultSet(bindings);
    },
    findDocumentsByAuthorityIRI: async (
      typeName,
      authorityIRI,
      repositoryIRI,
      limit,
    ) => {
      const entries = await prisma[typeName].findMany({
        where: {
          idAuthority_id: authorityIRI,
        },
        select: {
          id: true,
        },
        take: limit,
      });

      return entries.map((e) => e.id);
    },
    findDocumentsByLabel: async (typeName, label, limit) => {
      const primaryFieldDeclaration = (primaryFields as any)?.[typeName];
      if (!primaryFieldDeclaration?.label) {
        throw new Error("No primary field found for type " + typeName);
      }
      const ids = await prisma[typeName].findMany({
        where: {
          [primaryFieldDeclaration.label]: label,
        },
        select: {
          id: true,
        },
        take: limit,
      });
      return ids.map((e) => e.id);
    },
    getClasses: async (entityIRI) => {
      //we will use a rather primitive way to get the classes in future we could create its own IRI<->Class index and use a prisma middleware to keep it up to date
      const definitions = defs(rootSchema);
      const allTypeNames = Object.keys(definitions);
      const classes: string[] = [];
      for (const typeName of allTypeNames) {
        try {
          const entry = await prisma[typeName].findUnique({
            where: {
              id: IRItoId ? IRItoId(entityIRI) : entityIRI,
            },
            select: {
              id: true,
            },
          });
          if (entry) {
            classes.push(typeNameToTypeIRI(typeName));
          }
        } catch (e) {
          if (debug) {
            console.error("Error while trying to get class for", e);
          }
        }
      }
      return classes;
    },
    countDocuments: async (typeName: string, query: QueryType = {}) => {
      const prim = primaryFields[typeName];
      if (!prim) {
        throw new Error("No primary field found for type " + typeName);
      }

      if (query.search && query.search.length > 0) {
        return await prisma[typeName].count({
          where: {
            [prim.label]: primarySearchFilter(
              query.search,
              query.insensitive !== false,
            ),
          },
        });
      }

      return await prisma[typeName].count();
    },
  };

  return dataStore;
}

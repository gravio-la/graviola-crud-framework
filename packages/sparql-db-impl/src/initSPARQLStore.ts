import type {
  AbstractDatastore,
  CountAndIterable,
  InitDatastoreFunction,
} from "@graviola/edb-global-types";
import {
  bringDefinitionToTop,
  getInverseProperties,
} from "@graviola/json-schema-utils";
import { cleanJSONLD } from "@graviola/jsonld-utils";
import {
  exists,
  findEntityByAuthorityIRI,
  findEntityByClass,
  getClasses,
  jsonSchema2Select,
  load,
  makeSPARQLInverseSyncQuery,
  remove,
  save,
  searchEntityByLabel,
  withDefaultPrefix,
} from "@graviola/sparql-schema";
import type { JSONSchema7 } from "json-schema";

import type { SPARQLDataStoreConfig } from "./SPARQLDataStoreConfig";

export const initSPARQLStore = (
  dataStoreConfig: SPARQLDataStoreConfig,
): AbstractDatastore => {
  const {
    defaultPrefix,
    jsonldContext,
    typeNameToTypeIRI,
    queryBuildOptions,
    walkerOptions,
    sparqlQueryFunctions: {
      constructFetch,
      selectFetch,
      updateFetch,
      askFetch,
    },
    defaultLimit,
    makeStubSchema,
    schema: rootSchema,
    enableInversePropertiesFeature,
  } = dataStoreConfig;

  const typeIRItoTypeName = queryBuildOptions.typeIRItoTypeName;
  const loadDocument = async (typeName: string, entityIRI: string) => {
    const typeIRI = typeNameToTypeIRI(typeName);
    const schema = bringDefinitionToTop(rootSchema, typeName) as JSONSchema7;
    const res = await load(entityIRI, typeIRI, schema, constructFetch, {
      defaultPrefix,
      queryBuildOptions,
      walkerOptions,
      maxRecursion: walkerOptions?.maxRecursion,
    });
    return res.document;
  };
  const findDocuments = async (
    typeName: string,
    limit?: number,
    searchString?: string | null,
    cb?: (document: any) => Promise<any>,
  ) => {
    const typeIRI = typeNameToTypeIRI(typeName);
    const items = await findEntityByClass(
      searchString || null,
      typeIRI,
      selectFetch,
      { queryBuildOptions, defaultPrefix },
      limit || defaultLimit,
    );
    const results: any[] = [];
    for (const { entityIRI } of items) {
      const doc = await loadDocument(typeName, entityIRI);
      if (cb) {
        results.push(await cb(doc));
      } else {
        results.push(doc);
      }
    }
    return results;
  };
  const findDocumentsIterable: (
    typeName: string,
    limit?: number,
    searchString?: string | null,
  ) => Promise<CountAndIterable<any>> = async (
    typeName: string,
    limit?: number,
    searchString?: string | null,
  ) => {
    const typeIRI = typeNameToTypeIRI(typeName);
    const items = await findEntityByClass(
      searchString || null,
      typeIRI,
      selectFetch,
      { queryBuildOptions, defaultPrefix },
      limit || defaultLimit,
    );
    let currentIndex = 0;
    const asyncIterator = {
      next: () => {
        if (currentIndex >= items.length) {
          return Promise.resolve({ done: true, value: null });
        }
        const entityIRI = items[currentIndex].entityIRI;
        currentIndex++;
        return loadDocument(typeName, entityIRI).then((doc) => {
          return { done: false, value: doc };
        });
      },
    };
    return {
      amount: items.length,
      iterable: {
        [Symbol.asyncIterator]: () => asyncIterator,
      },
    };
  };
  const store: AbstractDatastore = {
    typeNameToTypeIRI,
    typeIRItoTypeName: (iri: string) => iri.replace(defaultPrefix, ""),
    importDocument: async (typeName, entityIRI, importStore) => {
      throw new Error("Not implemented");
    },
    importDocuments: async (typeName, importStore, limit) => {
      throw new Error("Not implemented");
    },
    loadDocument,
    existsDocument: async (typeName, entityIRI) => {
      return await exists(entityIRI, typeNameToTypeIRI(typeName), askFetch);
    },
    removeDocument: async (typeName, entityIRI) => {
      return await remove(
        entityIRI,
        typeNameToTypeIRI(typeName),
        rootSchema,
        updateFetch,
        {
          defaultPrefix,
          queryBuildOptions,
        },
      );
    },
    upsertDocument: async (typeName, entityIRI, document) => {
      const schema = bringDefinitionToTop(
        makeStubSchema ? makeStubSchema(rootSchema) : rootSchema,
        typeName,
      );
      const doc = {
        ...document,
        "@id": entityIRI,
        "@type": typeNameToTypeIRI(typeName),
      };
      const cleanData = await cleanJSONLD(doc, schema, {
        jsonldContext,
        defaultPrefix,
        keepContext: true,
        removeInverseProperties: enableInversePropertiesFeature,
      });
      await save(cleanData, schema, updateFetch, {
        defaultPrefix,
        queryBuildOptions,
      });

      if (enableInversePropertiesFeature) {
        const inverseProperties = getInverseProperties(rootSchema, schema, doc);
        const inversePropertiesWithTypeIRI = inverseProperties.map(
          (inverseProperty) => ({
            ...inverseProperty,
            typeIRI: typeNameToTypeIRI(inverseProperty.typeName),
          }),
        );

        const inversePropertiesSyncQuery = makeSPARQLInverseSyncQuery(
          entityIRI,
          inversePropertiesWithTypeIRI,
          {
            defaultPrefix,
            queryBuildOptions,
          },
        );
        if (inversePropertiesSyncQuery) {
          await updateFetch(inversePropertiesSyncQuery);
        }
      }
      return doc;
    },
    listDocuments: (typeName, limit, cb) =>
      findDocuments(typeName, limit, null, cb),
    findDocuments: (typeName, query, limit, cb) =>
      findDocuments(typeName, limit, query.search, cb),
    findDocumentsByLabel: async (typeName, label, limit = 10) => {
      const typeIRI = typeNameToTypeIRI(typeName);
      const ids = await searchEntityByLabel(
        label,
        typeIRI,
        selectFetch,
        limit,
        {
          defaultPrefix,
          prefixes: queryBuildOptions.prefixes || {},
          ...queryBuildOptions,
          typeIRItoTypeName,
          primaryFields: queryBuildOptions.primaryFields,
        },
      );
      return ids;
    },
    findEntityByTypeName: async (typeName, searchString, limit) => {
      const typeIRI = typeNameToTypeIRI(typeName);
      return await findEntityByClass(
        searchString,
        typeIRI,
        selectFetch,
        {
          defaultPrefix,
          queryBuildOptions,
        },
        limit,
      );
    },
    findDocumentsByAuthorityIRI: async (
      typeName,
      authorityIRI,
      repositoryIRI,
      limit = 10,
    ) => {
      const typeIRI = typeNameToTypeIRI(typeName);
      const ids = await findEntityByAuthorityIRI(
        authorityIRI,
        typeIRI,
        selectFetch,
        limit,
        {
          defaultPrefix,
          prefixes: queryBuildOptions.prefixes || {},
        },
      );
      return ids;
    },
    findDocumentsAsFlatResultSet: async (typeName, query, limit) => {
      const typeIRI = typeNameToTypeIRI(typeName);
      const loadedSchema = bringDefinitionToTop(rootSchema, typeName);
      const { sorting, pagination, fields } = query;
      const queryString = withDefaultPrefix(
        defaultPrefix,
        jsonSchema2Select(
          loadedSchema,
          typeIRI,
          [],
          fields,
          {
            primaryFields: queryBuildOptions.primaryFields,
            ...(sorting && sorting.length > 0
              ? {
                  orderBy: sorting.map((s) => ({
                    orderBy: s.id,
                    descending: Boolean(s.desc),
                  })),
                }
              : {}),
            limit: limit || defaultLimit,
            ...(pagination
              ? {
                  offset: pagination.pageIndex * pagination.pageSize,
                  limit: pagination.pageSize,
                }
              : {}),
          },
          undefined,
          queryBuildOptions.sparqlFlavour,
        ),
      );
      const res = await selectFetch(queryString, {
        withHeaders: true,
      });
      return res;
    },
    countDocuments: async (typeName, query) => {
      const typeIRI = typeNameToTypeIRI(typeName);
      const loadedSchema = bringDefinitionToTop(rootSchema, typeName);
      const queryString = withDefaultPrefix(
        defaultPrefix,
        jsonSchema2Select(
          loadedSchema,
          typeIRI,
          [],
          [],
          undefined,
          true,
          queryBuildOptions.sparqlFlavour,
        ),
      );
      const res = await selectFetch(queryString, {
        withHeaders: true,
      });
      const literalValue = res.results?.bindings[0]?.entity_count?.value;
      if (!literalValue) {
        throw new Error("Cannot find entity_count in query result");
      }
      const amount = parseInt(literalValue);
      if (isNaN(amount)) {
        throw new Error("Invalid count");
      }
      return amount;
    },
    getClasses: (entityIRI) => {
      return getClasses(entityIRI, selectFetch, {
        defaultPrefix,
        queryBuildOptions,
      }).then((classes) => classes || []);
    },
    iterableImplementation: {
      listDocuments: (typeName, limit) => {
        return findDocumentsIterable(typeName, limit, null);
      },
      findDocuments: (typeName, query, limit) => {
        return findDocumentsIterable(typeName, limit, query.search);
      },
    },
  };

  return store;
};

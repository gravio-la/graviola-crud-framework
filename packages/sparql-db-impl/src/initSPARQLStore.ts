import type {
  AbstractDatastore,
  CountAndIterable,
  TypedDocumentFilterOptions,
  TypedDocumentsSearchOptions,
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
  patch,
  remove,
  save,
  searchEntityByLabel,
  withDefaultPrefix,
  filterTypedDocuments,
  type TypedFilterOptions,
  getEntitiesWithClassesByFilter,
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
    defaultUpdateGraph,
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
      const schema = bringDefinitionToTop(rootSchema, typeName) as JSONSchema7;
      return await remove(
        entityIRI,
        typeNameToTypeIRI(typeName),
        schema,
        updateFetch,
        {
          defaultPrefix,
          queryBuildOptions,
          defaultUpdateGraph,
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
        pruneLinkedDocuments: true,
      });
      await save(cleanData, schema, updateFetch, {
        defaultPrefix,
        queryBuildOptions,
        defaultUpdateGraph,
      });

      if (enableInversePropertiesFeature) {
        // Use type schema from rootSchema (not stub) so x-inverseOf and other
        // annotations are preserved for inverse extraction
        const schemaForInverse = bringDefinitionToTop(rootSchema, typeName);
        const inverseProperties = getInverseProperties(
          rootSchema,
          schemaForInverse as JSONSchema7,
          doc,
        );
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
            defaultUpdateGraph,
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
    getEntitiesWithClassesByFilter: async <T = any>(
      options: TypedDocumentsSearchOptions<T> = {},
    ): Promise<Map<string, string[]>> => {
      return await getEntitiesWithClassesByFilter(constructFetch, {
        where: options.where,
        prefixMap: queryBuildOptions.prefixes || {},
        defaultPrefix,
        flavour: queryBuildOptions.sparqlFlavour,
      });
    },
    filterTypedDocument: async <T = any>(
      typeName: string,
      entityIRI: string,
      options: TypedDocumentFilterOptions<T> = {},
    ): Promise<T | null> => {
      const typeIRI = typeNameToTypeIRI(typeName);
      const schema = bringDefinitionToTop(rootSchema, typeName) as JSONSchema7;

      // Map global-types options to sparql-schema-specific options
      const sparqlOptions: TypedFilterOptions<T> = {
        ...options,
        defaultPrefix,
        queryBuildOptions,
      };

      const result = await filterTypedDocuments<T>(
        entityIRI,
        typeIRI,
        schema,
        constructFetch,
        sparqlOptions,
      );
      if (result.length > 1) {
        throw new Error("Multiple documents found for entityIRI");
      } else if (result.length === 1) {
        return result[0];
      } else {
        return null;
      }
    },
    filterTypedDocuments: async <T = any>(
      typeName: string,
      options: TypedDocumentsSearchOptions<T> = {},
    ): Promise<T[]> => {
      const typeIRI = typeNameToTypeIRI(typeName);
      const schema = bringDefinitionToTop(rootSchema, typeName) as JSONSchema7;

      // Map global-types options to sparql-schema-specific options
      const sparqlOptions: TypedFilterOptions<T> = {
        ...options,
        defaultPrefix,
        queryBuildOptions,
      };

      return await filterTypedDocuments<T>(
        undefined,
        typeIRI,
        schema,
        constructFetch,
        sparqlOptions,
      );
    },
    patchDocument: async (typeName, entityIRI, options) => {
      const { data } = options;
      const schema = bringDefinitionToTop(rootSchema, typeName) as JSONSchema7;
      const typeIRI = typeNameToTypeIRI(typeName);

      await patch(entityIRI, typeIRI, data, schema, updateFetch, askFetch, {
        defaultPrefix,
        queryBuildOptions,
        defaultUpdateGraph,
        jsonldContext,
      });

      return {
        entityIRI,
        updatedProperties: Object.keys(data).filter((k) => !k.startsWith("@")),
        success: true,
      };
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

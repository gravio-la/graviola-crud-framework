import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataStore } from "./useDataStore";
import { useAdbContext } from "./provider";
import type { UseCRUDHook } from "./useCrudHook";
import { useCallback } from "react";
import type { NamedAndTypedEntity } from "@graviola/edb-core-types";
import { AbstractDatastore } from "@graviola/edb-global-types";

type LoadResult = {
  document: any;
};

const isDraftDocument = (data: any) => {
  return (
    typeof data["@id"] === "string" &&
    typeof data["@type"] === "string" &&
    data["__draft"] === true
  );
};

/**
 * recurse through the data and find all  documents that contain __draft: true
 * @param data
 * @param depth depth of the recursion
 */
const findDraftDocuments = (data: any, depth: number = 0) => {
  if (data && Array.isArray(data)) {
    return data.flatMap((item) => findDraftDocuments(item, depth + 1));
  }
  if (data && typeof data === "object") {
    return [
      ...(isDraftDocument(data) ? [data] : []),
      ...Object.values(data).flatMap((value) =>
        findDraftDocuments(value, depth + 1),
      ),
    ];
  }
  return [];
};

const storeDraftDocuments: (
  data: any,
  dataStore: AbstractDatastore,
) => Promise<any[]> = async (data: any, dataStore) => {
  const draftDocuments = findDraftDocuments(data);
  const documentsProcessed = [];
  const results = [];
  for (const draftDocument of draftDocuments) {
    if (documentsProcessed.includes(draftDocument["@id"])) {
      continue;
    }
    documentsProcessed.push(draftDocument["@id"]);
    const typeName = dataStore.typeIRItoTypeName(draftDocument["@type"]);
    //delete draftDocument.__draft;
    const result = await dataStore.upsertDocument(
      typeName,
      draftDocument["@id"],
      draftDocument,
    );
    results.push(result);
  }
  return Promise.all(results);
};

// clean empty objects and arrays recursively
const pruneTree = (data: any, depth: number = 0): any => {
  // Handle null, undefined, or primitive values
  if (data === null || data === undefined || typeof data !== "object") {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    const prunedArray = data
      .map((item) => pruneTree(item, depth + 1))
      .filter((item) => {
        // Remove null, undefined, empty arrays, and empty objects
        if (item === null || item === undefined) return false;
        if (Array.isArray(item) && item.length === 0) return false;
        if (
          typeof item === "object" &&
          !Array.isArray(item) &&
          Object.keys(item).length === 0
        )
          return false;
        return true;
      });

    return prunedArray.length === 0 ? [] : prunedArray;
  }

  // Handle objects
  if (typeof data === "object") {
    const prunedObject: any = {};

    for (const [key, value] of Object.entries(data)) {
      const prunedValue = pruneTree(value, depth + 1);

      // Only keep non-empty values
      if (prunedValue !== null && prunedValue !== undefined) {
        if (Array.isArray(prunedValue)) {
          if (prunedValue.length > 0) {
            prunedObject[key] = prunedValue;
          }
        } else if (typeof prunedValue === "object") {
          if (Object.keys(prunedValue).length > 0) {
            prunedObject[key] = prunedValue;
          }
        } else {
          // Keep primitive values (strings, numbers, booleans)
          prunedObject[key] = prunedValue;
        }
      }
    }

    return prunedObject;
  }

  return data;
};

const processResult = (result: any) => {
  return {
    document: pruneTree(result),
  };
};
export const useCRUDWithQueryClient: UseCRUDHook<
  LoadResult,
  boolean,
  void,
  Record<string, any>
> = ({
  entityIRI,
  typeIRI,
  queryOptions,
  loadQueryKey: presetLoadQueryKey,
  allowUnsafeSourceIRIs,
}) => {
  const { createEntityIRI } = useAdbContext();
  const { dataStore, ready } = useDataStore();
  const loadQueryKey = presetLoadQueryKey || "load";
  const { enabled, ...queryOptionsRest } = queryOptions || {};
  const queryClient = useQueryClient();

  const loadQuery = useQuery({
    queryKey: ["entity", entityIRI, typeIRI, loadQueryKey],
    queryFn: async () => {
      if (!entityIRI || !ready) return null;
      const typeName = dataStore.typeIRItoTypeName(typeIRI);
      const result = await dataStore.loadDocument(typeName, entityIRI);
      return processResult(result);
    },
    enabled: Boolean(entityIRI && typeIRI && ready) && enabled,
    refetchOnWindowFocus: false,
    ...queryOptionsRest,
  });

  const removeMutation = useMutation({
    mutationKey: ["remove", entityIRI],
    mutationFn: async () => {
      if (!entityIRI || !ready) {
        throw new Error("entityIRI or updateFetch is not defined");
      }
      const typeName = dataStore.typeIRItoTypeName(typeIRI);
      return await dataStore.removeDocument(typeName, entityIRI);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["type", typeIRI] });
    },
  });

  const saveMutation = useMutation({
    mutationKey: ["save", typeIRI, entityIRI || "create"],
    mutationFn: async (data: Record<string, any>) => {
      if (!Boolean(allowUnsafeSourceIRIs)) {
        if (!typeIRI || !ready) throw new Error("typeIRI not defined");
      }
      const typeName = dataStore.typeIRItoTypeName(typeIRI);
      const _entityIRI = entityIRI || createEntityIRI(typeName);
      const draftDocumentsStored = await storeDraftDocuments(data, dataStore);

      const dataWithType: NamedAndTypedEntity = {
        ...data,
        "@id": _entityIRI,
        "@type": typeIRI,
      } as NamedAndTypedEntity;
      const result = await dataStore.upsertDocument(
        typeName,
        _entityIRI,
        dataWithType,
      );
      const { "@context": context, ...cleanDataWithoutContext } = result;
      return {
        mainDocument: cleanDataWithoutContext,
        draftDocuments: draftDocumentsStored,
      };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["entity", entityIRI] });
      for (const draftDocument of result.draftDocuments) {
        await queryClient.invalidateQueries({
          queryKey: ["entity", draftDocument["@id"]],
        });
      }
    },
  });

  const existsQuery = useQuery({
    queryKey: ["entity", entityIRI, "exists"],
    queryFn: async () => {
      if (!entityIRI || !typeIRI || !ready) return null;
      const typeName = dataStore.typeIRItoTypeName(typeIRI);
      return await dataStore.existsDocument(typeName, entityIRI);
    },
    enabled: Boolean(entityIRI && typeIRI && ready) && enabled,
    refetchOnWindowFocus: false,
    ...queryOptionsRest,
  });

  const loadEntity = useCallback(
    async (entityIRI: string, typeIRI: string) => {
      return queryClient.fetchQuery({
        queryKey: ["entity", entityIRI, typeIRI, loadQueryKey],
        queryFn: async () => {
          const typeName = dataStore.typeIRItoTypeName(typeIRI);
          const result = await dataStore.loadDocument(typeName, entityIRI);
          return processResult(result);
        },
      });
    },
    [loadQueryKey, dataStore.loadDocument, queryClient],
  );

  return {
    loadEntity,
    loadQuery,
    existsQuery,
    removeMutation,
    saveMutation,
  };
};

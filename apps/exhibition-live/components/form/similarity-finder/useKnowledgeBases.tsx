import { useAdbContext, useDataStore } from "@graviola/edb-state-hooks";
import { useMemo } from "react";

import { GND, K10Plus, KBMainDatabase, Wikidata } from "./provider";
import { KnowledgeBaseDescription } from "./types";

export const useKnowledgeBases = () => {
  const { queryBuildOptions, jsonLDConfig } = useAdbContext();
  const { dataStore, ready } = useDataStore();
  const kbs: KnowledgeBaseDescription[] = useMemo(
    () => [
      KBMainDatabase(dataStore, queryBuildOptions.primaryFields),
      Wikidata,
      GND,
      K10Plus,
    ],
    [queryBuildOptions, jsonLDConfig, dataStore, ready],
  );
  return kbs;
};

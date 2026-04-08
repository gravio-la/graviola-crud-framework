import type Yasgui from "@triply/yasgui";
import React, { FunctionComponent, useEffect, useRef } from "react";

import { Prefixes } from "@graviola/edb-core-types";
import { formatSparqlQuerySafe } from "./formatSparqlQuerySafe";
import { YasguiSPARQLEditorProps } from "./YasguiSPARQLEditorProps";
import { patchYasqeQueryToUseCrud } from "./yasqeCrudQuery";

const withPrefixes = (yg: Yasgui, prefixes?: Prefixes) => {
  const yasqe = yg.getTab(yg.persistentConfig.currentId())?.getYasqe();
  prefixes && yasqe?.addPrefixes(prefixes);
  return yg;
};

const setYasqeValue = (yg: Yasgui, query: string | undefined) => {
  if (query === undefined) return;
  const yasqe = yg.getTab(yg.persistentConfig.currentId())?.getYasqe();
  yasqe?.setValue(formatSparqlQuerySafe(query));
};

const YasguiSPARQLEditor: FunctionComponent<YasguiSPARQLEditorProps> = ({
  onInit,
  prefixes,
  containerId = "yasgui",
  initialQuery,
  sparqlCrud,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const yasguiRef = useRef<Yasgui | null>(null);
  const crudRef = useRef(sparqlCrud);
  const onInitRef = useRef(onInit);
  crudRef.current = sparqlCrud;
  onInitRef.current = onInit;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await import("@triply/yasgui/build/yasgui.min.css");
      if (cancelled) return;
      const { default: YasguiCls } = await import("@triply/yasgui");
      if (cancelled) return;
      const el = wrapperRef.current;
      if (!el) return;

      yasguiRef.current?.destroy();
      yasguiRef.current = null;

      const yg = new YasguiCls(el, {
        yasqe: {
          queryingDisabled: undefined,
          showQueryButton: true,
        },
      });
      yasguiRef.current = yg;
      withPrefixes(yg, prefixes);
      patchYasqeQueryToUseCrud(yg, () => crudRef.current ?? null);
      onInitRef.current?.(yg);
      if (initialQuery !== undefined) {
        setYasqeValue(yg, initialQuery);
      }
    })();
    return () => {
      cancelled = true;
      yasguiRef.current?.destroy();
      yasguiRef.current = null;
    };
  }, [containerId, prefixes]);

  useEffect(() => {
    const yg = yasguiRef.current;
    if (yg && initialQuery !== undefined) {
      setYasqeValue(yg, initialQuery);
    }
  }, [initialQuery]);

  return <div id={containerId} ref={wrapperRef} />;
};

export default YasguiSPARQLEditor;

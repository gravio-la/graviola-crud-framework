import { decodeIRI } from "@graviola/edb-core-utils";
import { useAdbContext, useFormEditor } from "@graviola/edb-state-hooks";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Button } from "@mui/material";
import { schema } from "@slub/exhibition-schema";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "next-i18next";
import React, { useEffect, useMemo, useState } from "react";

import TypedForm from "../../../components/content/main/TypedForm";
import { getI18nProps, mixinStaticPathsParams } from "../../../components/i18n";
import { MainLayout } from "../../../components/layout/main-layout";
import { useSettings } from "../../../components/state";

type Props = {
  typeName: string;
};
export async function getStaticPaths() {
  const paths = mixinStaticPathsParams(
    Object.keys(schema.$defs || {}).map((typeName) => ({
      params: { typeName },
    })),
  );

  return { paths, fallback: false };
}

export async function getStaticProps(ctx) {
  const params = ctx?.params || {};
  const typeName = params.typeName;
  return {
    props: {
      typeName,
      ...(await getI18nProps(ctx)),
    },
  };
}
export default (props: Props) => {
  const { t } = useTranslation("translation");
  const { typeName } = props;

  const { typeNameToTypeIRI, createEntityIRI } = useAdbContext();
  const typeIRI: string | undefined = useMemo(
    () =>
      typeof typeName === "string" ? typeNameToTypeIRI(typeName) : undefined,
    [typeName, typeNameToTypeIRI],
  );
  const [entityIRI, setEntityIRI] = useState<string | undefined>();
  const searchParam = useSearchParams();
  useEffect(() => {
    const encID = searchParam.get("encID");
    const id = typeof encID === "string" ? decodeIRI(encID) : undefined;
    const newURI = id || createEntityIRI(typeName);
    setEntityIRI(newURI);
  }, [setEntityIRI, typeName, searchParam, createEntityIRI]);

  const title = `Neue ${t(typeName)} anlegen - Ausstellungserfassung`;
  const { features } = useSettings();
  const { previewEnabled, togglePreview } = useFormEditor();

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="a knowledge base about exhibitions" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <MainLayout
        toolbar={
          features?.enablePreview ? (
            <Button
              onClick={() => togglePreview()}
              startIcon={previewEnabled ? <VisibilityOff /> : <Visibility />}
            >
              Vorschau {previewEnabled ? "ausblenden" : "einblenden"}
            </Button>
          ) : undefined
        }
      >
        {typeIRI && typeName && (
          <>
            <TypedForm
              key={entityIRI}
              entityIRI={entityIRI}
              typeName={typeName}
              classIRI={typeIRI}
            />
          </>
        )}
      </MainLayout>
    </>
  );
};

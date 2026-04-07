import { BarReChart } from "@graviola/edb-charts";
import { useQuery } from "@graviola/edb-state-hooks";
import { useAdbContext, useGlobalCRUDOptions } from "@graviola/edb-state-hooks";
import { fixSparqlOrder } from "@graviola/sparql-schema";
import { TrendingDown, TrendingUp } from "@mui/icons-material";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  styled,
  Typography,
} from "@mui/material";
import df from "@rdfjs/data-model";
import { SELECT } from "@tpluscode/sparql-builder";
import { ParentSize } from "@visx/responsive";
import { orderBy } from "lodash-es";
import { useTranslation } from "next-i18next";
import { useMemo } from "react";

import { SearchBar } from "./Search";

export const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "'Play', sans-serif",
  fontSize: "1.5rem",
  color: "black",
  textAlign: "center",
  width: "100%",
  lineHeight: 0.5,
  [theme.breakpoints.up("sm")]: {
    fontSize: "2.25rem",
    lineHeight: 1.25,
    letterSpacing: 0.005,
  },
}));

type OwnCardProps = {
  avatar?: string;
  title: string;
  info?: string;
  subheader: string;
  trendDirection: "up" | "down";
  children?: React.ReactNode;
};
export const OwnCard = ({
  avatar,
  title,
  subheader,
  trendDirection,
  info,
  children,
}: OwnCardProps) => (
  <Card
    raised
    sx={{
      backgroundColor: (theme) => `rgba(255, 255, 255, 0.8)`,
    }}
  >
    <CardHeader
      avatar={avatar && <Avatar src={`${avatar}`} />}
      title={
        <Typography variant="h6" fontFamily={"'Play', sans-serif"}>
          {title}
        </Typography>
      }
      subheader={
        <Box display="flex" justifyContent="space-between">
          {subheader}
          <Box display="flex" alignItems="center">
            {info && <Typography variant="subtitle1">{info}</Typography>}
            {trendDirection === "down" ? (
              <TrendingDown
                sx={{ ml: 1, color: (theme) => theme.palette.error.dark }}
              />
            ) : (
              <TrendingUp
                sx={{ ml: 1, color: (theme) => theme.palette.success.dark }}
              />
            )}
          </Box>
        </Box>
      }
    />
    <CardContent
      sx={{
        p: 5,
        "&.MuiCardContent-root": {
          paddingBottom: 0,
        },
      }}
    >
      {children || null}
    </CardContent>
  </Card>
);

export const Dashboard = (props) => {
  const {
    queryBuildOptions: { primaryFields },
    typeIRIToTypeName,
    typeNameToTypeIRI,
    jsonLDConfig: { defaultPrefix },
    propertyNameToIRI,
  } = useAdbContext();

  const relevantTypes = useMemo(
    () => Object.keys(primaryFields).map((key) => propertyNameToIRI(key)),
    [propertyNameToIRI, primaryFields],
  );

  const { t } = useTranslation();
  const { crudOptions } = useGlobalCRUDOptions();
  const { selectFetch } = crudOptions || {};
  const { data: typeCountData } = useQuery({
    queryKey: ["typeCount"],
    queryFn: () => {
      const countV = df.variable("count");
      const query = fixSparqlOrder(
        SELECT`
      ?type (COUNT(?s) AS ${countV})`.WHERE`
      VALUES ?type { ${relevantTypes.map((iri) => `<${iri}>`).join(" ")} }
      ?s a ?type
    `.GROUP().BY` ?type `
          .ORDER()
          .BY(countV)
          .build(),
      );
      return selectFetch(query);
    },
    enabled: !!selectFetch,
    refetchInterval: 1000 * 10,
  });

  const scoreCount = useMemo(
    () =>
      orderBy(
        typeCountData?.map((item) => ({
          title: t(typeIRIToTypeName(item.type?.value)),
          score: parseInt(item.count?.value) || 0,
        })),
        ["score"],
        ["desc"],
      ),
    [typeCountData, t, typeIRIToTypeName],
  );

  return (
    <Box
      sx={{
        padding: { md: "20px 30px 99px 30px" },
      }}
    >
      <Box sx={{ marginBottom: "4rem", marginTop: "1em" }}>
        <HeaderTitle>{t("database_name")}</HeaderTitle>
      </Box>
      <Grid
        container
        justifyContent="space-evenly"
        alignItems="center"
        spacing={3}
        sx={{ p: { md: 10 } }}
      >
        <Grid size={12}>
          <SearchBar relevantTypes={relevantTypes} />
        </Grid>
        <Grid size={12}>
          <OwnCard
            title={"Wichtigste Entitäten"}
            subheader={""}
            trendDirection={"up"}
          >
            <ParentSize>
              {({ width, height }) => (
                <BarReChart scores={scoreCount} width={width} height={height} />
              )}
            </ParentSize>
          </OwnCard>
        </Grid>
      </Grid>
    </Box>
  );
};

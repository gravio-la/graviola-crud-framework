import React, { useState } from "react";
import type { JSONSchema7 } from "json-schema";
import type { NormalizedSchema } from "@graviola/edb-graph-traversal";
import type { Prefixes, PaginationMetadata } from "@graviola/edb-core-types";
import { Grid, Typography, Button, Box } from "@mui/material";
import { JsonView } from "react-json-view-lite";
import { YasguiSPARQLEditor } from "@graviola/edb-debug-utils";
import type Yasgui from "@triply/yasgui";
import type { SparqlTemplateResult } from "@tpluscode/sparql-builder";
import "react-json-view-lite/dist/index.css";

/**
 * Result of CONSTRUCT query generation
 */
export type ConstructResult = {
  constructPatterns: SparqlTemplateResult[];
  wherePatterns: SparqlTemplateResult[];
  paginationMetadata: Map<
    string,
    PaginationMetadata & { _stage: "query" | "extraction" }
  >;
};

/**
 * Display component for SPARQL query generation showcase
 *
 * This component is purely presentational - all computation should be done
 * in the story itself. This allows different stories to have completely
 * different schemas and filter options.
 */
export interface QueryGeneratorShowcaseProps {
  /** Original JSON Schema (before normalization) */
  schema: JSONSchema7;

  /** Normalized schema (after resolving refs and applying filters) */
  normalizedSchema: NormalizedSchema;

  /** Generated SPARQL query string */
  sparqlQuery: string;

  /** Construct result containing patterns and pagination metadata */
  constructResult: ConstructResult;

  /** Prefix map for SPARQL namespace declarations */
  prefixMap: Prefixes;

  /** Optional title for the showcase */
  title?: string;

  /** Optional RDF triples (N-Quads/Turtle) for loading into SPARQL store */
  triples?: string;
}

export const QueryGeneratorShowcase: React.FC<QueryGeneratorShowcaseProps> = ({
  schema,
  normalizedSchema,
  sparqlQuery,
  constructResult,
  prefixMap,
  title,
  triples,
}) => {
  const [showYasgui, setShowYasgui] = useState(false);

  // Generate INSERT DATA query for triple loading
  const insertDataQuery = triples ? `INSERT DATA {\n${triples}\n}` : null;

  return (
    <Box>
      {title && (
        <Typography variant="h4" sx={{ mb: 3 }}>
          {title}
        </Typography>
      )}

      <Grid
        container
        direction="row"
        wrap="nowrap"
        justifyContent="center"
        spacing={2}
      >
        <Grid flex={1} sx={{ maxHeight: "70vh", overflow: "auto" }}>
          <Typography variant="h5">Input Schema</Typography>
          <JsonView data={schema} shouldExpandNode={(lvl) => lvl < 3} />
        </Grid>

        <Grid flex={1} sx={{ maxHeight: "70vh", overflow: "auto" }}>
          <Typography variant="h5">Normalized Schema</Typography>
          <JsonView
            data={normalizedSchema}
            shouldExpandNode={(lvl) => lvl < 2}
          />
        </Grid>

        <Grid flex={1} sx={{ maxHeight: "70vh", overflow: "auto" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="h5">Generated SPARQL</Typography>
            <Box>
              {triples && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowYasgui(!showYasgui)}
                  sx={{ mr: 1 }}
                  color="secondary"
                >
                  Load Dataset
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                onClick={() => setShowYasgui(!showYasgui)}
              >
                {showYasgui ? "Hide" : "Open"} Yasgui
              </Button>
            </Box>
          </Box>
          <Box
            component="pre"
            sx={{
              margin: 0,
              padding: 2,
              backgroundColor: "#282c34",
              color: "#abb2bf",
              borderRadius: 1,
              overflow: "auto",
              fontFamily: "Consolas, Monaco, monospace",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            <code>{sparqlQuery}</code>
          </Box>

          {/* Pagination Metadata */}
          {constructResult.paginationMetadata.size > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "#d4edda", borderRadius: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{ color: "#155724", fontWeight: "bold" }}
              >
                Pagination Applied (Query Stage)
              </Typography>
              {Array.from(constructResult.paginationMetadata.entries()).map(
                ([prop, meta]: [
                  string,
                  PaginationMetadata & { _stage: "query" | "extraction" },
                ]) => (
                  <Typography
                    key={prop}
                    variant="body2"
                    sx={{ color: "#155724" }}
                  >
                    • {prop}: _stage={meta._stage}, take={meta.take}, orderBy=
                    {JSON.stringify(meta.orderBy)}
                  </Typography>
                ),
              )}
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Yasgui Editor */}
      {showYasgui && (
        <Box sx={{ mt: 3, p: 2, bgcolor: "#f8f9fa", borderRadius: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Yasgui SPARQL Editor
            {insertDataQuery && (
              <Typography
                component="span"
                variant="body2"
                sx={{ ml: 2, color: "text.secondary" }}
              >
                (Tab 1: CONSTRUCT query, Tab 2: INSERT DATA for loading dataset)
              </Typography>
            )}
          </Typography>
          <Box sx={{ minHeight: "500px" }}>
            <YasguiSPARQLEditor
              prefixes={prefixMap as Prefixes}
              onInit={(yasgui: Yasgui) => {
                // Set the CONSTRUCT query in the first tab
                const firstTabId = yasgui.persistentConfig.currentId();
                const firstTab = yasgui.getTab(firstTabId);
                if (firstTab) {
                  const yasqe = firstTab.getYasqe();
                  if (yasqe) {
                    yasqe.setValue(sparqlQuery);
                  }
                }

                // If we have triples, create a second tab for INSERT DATA
                if (insertDataQuery) {
                  const newTab = yasgui.addTab(true, {
                    name: "Load Dataset (INSERT DATA)",
                  });
                  if (newTab) {
                    const yasqe = newTab.getYasqe();
                    if (yasqe) {
                      yasqe.setValue(insertDataQuery);
                      // Switch back to first tab
                      yasgui.selectTabId(firstTabId);
                    }
                  }
                }
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

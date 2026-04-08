import { spfmt } from "sparql-formatter";

export type SparqlFormattingMode = "default" | "compact" | "jsonld" | "turtle";

export function formatSparqlQuerySafe(query: string): string;
export function formatSparqlQuerySafe(
  query: string,
  formattingMode: SparqlFormattingMode,
  indentDepth?: number,
): string;
export function formatSparqlQuerySafe(
  query: string,
  formattingMode?: SparqlFormattingMode,
  indentDepth?: number,
): string {
  try {
    if (formattingMode === undefined) {
      return spfmt.format(query);
    }
    if (indentDepth !== undefined) {
      return spfmt.format(query, formattingMode, indentDepth);
    }
    return spfmt.format(query, formattingMode);
  } catch {
    return query;
  }
}

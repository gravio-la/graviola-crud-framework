declare module "sparql-formatter" {
  export const spfmt: {
    format: (
      sparql: string,
      formattingMode?: "default" | "compact" | "jsonld" | "turtle",
      indentDepth?: number,
    ) => string;
  };
}

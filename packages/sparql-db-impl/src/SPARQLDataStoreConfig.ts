import type {
  CRUDFunctions,
  SchemaValidator,
  SparqlBuildOptions,
  StringToIRIFn,
  WalkerOptions,
} from "@graviola/edb-core-types";
import type { DatastoreBaseConfig } from "@graviola/edb-global-types";
import type { JSONSchema7 } from "json-schema";

export type SPARQLDataStoreConfig = {
  defaultPrefix: string;
  jsonldContext: object | string;
  typeNameToTypeIRI: StringToIRIFn;
  queryBuildOptions: SparqlBuildOptions;
  walkerOptions?: Partial<WalkerOptions>;
  sparqlQueryFunctions: CRUDFunctions;
  defaultLimit?: number;
  makeStubSchema?: (schema: JSONSchema7) => JSONSchema7;
  enableInversePropertiesFeature?: boolean;
  defaultUpdateGraph?: string;
  /**
   * Optional schema validator facade for patch validation (e.g. AJV instance).
   * @deprecated Use queryBuildOptions on SPARQLCRUDOptions.validator instead.
   * Kept for backward compatibility — will be forwarded to SPARQLCRUDOptions.
   */
  validator?: SchemaValidator;
} & DatastoreBaseConfig;

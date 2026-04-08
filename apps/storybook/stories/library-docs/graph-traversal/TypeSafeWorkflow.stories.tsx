import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { z } from "zod";
import Ajv from "ajv";
import mapValues from "lodash-es/mapValues";
import {
  extractFromGraph,
  normalizeSchema,
} from "@graviola/edb-graph-traversal";
import {
  normalizedSchema2construct,
  buildTypedSPARQLQuery,
} from "@graviola/sparql-schema";
import { useCrudProvider } from "@graviola/edb-state-hooks";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Paper,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Collapse,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeIcon from "@mui/icons-material/Code";
import DataObjectIcon from "@mui/icons-material/DataObject";
import SearchIcon from "@mui/icons-material/Search";
import SchemaIcon from "@mui/icons-material/Schema";
import StorageIcon from "@mui/icons-material/Storage";
import VerifiedIcon from "@mui/icons-material/Verified";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { JsonView, allExpanded, darkStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { schemaPrefixes } from "../sparql-schema/showcases";
import { bringDefinitionToTop } from "@graviola/json-schema-utils";
import type { JSONSchema7Definition } from "json-schema";
import type { TypedGraphTraversalFilterOptions } from "@graviola/edb-core-types";

// ============================================================================
// Shared Constants
// ============================================================================

const tbbtSchemaPrefixes = {
  "": "http://localhost:8080/data/",
  schema: "http://schema.org/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

// ============================================================================
// Helper Components
// ============================================================================

type OutputType = "json" | "sparql" | "triples" | "text";

interface OutputDisplayProps {
  data: any;
  type?: OutputType;
  title?: string;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ data, type, title }) => {
  const [copied, setCopied] = React.useState(false);

  const detectedType: OutputType = React.useMemo(() => {
    if (type) return type;
    if (typeof data === "string") {
      if (data.includes("SELECT") || data.includes("CONSTRUCT"))
        return "sparql";
      if (data.includes("<") && data.includes(">") && data.includes("."))
        return "triples";
      return "text";
    }
    return "json";
  }, [data, type]);

  const content = React.useMemo(() => {
    if (typeof data === "string") return data;
    if (detectedType === "triples") {
      return Array.isArray(data)
        ? data
            .map((t: any) => `${t.subject} ${t.predicate} ${t.object} .`)
            .join("\n")
        : JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data, null, 2);
  }, [data, detectedType]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Chip
          icon={
            detectedType === "json" ? (
              <DataObjectIcon />
            ) : detectedType === "sparql" ? (
              <CodeIcon />
            ) : (
              <StorageIcon />
            )
          }
          label={title || detectedType.toUpperCase()}
          size="small"
          variant="outlined"
        />
        <Tooltip title={copied ? "Copied!" : "Copy to clipboard"}>
          <IconButton size="small" onClick={handleCopy} color="primary">
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {detectedType === "json" && typeof data === "object" ? (
        <Box
          sx={{
            maxHeight: 400,
            overflow: "auto",
            bgcolor: "grey.900",
            p: 2,
            borderRadius: 1,
          }}
        >
          <JsonView
            data={data}
            shouldExpandNode={(lvl) => lvl < 2}
            style={darkStyles}
          />
        </Box>
      ) : (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            maxHeight: 400,
            overflow: "auto",
            bgcolor: "grey.900",
            color: "grey.100",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content}
        </Paper>
      )}
    </Paper>
  );
};

interface PipelineStepData {
  step: string;
  status: "pending" | "success" | "error";
  input?: any;
  inputType?: OutputType;
  output?: any;
  outputType?: OutputType;
  metadata?: Record<string, any>;
  error?: string;
}

const PipelineStepCard: React.FC<{ data: PipelineStepData }> = ({ data }) => {
  const [expanded, setExpanded] = React.useState(false);

  const getIcon = () => {
    switch (data.status) {
      case "success":
        return <CheckCircleIcon color="success" />;
      case "error":
        return <ErrorIcon color="error" />;
      case "pending":
        return <PendingIcon color="warning" />;
    }
  };

  const getStepIcon = () => {
    if (data.step.includes("SELECT")) return <SearchIcon color="primary" />;
    if (data.step.includes("Schema")) return <SchemaIcon color="primary" />;
    if (data.step.includes("SPARQL")) return <CodeIcon color="primary" />;
    if (data.step.includes("CONSTRUCT")) return <StorageIcon color="primary" />;
    if (data.step.includes("Extract"))
      return <DataObjectIcon color="primary" />;
    if (data.step.includes("Validate")) return <VerifiedIcon color="primary" />;
    return <CodeIcon color="primary" />;
  };

  const hasDetails = data.input || data.output || data.error;

  return (
    <Paper elevation={3} sx={{ overflow: "hidden" }}>
      <CardContent sx={{ pb: hasDetails ? 2 : 3 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ mt: 0.5 }}>{getStepIcon()}</Box>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
              {data.step}
            </Typography>
            {data.metadata && (
              <Stack direction="row" spacing={1} flexWrap="wrap" mb={1}>
                {Object.entries(data.metadata).map(([key, value]) => (
                  <Chip
                    key={key}
                    label={`${key}: ${value}`}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Stack>
            )}
            {data.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body2">{data.error}</Typography>
              </Alert>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {getIcon()}
            {hasDetails && (
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                color="primary"
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Stack>
        </Stack>

        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={3}>
            {data.input && (
              <Box>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  Input
                </Typography>
                <OutputDisplay data={data.input} type={data.inputType} />
              </Box>
            )}
            {data.output && (
              <Box>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  Output
                </Typography>
                <OutputDisplay data={data.output} type={data.outputType} />
              </Box>
            )}
          </Stack>
        </Collapse>
      </CardContent>
    </Paper>
  );
};

// ============================================================================
// Main Pipeline Component
// ============================================================================

interface TypeSafePipelineDemoProps<T = any> {
  zodSchema: z.ZodType<T>;
  filters: TypedGraphTraversalFilterOptions<T>;
  targetIRI: string;
  title?: string;
  description?: string;
  /**
   * Optional pre-converted JSON Schema (e.g., from global registry).
   * If provided, this will be used instead of converting zodSchema.
   */
  preConvertedJsonSchema?: any;
}

const TypeSafePipelineDemo = <T extends any>({
  zodSchema,
  filters,
  targetIRI,
  title = "Type-Safe Graph Traversal Pipeline",
  description = "Complete workflow: Zod Schema → JSON Schema → Normalize → SPARQL → Extract → Validate",
  preConvertedJsonSchema,
}: TypeSafePipelineDemoProps<T>) => {
  const { crudOptions } = useCrudProvider();
  const constructFetch = crudOptions?.constructFetch;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pipelineSteps, setPipelineSteps] = React.useState<PipelineStepData[]>(
    [],
  );

  const addPipelineStep = (stepData: PipelineStepData) => {
    setPipelineSteps((prev) => {
      const existingIndex = prev.findIndex((s) => s.step === stepData.step);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = stepData;
        return updated;
      }
      return [...prev, stepData];
    });
  };

  const runPipeline = React.useCallback(async () => {
    const jsonSchema = preConvertedJsonSchema || z.toJSONSchema(zodSchema);
    if (!constructFetch) {
      setError("CRUD functions not available");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setPipelineSteps([]);

      // Step 1: Convert Schema
      addPipelineStep({
        step: "Convert Zod Schema to JSON Schema",
        status: "success",
        output: jsonSchema,
        outputType: "json",
        metadata: {
          Properties: Object.keys((jsonSchema as any).properties || {}).length,
        },
      });

      // Step 2: Normalize Schema
      addPipelineStep({
        step: "Normalize Schema with Type-Safe Filters",
        status: "pending",
      });

      const normalizedSchema = normalizeSchema<T>(
        jsonSchema as any,
        filters as any,
      );
      const normalizedSchemaWithJSONLDContext = normalizeSchema<T>(
        {
          ...(jsonSchema as any),
        },
        {
          ...filters,
          excludeJsonLdMetadata: false,
        } as any,
      );

      addPipelineStep({
        step: "Normalize Schema with Type-Safe Filters",
        status: "success",
        input: { filters },
        inputType: "json",
        output: normalizedSchema,
        outputType: "json",
        metadata: {
          Properties: Object.keys(normalizedSchema.properties || {}).length,
        },
      });

      // Step 3: Generate SPARQL
      addPipelineStep({
        step: "Generate SPARQL CONSTRUCT Query",
        status: "pending",
      });

      try {
        const sparqlQuery = buildTypedSPARQLQuery<T>(
          targetIRI,
          undefined,
          zodSchema,
          {
            prefixMap: tbbtSchemaPrefixes,
            maxRecursion: 3,
          },
        ).query;

        addPipelineStep({
          step: "Generate SPARQL CONSTRUCT Query",
          status: "success",
          output: sparqlQuery,
          outputType: "sparql",
        });

        // Step 4: Execute SPARQL
        addPipelineStep({
          step: "Execute CONSTRUCT Query",
          status: "pending",
        });

        try {
          const dataset = await constructFetch(sparqlQuery);
          const quads = Array.from(dataset);

          const triples = quads.map((quad: any) => ({
            subject: quad.subject.value,
            predicate: quad.predicate.value,
            object:
              quad.object.termType === "Literal"
                ? `"${quad.object.value}"${
                    quad.object.language ? `@${quad.object.language}` : ""
                  }${
                    quad.object.datatype?.value
                      ? `^^<${quad.object.datatype.value}>`
                      : ""
                  }`
                : quad.object.value,
          }));

          addPipelineStep({
            step: "Execute CONSTRUCT Query",
            status: "success",
            input: sparqlQuery,
            inputType: "sparql",
            output: triples,
            outputType: "triples",
            metadata: {
              Triples: quads.length,
            },
          });

          // Step 5: Extract from Graph
          addPipelineStep({
            step: "Extract from Graph",
            status: "pending",
          });

          try {
            const extracted = extractFromGraph<T>(
              targetIRI,
              dataset,
              normalizedSchema as any,
              filters as any,
              "http://schema.org/",
              schemaPrefixes,
            );

            addPipelineStep({
              step: "Extract from Graph",
              status: "success",
              output: extracted,
              outputType: "json",
              metadata: {
                Properties: Object.keys(extracted || {}).length,
              },
            });

            // Step 6: Validate with AJV
            addPipelineStep({
              step: "Validate with AJV",
              status: "pending",
            });

            try {
              const ajv = new Ajv({ strict: false });
              const validate = ajv.compile({
                ...(normalizedSchemaWithJSONLDContext as any),
                $schema: "http://json-schema.org/draft-07/schema",
              });
              const valid = validate(extracted);

              addPipelineStep({
                step: "Validate with AJV",
                status: valid ? "success" : "error",
                input: extracted,
                inputType: "json",
                output: valid
                  ? { valid: true }
                  : { valid: false, errors: validate.errors },
                outputType: "json",
                metadata: {
                  Valid: valid ? "Yes" : "No",
                  ...(validate.errors && { Errors: validate.errors.length }),
                },
                error: valid ? undefined : "Validation failed",
              });
            } catch (validationError: any) {
              addPipelineStep({
                step: "Validate with AJV",
                status: "error",
                error: validationError.message,
              });
            }
          } catch (extractError: any) {
            addPipelineStep({
              step: "Extract from Graph",
              status: "error",
              error: extractError.message,
            });
          }
        } catch (queryError: any) {
          addPipelineStep({
            step: "Execute CONSTRUCT Query",
            status: "error",
            error: queryError.message,
          });
        }
      } catch (schemaError: any) {
        addPipelineStep({
          step: "Generate SPARQL CONSTRUCT Query",
          status: "error",
          error: schemaError.message,
        });
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [
    constructFetch,
    crudOptions,
    zodSchema,
    filters,
    targetIRI,
    preConvertedJsonSchema,
  ]);

  if (!constructFetch) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning">
          CRUD functions not available. Make sure the store provider is
          initialized.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", p: 4 }}>
      <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          {description}
        </Typography>

        <Button
          variant="contained"
          size="large"
          onClick={runPipeline}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
          sx={{ mt: 2 }}
        >
          {loading ? "Running Pipeline..." : "Run Pipeline"}
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Pipeline Error
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {error}
          </Typography>
        </Alert>
      )}

      {pipelineSteps.length > 0 && (
        <Card elevation={2} sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom>
              Pipeline Steps
            </Typography>
            <Stack spacing={3} sx={{ mt: 3 }}>
              {pipelineSteps.map((step, index) => (
                <PipelineStepCard key={index} data={step} />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

// ============================================================================
// Storybook Configuration
// ============================================================================

const meta: Meta<typeof TypeSafePipelineDemo> = {
  title: "Library Docs/Graph Traversal/Type-Safe Workflow",
  component: TypeSafePipelineDemo,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
# Type-Safe Graph Traversal Workflow

This example demonstrates the complete type-safe workflow for graph traversal:

1. **Define Schema with Zod**: Create a schema with full TypeScript type inference
2. **Convert to JSON Schema**: Use Zod 4's native \`toJSONSchema()\` conversion
3. **Normalize Schema**: Apply type-safe filters to control graph traversal
4. **Generate SPARQL**: Automatically generate SPARQL CONSTRUCT queries
5. **Execute Query**: Fetch RDF triples from the store
6. **Extract Data**: Transform triples into JSON-LD
7. **Validate**: Verify extracted data against the schema

## Key Features

- **Type Safety**: Full IDE autocomplete and compile-time type checking
- **Filter Safety**: Include/omit/select patterns are type-checked
- **Automatic Query Generation**: No manual SPARQL writing needed
- **Validation**: Runtime validation with AJV

## Usage

Click "Run Pipeline" to see the complete workflow in action. Each step shows its input/output
with copy buttons for easy inspection.
        `,
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof TypeSafePipelineDemo>;

/**
 * Complete pipeline example with circular schema references.
 *
 * This story defines the schema inline so you can see the complete workflow
 * when clicking "Show code" in Storybook.
 */
export const Pipeline: Story = {
  render: () => {
    // ========================================================================
    // 1. Define Schema with Zod (with circular references)
    // ========================================================================
    const PersonSchema = z.object({
      "@id": z.string(),
      "@type": z.literal("http://schema.org/Person"),
      "schema:givenName": z.string().optional(),
      "schema:familyName": z.string().optional(),
      "schema:birthDate": z.string().optional(),
      "schema:email": z.string().email().optional(),
      "schema:telephone": z.string().optional(),
      "schema:knows": z
        .array(
          z.object({
            "@id": z.string(),
            "@type": z.literal("http://schema.org/Person"),
            "schema:givenName": z.string(),
            "schema:knows": z
              .array(
                z.object({
                  "@id": z.string(),
                  "@type": z.literal("http://schema.org/Person"),
                  "schema:givenName": z.string(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
    });

    // ========================================================================
    // 2. Infer TypeScript type from Zod schema
    // ========================================================================
    type Person = z.infer<typeof PersonSchema>;

    // ========================================================================
    // 3. Define type-safe filters (full autocomplete!)
    // ========================================================================
    const typeSafeFilters: TypedGraphTraversalFilterOptions<Person> = {
      include: {
        "schema:knows": {
          take: 3,
          include: {
            "schema:knows": {
              take: 3,
              include: {
                "schema:givenName": true,
                "@id": true,
              },
            },
          },
        } as any,
      },
      omit: ["schema:email", "schema:telephone"],
      includeRelationsByDefault: false,
    };

    // ========================================================================
    // 4. Run the pipeline
    // ========================================================================
    return (
      <TypeSafePipelineDemo
        zodSchema={PersonSchema}
        filters={typeSafeFilters}
        targetIRI="http://localhost:8080/data/person/sheldon-cooper"
      />
    );
  },
};

/**
 * Pipeline with Global Registry and true circular references.
 *
 * This example demonstrates:
 * - Using z.globalRegistry for schema management
 * - Circular references (Person -> Person via schema:knows)
 * - Cross-references (Person -> Organization -> Person)
 * - Using bringDefinitionToTop() to restructure the schema
 * - Proper $ref generation in JSON Schema
 */
export const PipelineWithGlobalRegistry: Story = {
  render: () => {
    // ========================================================================
    // 1. Define Schemas with getters for circular references
    // ========================================================================
    const PersonSchema = z.object({
      "@id": z.string(),
      "@type": z.literal("http://schema.org/Person"),
      "schema:givenName": z.string().optional(),
      "schema:familyName": z.string().optional(),
      "schema:birthDate": z.string().optional(),
      "schema:email": z.string().email().optional(),
      "schema:telephone": z.string().optional(),
      // Circular reference: Person -> Person
      get "schema:knows"() {
        return z.array(PersonSchema).optional();
      },
      // Cross-reference: Person -> Organization
      get "schema:worksFor"() {
        return z.array(OrganizationSchema).optional();
      },
    });

    const OrganizationSchema = z.object({
      "@id": z.string(),
      "@type": z.literal("http://schema.org/Organization"),
      "schema:name": z.string(),
      "schema:email": z.string().email().optional(),
      "schema:telephone": z.string().optional(),
      "schema:address": z.string().optional(),
      // Cross-reference back: Organization -> Person
      get "schema:hasEmployee"() {
        return z.array(PersonSchema).optional();
      },
    });

    // ========================================================================
    // 2. Register schemas in global registry
    // ========================================================================
    z.globalRegistry.clear();
    z.globalRegistry.add(PersonSchema, { id: "Person" });
    z.globalRegistry.add(OrganizationSchema, { id: "Organization" });

    // ========================================================================
    // 3. Generate JSON Schema from registry
    // ========================================================================
    const registryJsonSchema = z.toJSONSchema(z.globalRegistry, {
      // Use simple IDs for $ref
      uri: (id) => `#/definitions/${id}`,
      target: "draft-7",
    });

    // ========================================================================
    // 4. Use helper to bring Person to top level
    // ========================================================================
    const personJsonSchema = {
      ...bringDefinitionToTop(
        {
          definitions: mapValues(
            registryJsonSchema.schemas,
            ({ id: _1, $id: _2, ...schema }) => schema,
          ) as Record<string, JSONSchema7Definition>,
        },
        "Person",
      ),
      $id: "Root",
    };

    // ========================================================================
    // 5. Infer type and define filters
    // ========================================================================
    type Person = z.infer<typeof PersonSchema>;
    type Organization = z.infer<typeof OrganizationSchema>;

    const typeSafeFilters: TypedGraphTraversalFilterOptions<Person> = {
      include: {
        "schema:knows": {
          take: 2,
          include: {
            "schema:givenName": true,
            "schema:familyName": true,
            // Can go deeper - Person -> Person -> Person
            "schema:knows": {
              take: 1,
              include: {
                "schema:givenName": true,
              },
            },
          },
        },
      },
      omit: ["schema:email", "schema:telephone"],
      includeRelationsByDefault: false,
      excludeJsonLdMetadata: true,
    };

    // ========================================================================
    // 6. Run the pipeline
    // ========================================================================
    return (
      <Box sx={{ maxWidth: 1400, mx: "auto", p: 4 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Global Registry Pattern
          </Typography>
          <Typography variant="body2">
            This example uses Zod's global registry to manage circular
            references. The generated JSON Schema includes proper $ref links:
            <br />• Person → Person (via schema:knows)
            <br />• Person → Organization → Person (circular back)
            <br />• Click "Show code" to see the complete implementation!
          </Typography>
        </Alert>

        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Generated JSON Schema Structure
          </Typography>
          <OutputDisplay
            data={personJsonSchema}
            type="json"
            title="Person Schema with Definitions"
          />
        </Paper>

        <TypeSafePipelineDemo
          zodSchema={PersonSchema}
          filters={typeSafeFilters}
          targetIRI="http://localhost:8080/data/person/sheldon-cooper"
          title="Global Registry Pipeline"
          description="Using registry-based schemas with circular references and $ref resolution"
          preConvertedJsonSchema={personJsonSchema}
        />
      </Box>
    );
  },
};

/**
 * Example showing type-safe filter configuration.
 *
 * The filters are fully type-checked based on the Zod schema definition.
 * TypeScript will autocomplete property names and catch errors at compile time.
 */
export const TypeSafeFiltersExample: Story = {
  render: () => {
    // Define a simple schema
    const PersonSchema = z.object({
      "@id": z.string(),
      "@type": z.literal("http://schema.org/Person"),
      "schema:givenName": z.string().optional(),
      "schema:familyName": z.string().optional(),
      "schema:birthDate": z.string().optional(),
      "schema:email": z.string().email().optional(),
      "schema:telephone": z.string().optional(),
      "schema:postalCode": z.union([z.string(), z.number().int()]).optional(),
      "schema:knows": z
        .array(
          z.object({
            "@id": z.string(),
            "schema:givenName": z.string(),
          }),
        )
        .optional(),
    });

    type Person = z.infer<typeof PersonSchema>;

    const schema = z.toJSONSchema(PersonSchema, { target: "draft-7" });

    // Type-safe filters - try adding invalid properties!
    const filters: TypedGraphTraversalFilterOptions<Person> = {
      include: {
        "schema:knows": {
          take: 5,
          include: {
            "schema:givenName": true,
            "@id": true,
          },
        } as any,
      },
      select: {
        "schema:givenName": true,
        "schema:familyName": true,
      },
      omit: ["schema:email", "schema:telephone"],
    };

    return (
      <Box sx={{ maxWidth: 1200, mx: "auto", p: 4 }}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            Type-Safe Filter Configuration
          </Typography>
          <Alert severity="info" sx={{ my: 3 }}>
            These filters are fully type-checked. Try changing property names in
            your IDE - you'll get autocomplete and error checking!
          </Alert>
          <OutputDisplay
            data={filters}
            type="json"
            title="Filters Configuration"
          />
          <OutputDisplay data={schema} type="json" title="Schema" />
        </Paper>
      </Box>
    );
  },
};

import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

import {
  defs,
  getDefintitionKey,
  isJSONSchema,
  isPrimitive,
} from "./jsonSchema";
import { resolveSchema } from "./resolver";
import { filterForPrimitives } from "./stubHelper";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SchemaRegistryEntry {
  /** Definition name (e.g. "Category") */
  name: string;
  /** JSON pointer path (e.g. "#/definitions/Category" or "#/$defs/Category") */
  path: string;
  /**
   * Resolved schema for this entry.
   * - `$ref`s pointing to entity definitions are preserved as-is (no inlining).
   *   Use `registry.byPath.get(ref)` to follow them.
   * - `$ref`s pointing to value-object (non-entity) definitions are inlined.
   * No JavaScript circular references are created.
   */
  resolvedSchema: JSONSchema7;
  /**
   * Stub schema for partial validation and form rendering.
   * Contains only primitive properties + @id / @type.
   * Has `additionalProperties: true` and `required: []`.
   *
   * This fixes common validation noise:
   *   - "__label not allowed" (runtime-injected fields)
   *   - "@type is missing" (partially-loaded relation objects carrying only @id)
   */
  stubSchema: JSONSchema7;
  /** True when this definition represents a named entity (has @id directly or via allOf) */
  isEntity: boolean;
  /** Type IRI extracted from @type.const, if present */
  typeIRI?: string;
}

export interface SchemaRegistry {
  /** Original root schema, unmodified */
  rootSchema: JSONSchema7;
  /**
   * Root schema with any top-level $ref resolved (handles "Pattern D" where the
   * schema itself is `{ "$ref": "#/$defs/SomeType" }`).
   */
  resolvedRoot: JSONSchema7;
  /** Entries keyed by definition name */
  byName: Map<string, SchemaRegistryEntry>;
  /** Entries keyed by JSON pointer (e.g. "#/definitions/Category") */
  byPath: Map<string, SchemaRegistryEntry>;
  /** Entity entries keyed by type IRI (populated only when @type.const is present) */
  byTypeIRI: Map<string, SchemaRegistryEntry>;
}

export interface CompileSchemaOptions {
  /**
   * Maximum depth when resolving value-object $ref chains.
   * Entity $refs are never inlined regardless of this setting.
   * Default: 20
   */
  maxDepth?: number;
  /**
   * Optional base IRI used for inferring type IRIs from definition names when
   * no @type.const is present in the schema.
   */
  baseIRI?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the schema has an `@id` property — either directly in
 * `properties`, or via any member of an `allOf` array (Pattern E inheritance,
 * including allOf members that are themselves `$ref`s resolved 1 level deep).
 */
function hasIdProperty(schema: JSONSchema7, rootSchema: JSONSchema7): boolean {
  if (schema.properties?.["@id"]) return true;
  if (schema.allOf) {
    return schema.allOf.some((part) => {
      if (typeof part !== "object" || part === null) return false;
      const s = part as JSONSchema7;
      if (s.properties?.["@id"]) return true;
      // allOf member may itself be a $ref (e.g. { $ref: "#/$defs/Base" })
      if (s.$ref) {
        const resolved = safeResolveRef(s.$ref, rootSchema);
        if (resolved?.properties?.["@id"]) return true;
      }
      return false;
    });
  }
  return false;
}

/**
 * Extracts the type IRI from `properties["@type"].const` if present.
 */
function extractTypeIRI(schema: JSONSchema7): string | undefined {
  const atType = schema.properties?.["@type"];
  if (atType && typeof atType === "object") {
    const typeSchema = atType as JSONSchema7;
    if (typeof typeSchema.const === "string") return typeSchema.const;
    // Also check enum with single value (alternate pattern)
    if (Array.isArray(typeSchema.enum) && typeSchema.enum.length === 1) {
      const val = typeSchema.enum[0];
      if (typeof val === "string") return val;
    }
  }
  return undefined;
}

/**
 * Resolves a JSON pointer path against `rootSchema`, but avoids infinite
 * recursion when `rootSchema` itself contains a root-level `$ref` (Pattern D).
 *
 * The standard `resolveSchema(rootSchema, path, rootSchema)` would recurse
 * infinitely when `rootSchema.$ref` is set, because `resolveSchemaWithSegments`
 * follows the schema's own `$ref` before navigating path segments.
 *
 * Fix: strip the root `$ref` from a shallow copy before passing to `resolveSchema`.
 */
function safeResolveRef(
  refPath: string,
  rootSchema: JSONSchema7,
): JSONSchema7 | undefined {
  // If rootSchema itself has $ref, strip it to avoid infinite recursion in resolver.ts
  const safeRoot: JSONSchema7 = rootSchema.$ref
    ? (({ $ref: _dropped, ...rest }) => rest)(rootSchema as any)
    : rootSchema;
  const resolved = resolveSchema(safeRoot, refPath, safeRoot);
  if (resolved && isJSONSchema(resolved as JSONSchema7Definition)) {
    return resolved as JSONSchema7;
  }
  return undefined;
}

/**
 * Shallow-resolves a single $ref — just 1 level, without recursing into the
 * resolved schema. Used in the Level 1 classification pass.
 */
function shallowResolveRef(
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
): JSONSchema7 {
  if (!schema.$ref) return schema;
  return safeResolveRef(schema.$ref, rootSchema) ?? schema;
}

/**
 * Recursively resolves $ref pointers within a schema, with the following policy:
 *
 * - If the $ref target is an **entity** (already classified via `entityNames`):
 *   keep the $ref as-is (don't inline). The caller can look it up in the registry.
 * - If the $ref target is a **value-object**: inline it (recurse).
 * - If the $ref target is currently in progress (cycle): keep the $ref as-is.
 *
 * No JavaScript circular references are ever created.
 */
function deepResolveSchema(
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
  entityNames: Set<string>,
  inProgress: Set<string>,
  defsKey: string,
  depth: number,
  maxDepth: number,
): JSONSchema7 {
  if (depth > maxDepth) return schema;

  if (schema.$ref) {
    const refPath = schema.$ref;

    // Determine definition name from the ref path
    const defName = refPath.startsWith(`#/${defsKey}/`)
      ? refPath.slice(`#/${defsKey}/`.length)
      : null;

    // Always keep entity refs as pointers (don't inline)
    if (defName && entityNames.has(defName)) return schema;

    // Prevent cycles in value-object resolution
    if (defName && inProgress.has(defName)) return schema;

    // Inline value-object ref
    const resolved = safeResolveRef(refPath, rootSchema);
    if (resolved) {
      const nextInProgress = defName
        ? new Set([...inProgress, defName])
        : inProgress;
      return deepResolveSchema(
        resolved,
        rootSchema,
        entityNames,
        nextInProgress,
        defsKey,
        depth + 1,
        maxDepth,
      );
    }
    return schema;
  }

  // Recurse into sub-schemas
  const result: JSONSchema7 = { ...schema };

  if (schema.properties) {
    result.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      if (typeof value === "boolean") {
        result.properties[key] = value;
      } else {
        result.properties[key] = deepResolveSchema(
          value as JSONSchema7,
          rootSchema,
          entityNames,
          inProgress,
          defsKey,
          depth + 1,
          maxDepth,
        );
      }
    }
  }

  if (schema.items) {
    if (Array.isArray(schema.items)) {
      result.items = schema.items.map((item) =>
        typeof item === "boolean"
          ? item
          : deepResolveSchema(
              item as JSONSchema7,
              rootSchema,
              entityNames,
              inProgress,
              defsKey,
              depth + 1,
              maxDepth,
            ),
      );
    } else if (typeof schema.items !== "boolean") {
      result.items = deepResolveSchema(
        schema.items as JSONSchema7,
        rootSchema,
        entityNames,
        inProgress,
        defsKey,
        depth + 1,
        maxDepth,
      );
    }
  }

  if (schema.allOf) {
    result.allOf = schema.allOf.map((sub) =>
      typeof sub === "boolean"
        ? sub
        : deepResolveSchema(
            sub as JSONSchema7,
            rootSchema,
            entityNames,
            inProgress,
            defsKey,
            depth + 1,
            maxDepth,
          ),
    );
  }

  if (schema.anyOf) {
    result.anyOf = schema.anyOf.map((sub) =>
      typeof sub === "boolean"
        ? sub
        : deepResolveSchema(
            sub as JSONSchema7,
            rootSchema,
            entityNames,
            inProgress,
            defsKey,
            depth + 1,
            maxDepth,
          ),
    );
  }

  if (schema.oneOf) {
    result.oneOf = schema.oneOf.map((sub) =>
      typeof sub === "boolean"
        ? sub
        : deepResolveSchema(
            sub as JSONSchema7,
            rootSchema,
            entityNames,
            inProgress,
            defsKey,
            depth + 1,
            maxDepth,
          ),
    );
  }

  return result;
}

/**
 * Builds a stub schema for partial validation.
 * Retains only primitive properties + @id / @type.
 * Sets `additionalProperties: true` and `required: []`.
 */
function buildStubSchema(
  resolvedSchema: JSONSchema7,
  rootSchema: JSONSchema7,
): JSONSchema7 {
  const primitiveProps = filterForPrimitives(
    resolvedSchema.properties,
    rootSchema,
  );

  return {
    type: "object",
    additionalProperties: true,
    required: [],
    properties: {
      "@id": { type: "string" },
      "@type": { type: "string" },
      ...primitiveProps,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compiles a JSON Schema into a `SchemaRegistry` by:
 * 1. Resolving the root-level `$ref` if present (Pattern D).
 * 2. Level 1 — shallow classification: determines `isEntity` and `typeIRI`
 *    for every definition, including allOf inheritance (Pattern E).
 * 3. Level 2 — deep resolution: inlines value-object `$ref`s, keeps entity
 *    `$ref`s as pointer strings, builds stub schemas.
 * 4. Builds `byName`, `byPath`, and `byTypeIRI` lookup maps.
 *
 * No JavaScript circular object references are created.
 */
export function compileSchema(
  rootSchema: JSONSchema7,
  options: CompileSchemaOptions = {},
): SchemaRegistry {
  const { maxDepth = 20 } = options;

  const defsKey = getDefintitionKey(rootSchema);
  const definitions = defs(rootSchema);

  // -------------------------------------------------------------------------
  // Resolve root-level $ref (Pattern D: `{ "$ref": "#/$defs/SomeType" }`)
  // -------------------------------------------------------------------------
  let resolvedRoot: JSONSchema7 = rootSchema;
  if (rootSchema.$ref) {
    const resolved = safeResolveRef(rootSchema.$ref, rootSchema);
    if (resolved) resolvedRoot = resolved;
  }

  // -------------------------------------------------------------------------
  // Level 1 — Shallow classification pass
  // -------------------------------------------------------------------------
  // Maps: defName → { isEntity, typeIRI, shallowSchema }
  interface Level1Info {
    isEntity: boolean;
    typeIRI?: string;
    shallowSchema: JSONSchema7;
  }
  const level1: Map<string, Level1Info> = new Map();

  for (const [name, defValue] of Object.entries(definitions)) {
    if (typeof defValue === "boolean") continue;
    const defSchema = defValue as JSONSchema7;

    // 1-level $ref resolution to get at properties
    const shallow = shallowResolveRef(defSchema, rootSchema);

    const isEntity = hasIdProperty(shallow, rootSchema);
    const typeIRI = isEntity ? extractTypeIRI(shallow) : undefined;

    level1.set(name, { isEntity, typeIRI, shallowSchema: shallow });
  }

  const entityNames = new Set(
    [...level1.entries()].filter(([, v]) => v.isEntity).map(([name]) => name),
  );

  // -------------------------------------------------------------------------
  // Level 2 — Deep resolution pass + stub schema construction
  // -------------------------------------------------------------------------
  const byName = new Map<string, SchemaRegistryEntry>();
  const byPath = new Map<string, SchemaRegistryEntry>();
  const byTypeIRI = new Map<string, SchemaRegistryEntry>();

  for (const [name, info] of level1.entries()) {
    const path = `#/${defsKey}/${name}`;

    const resolvedSchema = deepResolveSchema(
      info.shallowSchema,
      rootSchema,
      entityNames,
      new Set([name]), // start with the definition itself in progress
      defsKey,
      0,
      maxDepth,
    );

    const stubSchema = buildStubSchema(resolvedSchema, rootSchema);

    const entry: SchemaRegistryEntry = {
      name,
      path,
      resolvedSchema,
      stubSchema,
      isEntity: info.isEntity,
      typeIRI: info.typeIRI,
    };

    byName.set(name, entry);
    byPath.set(path, entry);
    // Support both #/definitions/ and #/$defs/ lookups regardless of which key the schema uses
    const altKey =
      defsKey === "$defs" ? `#/definitions/${name}` : `#/$defs/${name}`;
    byPath.set(altKey, entry);

    if (info.typeIRI) {
      byTypeIRI.set(info.typeIRI, entry);
    }
  }

  return {
    rootSchema,
    resolvedRoot,
    byName,
    byPath,
    byTypeIRI,
  };
}

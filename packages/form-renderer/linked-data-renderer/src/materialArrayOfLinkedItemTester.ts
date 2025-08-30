import { and, isObjectArray, rankWith, schemaMatches } from "@jsonforms/core";
import type { JSONSchema7 } from "json-schema";
import { isArrayOfLinkedItems } from "./isArrayOfLinkedItems";

export const materialArrayOfLinkedItemTester = rankWith(
  5,
  and(isObjectArray, isArrayOfLinkedItems),
);

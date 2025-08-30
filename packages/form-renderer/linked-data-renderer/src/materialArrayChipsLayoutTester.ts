import {
  and,
  isObjectArray,
  optionIs,
  RankedTester,
  rankWith,
} from "@jsonforms/core";
import { isArrayOfLinkedItems } from "./isArrayOfLinkedItems";

export const materialArrayChipsLayoutTester: RankedTester = rankWith(
  6,
  and(optionIs("chips", true), isArrayOfLinkedItems),
);

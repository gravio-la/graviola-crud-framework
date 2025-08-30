import {
  InlineCondensedSemanticFormsRenderer,
  inlineDropdownRendererTester,
  InlineDropdownSemanticFormsRenderer,
  inlineSemanticFormsRendererTester,
  materialArrayChipsLayoutTester,
  MaterialArrayOfLinkedItemChipsRenderer,
  MaterialArrayOfLinkedItemRenderer,
  materialArrayOfLinkedItemTester,
  materialLinkedObjectControlTester,
  MaterialLinkedObjectRenderer,
} from "@graviola/edb-linked-data-renderer";
import {
  JsonFormsRendererRegistryEntry,
  rankWith,
  scopeEndsWith,
} from "@jsonforms/core";

export const graviolaRenderers: JsonFormsRendererRegistryEntry[] = [
  {
    tester: materialArrayChipsLayoutTester,
    renderer: MaterialArrayOfLinkedItemChipsRenderer,
  },
  {
    tester: inlineSemanticFormsRendererTester,
    renderer: InlineCondensedSemanticFormsRenderer,
  },
  {
    tester: inlineDropdownRendererTester,
    renderer: InlineDropdownSemanticFormsRenderer,
  },
  {
    tester: materialLinkedObjectControlTester,
    renderer: MaterialLinkedObjectRenderer,
  },
  {
    tester: materialArrayOfLinkedItemTester,
    renderer: MaterialArrayOfLinkedItemRenderer,
  },
  {
    tester: rankWith(10, scopeEndsWith("@id")),
    renderer: () => null,
  },
  {
    tester: rankWith(10, scopeEndsWith("@type")),
    renderer: () => null,
  },
];

import { JSONSchema7 } from "json-schema";
import { MenuGroup, MenuItem } from "../menu/types";
import { MenuUISchema, SidebarConfig, CustomMenuItem } from "./types";

/**
 * Creates a menu group from a JSON Schema with UI configuration
 */
export function createMenuFromSchema(
  schema: JSONSchema7,
  uiSchema: MenuUISchema = {},
  config: SidebarConfig = {},
  customMenuItems: CustomMenuItem[] = [],
  t: (key: string) => string = (key) => key,
): MenuGroup {
  const definitions = schema.definitions || schema["$defs"] || {};
  const {
    prioritizedDefinitions = [],
    hiddenDefinitions = [],
    defaultConfig = {},
  } = config;

  // Get all definition keys
  const allDefinitionKeys = Object.keys(definitions);

  // Filter out hidden definitions
  const visibleDefinitionKeys = allDefinitionKeys.filter(
    (key) => !hiddenDefinitions.includes(key),
  );

  // Separate prioritized and remaining definitions
  const prioritizedKeys = prioritizedDefinitions.filter((key) =>
    visibleDefinitionKeys.includes(key),
  );
  const remainingKeys = visibleDefinitionKeys.filter(
    (key) => !prioritizedDefinitions.includes(key),
  );

  // Create menu items for prioritized definitions
  const prioritizedItems: MenuItem[] = prioritizedKeys.map((key) =>
    createMenuItemFromDefinition(key, uiSchema[key] || defaultConfig, t),
  );

  // Create menu items for remaining definitions
  const remainingItems: MenuItem[] = remainingKeys.map((key) =>
    createMenuItemFromDefinition(key, uiSchema[key] || defaultConfig, t),
  );

  // Create menu items for custom items
  const customItems: MenuItem[] = customMenuItems.map((item) => ({
    id: item.id,
    type: "item" as const,
    title: item.title,
    caption: item.caption,
    icon: item.icon,
    disabled: item.disabled,
    // MenuItem specific fields
    typeName: undefined,
    readOnly: false,
  }));

  // Combine all items
  const allItems = [...prioritizedItems, ...remainingItems, ...customItems];

  return {
    id: "schema-menu",
    type: "group",
    children: allItems,
  };
}

/**
 * Creates a single menu item from a schema definition key and its UI config
 */
function createMenuItemFromDefinition(
  definitionKey: string,
  uiConfig: MenuUISchema[string] = {},
  t: (key: string) => string,
): MenuItem {
  const {
    title,
    caption,
    icon,
    disabled = false,
    editable = true,
    url,
  } = uiConfig;

  return {
    id: `list_${definitionKey}`,
    type: "item" as const,
    title: title || t(definitionKey),
    caption,
    icon,
    disabled,
    typeName: definitionKey,
    readOnly: !editable,
    url,
  };
}

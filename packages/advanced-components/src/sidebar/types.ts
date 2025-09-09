import React from "react";
import { JSONSchema7 } from "json-schema";

/**
 * Configuration for a schema definition in the sidebar menu
 */
export interface SchemaDefinitionConfig {
  /** Whether this definition should be editable (shows create button) */
  editable?: boolean;
  /** Icon component to display for this definition */
  icon?: string | React.FC<{ stroke: number; size: string }>;
  /** Custom display title (defaults to the schema key) */
  title?: string;
  /** Custom caption/subtitle */
  caption?: string;
  /** Whether to disable this menu item */
  disabled?: boolean;
  /** Custom URL for navigation (if different from default pattern) */
  url?: string;
}

/**
 * UI configuration schema that maps schema definition keys to UI options
 */
export interface MenuUISchema {
  [definitionKey: string]: SchemaDefinitionConfig;
}

/**
 * Configuration for prioritized schema definitions that should appear at the top
 */
export interface SidebarConfig {
  /** Schema definitions that should appear at the top of the menu */
  prioritizedDefinitions?: string[];
  /** Schema definitions that should be hidden from the menu */
  hiddenDefinitions?: string[];
  /** Default configuration for all definitions */
  defaultConfig?: SchemaDefinitionConfig;
}

/**
 * Callback functions for sidebar interactions
 */
export interface SidebarCallbacks {
  /** Called when a list item is clicked */
  onNavigateToList?: (definitionKey: string) => void;
  /** Called when create button is clicked */
  onCreateNew?: (definitionKey: string) => void;
  /** Called when a custom menu item is clicked */
  onCustomItemClick?: (itemId: string) => void;
}

/**
 * Props for the Sidebar component
 */
export interface SidebarProps {
  /** JSON Schema with definitions */
  schema: JSONSchema7;
  /** UI configuration for schema definitions */
  uiSchema?: MenuUISchema;
  /** General sidebar configuration */
  config?: SidebarConfig;
  /** Callback functions */
  callbacks?: SidebarCallbacks;
  /** Whether the sidebar is open/expanded */
  open?: boolean;
  /** Called when sidebar should be closed */
  onClose?: () => void;
  /** Additional custom menu items */
  customMenuItems?: CustomMenuItem[];
  /** Translation function for internationalization */
  t?: (key: string) => string;
}

/**
 * Custom menu item that can be added to the sidebar
 */
export interface CustomMenuItem {
  id: string;
  title: string;
  icon?: string | React.FC<{ stroke: number; size: string }>;
  onClick?: () => void;
  disabled?: boolean;
  caption?: string;
}

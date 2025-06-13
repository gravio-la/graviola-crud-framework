import { AutocompleteSuggestion, PrimaryField } from "@graviola/edb-core-types";
import { useAdbContext, useDataStore } from "@graviola/edb-state-hooks";
import { useQuery } from "@graviola/edb-state-hooks";
import {
  Avatar,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  TextFieldProps,
  useControlled,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import React, { FunctionComponent, useCallback } from "react";
import parse from "html-react-parser";
import { DebouncedAutocomplete } from "../form";
import {
  applyToEachField,
  extractFieldIfString,
} from "@graviola/edb-data-mapping";
import { useTranslation } from "next-i18next";
import { withEllipsis } from "@graviola/edb-ui-utils";

interface OwnProps {
  selected?: AutocompleteSuggestion | null;
  onSelectionChange?: (selection: AutocompleteSuggestion | null) => void;
  typeIRI?: string;
  title?: string;
  typeName?: string;
  readonly?: boolean;
  defaultSelected?: AutocompleteSuggestion | null;
  loadOnStart?: boolean;
  limit?: number;
  onDebouncedSearchChange?: (value: string | undefined) => void;
  condensed?: boolean;
  inputProps?: TextFieldProps;
  onSearchValueChange?: (value: string | undefined) => void;
  onCreateNew?: (value: string | undefined) => void;
  searchString?: string;
  autocompleteDisabled?: boolean;
  disabled?: boolean;
  allowHtmlLabel?: boolean;
}

export type DiscoverAutocompleteInputProps = OwnProps;

export const DiscoverAutocompleteInput: FunctionComponent<
  DiscoverAutocompleteInputProps
> = ({
  title = "",
  typeName,
  readonly,
  defaultSelected,
  selected,
  onSelectionChange,
  onCreateNew,
  typeIRI,
  loadOnStart,
  limit,
  onDebouncedSearchChange,
  condensed,
  inputProps,
  onSearchValueChange,
  searchString: searchStringProp,
  autocompleteDisabled,
  disabled,
  allowHtmlLabel = false,
}) => {
  const {
    queryBuildOptions: {
      primaryFields,
      primaryFieldExtracts,
      typeIRItoTypeName,
    },
  } = useAdbContext();
  const { dataStore } = useDataStore();
  const [selectedValue, setSelectedUncontrolled] =
    useControlled<AutocompleteSuggestion | null>({
      name: "DiscoverAutocompleteInput-selected",
      controlled: selected,
      default: defaultSelected || null,
    });

  const [searchString, setSearchString] = useControlled<string | undefined>({
    name: "DiscoverAutocompleteInput-searchString",
    controlled: searchStringProp,
    default: "",
  });
  const handleChange = useCallback(
    (e: React.SyntheticEvent, item: AutocompleteSuggestion | null) => {
      //e.stopPropagation();
      //e.preventDefault();
      if (item?.value === null) {
        onCreateNew?.(searchString);
        // Reset selection state immediately after triggering create new
        onSelectionChange?.(null);
        setSelectedUncontrolled(null);
        onSearchValueChange?.(searchString);
        setSearchString(searchString);
        return;
      }

      onSelectionChange?.(item);
      setSelectedUncontrolled(item);
      onSearchValueChange?.(null);
      setSearchString(null);
    },
    [
      onSelectionChange,
      setSelectedUncontrolled,
      onSearchValueChange,
      onCreateNew,
      setSearchString,
      searchString,
    ],
  );

  const load = useCallback(
    async (searchString?: string) =>
      typeIRI
        ? (
            await dataStore.findDocuments(
              typeName,
              {
                search: searchString || null,
              },
              limit,
            )
          ).map((doc) => {
            const { label, image, description } = applyToEachField(
              doc,
              primaryFieldExtracts[typeName] ||
                (primaryFields[typeName] as PrimaryField),
              extractFieldIfString,
            );
            const suggestion = {
              label,
              description,
              image,
              value: doc["@id"],
            } as AutocompleteSuggestion;
            return suggestion;
          })
        : [],
    [typeIRI, limit, dataStore, primaryFields, primaryFieldExtracts],
  );

  const { data: basicFields } = useQuery({
    queryKey: ["entity", selected?.value, typeIRI, "load"],
    queryFn: async () => {
      const value = selected?.value;
      if (value && typeIRI) {
        const typeName = typeIRItoTypeName(typeIRI);
        const data = await dataStore.loadDocument(typeName, value);
        const fieldDeclaration =
          primaryFieldExtracts[typeName] ||
          (primaryFields[typeName] as PrimaryField | undefined);
        return applyToEachField(data, fieldDeclaration, extractFieldIfString);
      }
      return null;
    },
    enabled: Boolean(
      typeof selected?.value === "string" &&
        (!selected?.label || selected?.label?.length === 0),
    ),
  });

  const handleSearchValueChange = useCallback(
    (value: string | undefined) => {
      onSearchValueChange?.(value);
      setSearchString(value);
    },
    [onSearchValueChange, setSearchString],
  );

  const handleGetOptionLabel = useCallback(
    (option: AutocompleteSuggestion) => {
      return option.label || basicFields?.label || option.value || "";
    },
    [basicFields],
  );
  const { t } = useTranslation();

  return (
    <DebouncedAutocomplete
      disabled={disabled}
      title={title}
      readOnly={readonly}
      loadOnStart={true}
      ready={Boolean(typeIRI)}
      // @ts-ignore
      load={load}
      initialQueryKey={typeIRI}
      value={selectedValue || { label: searchString, value: null }}
      getOptionLabel={handleGetOptionLabel}
      placeholder={t("search for", { typeName })}
      renderOption={(props, option: AutocompleteSuggestion) =>
        !option.value && onCreateNew ? (
          <ListItem disablePadding {...props} key="create-new">
            <ListItemButton
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  onCreateNew?.(searchString);
                }
              }}
            >
              <AddIcon />
              <ListItemText primary={t("Create new entity", { typeName })} />
            </ListItemButton>
          </ListItem>
        ) : (
          <ListItem disablePadding {...props} key={option.value}>
            {option.image && (
              <ListItemAvatar>
                <Avatar src={option.image} alt={option.label} />
              </ListItemAvatar>
            )}
            <ListItemText
              sx={{
                "& .MuiListItemText-primary .searchmatch": {
                  fontWeight: "bold",
                },
              }}
              primary={allowHtmlLabel ? parse(option.label) : option.label}
              secondary={withEllipsis(option.description, 50)}
            />
          </ListItem>
        )
      }
      // @ts-ignore
      onChange={handleChange}
      onDebouncedSearchChange={onDebouncedSearchChange}
      condensed={condensed}
      onSearchValueChange={handleSearchValueChange}
      inputProps={inputProps}
      autocompleteDisabled={autocompleteDisabled}
    />
  );
};

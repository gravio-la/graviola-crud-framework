import NiceModal from "@ebay/nice-modal-react";
import { useDeclarativeMapper } from "@graviola/data-mapping-hooks";
import { ClassicResultListWrapper } from "@graviola/edb-basic-components";
import { PrimaryField } from "@graviola/edb-core-types";
import {
  useAdbContext,
  useModalRegistry,
  useSimilarityFinderState,
} from "@graviola/edb-state-hooks";
import {
  FinderKnowledgeBaseDescription,
  FindOptions,
  KnowledgeSources,
  EntityFinderProps,
} from "@graviola/semantic-jsonform-types";
import { NoteAdd } from "@mui/icons-material";
import {
  Button,
  CircularProgress,
  Grid,
  List,
  Menu,
  MenuItem,
  TextField,
} from "@mui/material";
import { debounce, uniq } from "lodash-es";
import { useTranslation } from "next-i18next";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SearchFieldWithBadges } from "./SearchFieldWithBadges";

const performSearch = (
  searchString: string,
  typeIRI: string,
  typeName: string,
  findOptions: FindOptions,
  knowledgeBases: FinderKnowledgeBaseDescription<any>[],
  setSearchResults: (searchResults: Record<KnowledgeSources, any[]>) => void,
  setElementCount: (resultCount: number) => void,
) => {
  return Promise.all(
    knowledgeBases.map(async (kb) => {
      return {
        [kb.id]: await kb.find(searchString, typeIRI, typeName, findOptions),
      };
    }),
  ).then((results) => {
    if (!results) return;
    const searchResults = Object.assign({}, ...results) as Record<
      KnowledgeSources,
      any[]
    >;
    setSearchResults(searchResults);
    const resultCount = Object.values(searchResults).reduce(
      (acc, list = []) => acc + list.length,
      0,
    );
    setElementCount(resultCount);
  });
};

type AdvancedFilterSettingsMenuProps = {
  onLimitChange: (limit: number) => void;
  limit: number;
};

const AdvancedFilterSettingsMenu = ({
  onLimitChange,
  limit,
}: AdvancedFilterSettingsMenuProps) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const handleLimitChange = useCallback(
    (e: any) => onLimitChange(parseInt(e.target.value)),
    [onLimitChange],
  );

  return (
    <Grid container alignItems="center">
      <Grid item>
        <Button
          size="small"
          variant="outlined"
          aria-haspopup="true"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          title={t("limit")}
        >
          {t("limit")}: {limit}
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem sx={{ p: 2 }}>
            <TextField
              label={t("limit")}
              type="number"
              value={limit}
              onChange={handleLimitChange}
              inputProps={{
                min: 1,
                max: 100,
                step: 1,
              }}
              size="small"
              sx={{ width: "100px" }}
            />
          </MenuItem>
        </Menu>
      </Grid>
    </Grid>
  );
};

export const EntityFinder = <
  FindResultType = any,
  FullEntityType = any,
  SourceType extends string = string,
>({
  finderId,
  classIRI: typeIRI,
  onEntityIRIChange,
  onExistingEntityAccepted,
  onMappedDataAccepted,
  onSelectedEntityChange,
  search,
  onSearchChange,
  hideFooter,
  knowledgeSources,
  additionalKnowledgeSources,
  allKnowledgeBases,
  prepareNewEntityData,
}: EntityFinderProps<FindResultType, FullEntityType, SourceType>) => {
  const {
    queryBuildOptions,
    normDataMapping = {},
    createEntityIRI,
    typeIRIToTypeName,
    components: { EditEntityModal },
  } = useAdbContext();

  const [localSearch, setSearchString] = useState<string | undefined>();
  const searchString = localSearch || search;

  const handleSearchStringChange = useCallback(
    (value: string) => {
      setSearchString(value);
      onSearchChange?.(value);
    },
    [setSearchString, onSearchChange],
  );

  const typeName = useMemo(
    () => typeIRIToTypeName(typeIRI),
    [typeIRI, typeIRIToTypeName],
  );

  const selectedKnowledgeSources = useMemo(() => {
    const preselectedKnowledgeSources =
      knowledgeSources ||
      (allKnowledgeBases || [])
        .filter((kb) => normDataMapping[kb.authorityIRI]?.mapping?.[typeName])
        .map((kb) => kb.id);

    return uniq([
      "kb",
      ...preselectedKnowledgeSources,
      ...(additionalKnowledgeSources || []),
    ]);
  }, [
    additionalKnowledgeSources,
    knowledgeSources,
    normDataMapping,
    allKnowledgeBases,
  ]);

  const { primaryFields } = queryBuildOptions;

  const [limit, setLimit] = useState(20);
  const handleLimitChange = useCallback(
    (limit: number) => setLimit(limit),
    [setLimit],
  );
  const {
    resetElementIndex,
    elementIndex,
    setElementCount,
    setElementIndex,
    activeFinderIds,
    addActiveFinder,
    removeActiveFinder,
  } = useSimilarityFinderState();
  useEffect(() => {
    resetElementIndex();
    addActiveFinder(finderId);
    return () => {
      removeActiveFinder(finderId);
    };
  }, [resetElementIndex, addActiveFinder, removeActiveFinder, finderId]);

  const { t } = useTranslation();
  const knowledgeBases = useMemo(
    () =>
      (allKnowledgeBases || []).filter(({ id }) =>
        selectedKnowledgeSources.includes(id),
      ),
    [allKnowledgeBases, selectedKnowledgeSources],
  );

  const [searchResults, setSearchResults] = useState<
    Record<KnowledgeSources, any[]>
  >(
    Object.fromEntries(knowledgeBases.map((kb) => [kb.id, []])) as Record<
      KnowledgeSources,
      any[]
    >,
  );

  const debouncedSearch = React.useRef(debounce(performSearch, 500)).current;

  const doSearch = useCallback(
    (search: string) =>
      debouncedSearch(
        search,
        typeIRI,
        typeIRIToTypeName(typeIRI),
        { limit },
        knowledgeBases,
        setSearchResults,
        setElementCount,
      ),
    [
      knowledgeBases,
      typeIRI,
      limit,
      setSearchResults,
      setElementCount,
      debouncedSearch,
      typeIRIToTypeName,
    ],
  );

  const [mappingInProgress, setMappingInProgress] = useState(false);

  useEffect(() => {
    debouncedSearch.cancel();
    if (!searchString || searchString.length < 1) return;
    doSearch(searchString);
  }, [searchString]);

  const { mapData } = useDeclarativeMapper();
  const handleManuallyMapData = useCallback(
    async (id: string | undefined, entryData: any, source: string) => {
      setMappingInProgress(true);
      if (!id || !entryData?.allProps) return;
      try {
        const knowledgeBase = knowledgeBases.find((kb) => kb.id === source);
        const finalData = await mapData(
          id,
          typeIRI,
          entryData,
          knowledgeBase.authorityIRI,
        );
        onMappedDataAccepted?.(finalData);
      } catch (e) {
        console.error("could not map from authority", e);
      }
      setMappingInProgress(false);
    },
    [
      mapData,
      typeIRI,
      onMappedDataAccepted,
      knowledgeBases,
      setMappingInProgress,
    ],
  );

  const handleEntityChange = useCallback(
    (id: string | undefined, data: any) => {
      onEntityIRIChange?.(id);
      onExistingEntityAccepted?.(id, data);
    },
    [onEntityIRIChange, onExistingEntityAccepted],
  );

  const handleAccept = useCallback(
    (id: string | undefined, entryData: any, source: string) => {
      if (source === "kb") {
        handleEntityChange(id, entryData);
      } else {
        handleManuallyMapData(id, entryData, source);
      }
    },
    [handleManuallyMapData, handleEntityChange],
  );

  const { cycleThroughElements } = useSimilarityFinderState();
  const handleKeyUp = useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement>) => {
      if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
        cycleThroughElements(ev.key === "ArrowDown" ? 1 : -1);
        ev.preventDefault();
      }
    },
    [cycleThroughElements],
  );
  const [margin, setMargin] = useState(0);
  const [ref, setRef] = useState<any | undefined>();
  useEffect(() => {
    if (ref) {
      setMargin(ref.clientHeight);
    }
  }, [ref]);
  const { registerModal, modalRegistry } = useModalRegistry(NiceModal);

  const getDefaultLabelKey = useCallback(() => {
    const fieldDefinitions = primaryFields[typeName] as
      | PrimaryField
      | undefined;
    return fieldDefinitions?.label || "title";
  }, [primaryFields, typeName]);

  const showEditDialog = useCallback(async () => {
    const defaultLabelKey = getDefaultLabelKey();
    const newItem = {
      "@id": createEntityIRI(typeName),
      "@type": typeIRI,
      [defaultLabelKey]: searchString,
    };
    const modalID = `edit-${newItem["@type"]}-${newItem["@id"]}`;
    registerModal(modalID, EditEntityModal);
    const preparedData = prepareNewEntityData
      ? await prepareNewEntityData(newItem)
      : newItem;
    NiceModal.show(modalID, {
      entityIRI: newItem["@id"],
      typeIRI: newItem["@type"],
      data: preparedData,
      disableLoad: true,
    }).then(({ entityIRI, data }: { entityIRI: string; data: any }) => {
      handleEntityChange(entityIRI, data);
    });
  }, [
    registerModal,
    typeName,
    typeIRI,
    searchString,
    handleEntityChange,
    createEntityIRI,
    getDefaultLabelKey,
    EditEntityModal,
    prepareNewEntityData,
  ]);

  /**
   * in order to give each element an index across all knowledge sources we need to
   * merge the results and add an index to each element
   * */
  const resultsWithIndex = useMemo(() => {
    let idx = 0;
    const intermediate = Object.entries(searchResults).reduce(
      (acc, [key, value]) => [
        ...acc,
        ...value.map((entry) => {
          idx++;
          return { entry, idx, key };
        }),
      ],
      [],
    );
    return Object.fromEntries(
      Object.keys(searchResults).map((kb) => [
        kb,
        intermediate.filter(({ key }) => key === kb),
      ]),
    );
  }, [searchResults]);

  const finderIsActive = useMemo(
    () =>
      activeFinderIds.includes(finderId) &&
      activeFinderIds[activeFinderIds.length - 1] === finderId,
    [activeFinderIds, finderId],
  );

  const handleSelectEntity = useCallback(
    (id: string, index: number, kb: FinderKnowledgeBaseDescription) => {
      setElementIndex(index);
      if (onSelectedEntityChange) {
        onSelectedEntityChange(id, kb.authorityIRI);
      }
    },
    [setElementIndex, onSelectedEntityChange],
  );

  return (
    finderIsActive && (
      <div style={{ overflow: "hidden", position: "relative" }}>
        {mappingInProgress ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.7)",
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </div>
        ) : null}
        <div
          style={{
            filter: mappingInProgress ? "grayscale(100%)" : "none",
            pointerEvents: mappingInProgress ? "none" : "auto",
          }}
        >
          <Grid
            container
            alignItems="center"
            direction={"column"}
            spacing={2}
            style={{ overflowY: "auto", marginBottom: margin }}
          >
            <Grid item sx={{ width: "100%" }}>
              <SearchFieldWithBadges
                onCreateNew={showEditDialog}
                disabled={false}
                searchString={searchString}
                typeIRI={typeIRI}
                onSearchStringChange={handleSearchStringChange}
                selectedKnowledgeSources={selectedKnowledgeSources}
                knowledgeBases={knowledgeBases}
                onKeyUp={handleKeyUp}
                advancedConfigChildren={
                  <AdvancedFilterSettingsMenu
                    onLimitChange={handleLimitChange}
                    limit={limit}
                  />
                }
              />
            </Grid>
            <Grid
              item
              sx={{
                width: "100%",
                height: `calc(100vh - 150px)`,
                display: "flex",
                flexDirection: "column" /* flexWrap: 'wrap'*/,
              }}
            >
              {knowledgeBases.map((kb) => {
                const entries = resultsWithIndex[kb.id] || [];
                return (
                  <ClassicResultListWrapper
                    key={kb.id}
                    label={kb.label}
                    hitCount={entries.length}
                  >
                    {searchString && (
                      <List>
                        {entries.map(({ entry, idx }) =>
                          kb.listItemRenderer(
                            entry,
                            idx,
                            typeIRI,
                            elementIndex === idx,
                            (id, index) => handleSelectEntity(id, index, kb),
                            (id, data) => handleAccept(id, data, kb.id),
                          ),
                        )}
                      </List>
                    )}
                  </ClassicResultListWrapper>
                );
              })}
              {Array.from(modalRegistry)
                .map((modal) => modal)
                .join(",")}
            </Grid>
          </Grid>
          <Grid
            container
            ref={setRef}
            alignItems="center"
            justifyContent="center"
            direction={"column"}
            sx={{
              display: hideFooter ? "none" : "flex",
              position: "absolute",
              bottom: 0,
              right: 0,
              left: 0,
              backgroundColor: "white",
            }}
          >
            <Button
              variant="contained"
              color={"primary"}
              startIcon={<NoteAdd />}
              onClick={showEditDialog}
            >
              {t("create new", { item: t(typeName) })}
            </Button>
          </Grid>
        </div>
      </div>
    )
  );
};

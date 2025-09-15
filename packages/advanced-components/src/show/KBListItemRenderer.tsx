import { ClassicResultListItem } from "@graviola/edb-basic-components";
import {
  useAdbContext,
  useCRUDWithQueryClient,
  useSimilarityFinderState,
} from "@graviola/edb-state-hooks";
import { ListItemRendererProps } from "@graviola/semantic-jsonform-types";
import CheckIcon from "@mui/icons-material/Check";
import { IconButton, Stack } from "@mui/material";
import { useCallback, useEffect, useMemo } from "react";

import { EntityDetailElement } from "./EntityDetailElement";

export const KBListItemRenderer = ({
  data,
  idx,
  typeIRI,
  selected,
  onSelect,
  onAccept,
}: ListItemRendererProps) => {
  const { id, label, avatar, secondary } = data;
  const { loadEntity } = useCRUDWithQueryClient({
    entityIRI: id,
    typeIRI,
    queryOptions: { enabled: false },
    loadQueryKey: "load",
  });
  const { resetElementIndex } = useSimilarityFinderState();
  const handleAccept = useCallback(async () => {
    const finalData = (await loadEntity(id, typeIRI))?.document;
    if (!finalData) {
      console.warn("could not load entity");
      return;
    }
    resetElementIndex();
    onAccept?.(id, finalData);
  }, [onAccept, id, loadEntity, typeIRI, resetElementIndex]);
  const { acceptWishPending, setAcceptWishPending } =
    useSimilarityFinderState();
  useEffect(() => {
    if (selected && handleAccept && acceptWishPending) {
      setAcceptWishPending(false);
      handleAccept();
    }
  }, [handleAccept, selected, acceptWishPending, setAcceptWishPending]);

  return (
    <ClassicResultListItem
      key={id}
      id={id}
      index={idx}
      onSelected={onSelect}
      label={label}
      secondary={secondary}
      avatar={avatar}
      altAvatar={String(idx)}
      selected={selected}
      onEnter={handleAccept}
      listItemProps={{
        secondaryAction: (
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleAccept}>
              <CheckIcon />
            </IconButton>
          </Stack>
        ),
      }}
      popperChildren={
        <EntityDetailElement
          sx={{
            maxWidth: "30em",
            maxHeight: "80vh",
            overflow: "auto",
          }}
          entityIRI={id}
          typeIRI={typeIRI}
          data={undefined}
          cardActionChildren={null}
          readonly
        />
      }
    />
  );
};

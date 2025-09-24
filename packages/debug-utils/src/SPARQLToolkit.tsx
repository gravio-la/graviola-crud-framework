import { Button, Switch, FormControlLabel } from "@mui/material";
import React, { FunctionComponent, useState } from "react";

import { YasguiSPARQLEditorNoSSR } from "./YasguiSPARQLEditorNoSSR";
import { useAdbContext } from "@graviola/edb-state-hooks";

import { YasguiSPARQLEditorProps } from "./YasguiSPARQLEditorProps";

interface OwnProps {
  onSendClicked?: () => void;
}

type Props = OwnProps & YasguiSPARQLEditorProps;

export const SPARQLToolkit: FunctionComponent<Props> = ({
  onSendClicked,
  ...props
}) => {
  const [editorEnabled, setEditorEnabled] = useState(false);
  const {
    queryBuildOptions: { prefixes },
  } = useAdbContext();
  return (
    <>
      {editorEnabled ? (
        <>
          <YasguiSPARQLEditorNoSSR {...props} prefixes={prefixes} />
          <Button onClick={() => onSendClicked && onSendClicked()}>
            query
          </Button>
        </>
      ) : null}
      <FormControlLabel
        control={
          <Switch
            checked={editorEnabled}
            onChange={() => setEditorEnabled((e) => !e)}
          />
        }
        label="sparql"
      />
    </>
  );
};

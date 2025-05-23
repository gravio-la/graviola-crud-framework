import { Close as CloseIcon } from "@mui/icons-material";
import {
  AppBar,
  Backdrop,
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import React, { FunctionComponent, useCallback, useState } from "react";

import { useLocalSettings } from "../../state";
import AuthorityConfigForm from "./AuthorityConfigForm";
import EndpointChooser from "./EndpointChooser";
import FeatureForm from "./FeatureForm";
import GoogleDriveSettingsForm from "./GoogleDriveSettingsForm";
import OpenAISettingsForm from "./OpenAISettingsForm";

interface OwnProps {}

type Props = OwnProps;

const SettingsModal: FunctionComponent<Props> = (props) => {
  const [forceFullscreen, setForceFullscreen] = useState(false);
  const { settingsOpen, closeSettings } = useLocalSettings();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

  const handleClose = useCallback(
    (reloadWindow = false) => {
      closeSettings();
      //reload
      reloadWindow && window && window.location.reload();
    },
    [closeSettings],
  );

  return (
    <Dialog
      fullScreen={fullScreen || forceFullscreen}
      open={settingsOpen}
      onClose={() => handleClose(false)}
      aria-labelledby="responsive-dialog-title"
      fullWidth={true}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 500,
        },
      }}
    >
      <AppBar enableColorOnDark position="static">
        <Toolbar variant="dense">
          <Box sx={{ flexGrow: 3 }}>
            <Typography variant="h4" color="inherit" component="div">
              {"Einstellungen"}
            </Typography>
          </Box>
          <IconButton
            size="large"
            aria-label="close without saving"
            onClick={() => handleClose(false)}
            color="inherit"
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <DialogContent>
        <Grid container spacing={2} direction={"column"}>
          <Grid item>
            <EndpointChooser />
          </Grid>
          <Grid item>
            <AuthorityConfigForm />
          </Grid>
          <Grid item>
            <FeatureForm />
          </Grid>
          <Grid item>
            <OpenAISettingsForm />
          </Grid>
          <Grid item>
            <GoogleDriveSettingsForm />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        {
          <Button autoFocus onClick={() => handleClose(true)}>
            schließen und neu laden
          </Button>
        }
      </DialogActions>
    </Dialog>
  );
};

export default SettingsModal;

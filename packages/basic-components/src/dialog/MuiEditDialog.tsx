import {
  Close as CloseIcon,
  DeleteForever as RemoveIcn,
  Fullscreen as FullscreenIcon,
  Refresh as ReloadIcon,
  Save as SaveIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  EditOff as EditOffIcon,
  SearchOff,
} from "@mui/icons-material";
import {
  alpha,
  AppBar,
  Backdrop,
  Badge,
  Box,
  IconButton,
  styled,
  Toolbar,
  Typography,
} from "@mui/material";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslation } from "next-i18next";
import { type ReactNode, useCallback, useState } from "react";

const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  "&:hover": {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: "100%",
  [theme.breakpoints.up("sm")]: {
    marginLeft: theme.spacing(3),
    width: "auto",
  },
}));

export type MuiEditDialogProps = {
  onCancel?: () => void;
  onSave?: () => void;
  onClose?: () => void;
  onReload?: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
  editMode?: boolean;
  open?: boolean;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
};
export const MuiEditDialog = ({
  children,
  open,
  title,
  onSave,
  onCancel,
  onClose,
  onReload,
  onRemove,
  onEdit,
  editMode,
  actions,
}: MuiEditDialogProps) => {
  const theme = useTheme();
  const [forceFullscreen, setForceFullscreen] = useState(false);
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

  const { t } = useTranslation();

  return (
    <Dialog
      fullScreen={fullScreen || forceFullscreen}
      open={Boolean(open)}
      onClose={onClose}
      fullWidth={true}
      maxWidth={"lg"}
      scroll={"paper"}
      disableScrollLock={false}
      onClick={(e) => e.stopPropagation()}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 500,
        },
      }}
    >
      <AppBar position="static">
        <Toolbar variant="dense">
          <Typography variant="h6" color="inherit" component="div">
            {title || t("edit-dialog.title")}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: "flex" }}>
            {editMode && (
              <>
                {onSave && (
                  <IconButton
                    size="large"
                    aria-label={t("edit-dialog.save")}
                    onClick={onSave}
                    color="inherit"
                  >
                    <SaveIcon />
                  </IconButton>
                )}
                {onRemove && (
                  <IconButton onClick={onRemove} color="inherit">
                    <RemoveIcn />
                  </IconButton>
                )}
              </>
            )}
            {onEdit && (
              <IconButton
                size="large"
                aria-label={t("edit-dialog.toggle-edit-mode")}
                onClick={onEdit}
                color="inherit"
              >
                {editMode ? <EditOffIcon /> : <EditIcon />}
              </IconButton>
            )}
            {onReload && (
              <IconButton
                size="large"
                aria-label={t("edit-dialog.reload")}
                onClick={onReload}
                color="inherit"
              >
                <ReloadIcon />
              </IconButton>
            )}
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <IconButton
                size="large"
                aria-label={t("edit-dialog.fullscreen")}
                onClick={() => setForceFullscreen((ff) => !ff)}
                color="inherit"
              >
                <FullscreenIcon />
              </IconButton>
            </Box>
            <IconButton
              size="large"
              aria-label={t("edit-dialog.close")}
              onClick={onClose}
              color="inherit"
            >
              <Badge color="error">
                <CloseIcon />
              </Badge>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        {actions || (
          <>
            {onCancel && (
              <Button autoFocus onClick={onCancel}>
                {t("cancel")}
              </Button>
            )}
            {onSave && (
              <Button onClick={onSave} autoFocus>
                {t("save")}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

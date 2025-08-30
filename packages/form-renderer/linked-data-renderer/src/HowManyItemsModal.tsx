import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Close as CloseIcon } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  IconButton,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { useTranslation } from "next-i18next";
import { useState } from "react";

type HowManyItemsModalProps = {
  entityType: string;
  min?: number;
  max?: number;
  defaultValue?: number;
};

export const HowManyItemsModal = NiceModal.create<HowManyItemsModalProps>(
  ({ entityType, min = 1, max = 100, defaultValue = 1 }) => {
    const modal = useModal();
    const { t } = useTranslation();
    const [value, setValue] = useState<number>(defaultValue);
    const [error, setError] = useState<string>("");

    const validateValue = (newValue: number): boolean => {
      if (newValue < min) {
        setError(t("validation.min", { min }));
        return false;
      }
      if (newValue > max) {
        setError(t("validation.max", { max }));
        return false;
      }
      setError("");
      return true;
    };

    const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseInt(event.target.value, 10);
      if (!isNaN(newValue)) {
        setValue(newValue);
        validateValue(newValue);
      }
    };

    const handleConfirm = () => {
      if (validateValue(value)) {
        modal.resolve(value);
        modal.remove();
      }
    };

    return (
      <Dialog
        open={modal.visible}
        onClose={() => modal.remove()}
        fullWidth={true}
        maxWidth="sm"
        scroll={"paper"}
        disableScrollLock={false}
      >
        <AppBar position="static">
          <Toolbar variant="dense">
            <Typography variant="h6" color="inherit" component="div">
              {t("howManyItems.title")}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ display: "flex" }}>
              <IconButton
                size="large"
                aria-label="close without saving"
                onClick={() => modal.remove()}
                color="inherit"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("howManyItems.description", { entityType })}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label={t("howManyItems.inputLabel")}
            type="number"
            fullWidth
            variant="outlined"
            value={value}
            onChange={handleValueChange}
            error={!!error}
            helperText={error || t("howManyItems.helperText", { min, max })}
            inputProps={{
              min,
              max,
              step: 1,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => modal.remove()}>{t("cancel")}</Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            disabled={!!error || value < min || value > max}
          >
            {t("confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    );
  },
);

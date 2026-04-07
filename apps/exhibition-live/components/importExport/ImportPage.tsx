import NiceModal from "@ebay/nice-modal-react";
import { useModifiedRouter } from "@graviola/edb-state-hooks";
import { Box, Button, Grid } from "@mui/material";
import { hasGrantedAnyScopeGoogle, useGoogleOAuth } from "@react-oauth/google";
import React, { FunctionComponent, useCallback, useMemo } from "react";

import { GoogleDrivePickerModal } from "../google/GoogleDrivePicker";
import { Login } from "../google/GoogleOAuth";
import { GoogleSpreadSheetContainer } from "../google/GoogleSpreadSheetContainer";
import { useGoogleToken } from "../google/useGoogleToken";

const scopes: [string, string, string] = [
  "https://www.googleapis.com/auth/drive.readonly.metadata",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];
export const ImportPage: FunctionComponent = () => {
  const { credentials } = useGoogleToken();
  const { clientId } = useGoogleOAuth();
  const router = useModifiedRouter();
  const documentId = useMemo(
    () => router.searchParams.get("documentId"),
    [router.searchParams],
  );
  const sheetId = useMemo(() => {
    const _id = Number(router.searchParams.get("sheetId"));
    if (isNaN(_id)) {
      return undefined;
    }
    return _id;
  }, [router.searchParams]);
  const mappingId = useMemo(
    () => router.searchParams.get("mappingId"),
    [router.searchParams],
  );

  const hasAccess = useMemo(() => {
    if (!clientId) {
      return false;
    }
    const granted =
      typeof window !== "undefined" &&
      hasGrantedAnyScopeGoogle(credentials, ...scopes);
    return Boolean(credentials) && granted;
  }, [credentials, clientId]);
  const openDrivePicker = useCallback(() => {
    NiceModal.show(GoogleDrivePickerModal, {}).then(
      ({
        documentId,
        sheetId,
        mappingId,
      }: {
        documentId: string;
        sheetId: number;
        mappingId: string;
      }) => {
        router.push(
          `/import?documentId=${documentId}&sheetId=${sheetId}&mappingId=${mappingId}`,
        );
      },
    );
  }, [router]);
  return (
    <Box
      sx={{
        padding: { md: "20px 30px 99px 30px" },
      }}
    >
      <Grid
        container
        justifyContent="space-evenly"
        alignItems="center"
        spacing={3}
        sx={{ p: { md: 10 } }}
      >
        {clientId && (
          <Grid size={12}>
            <Login scopes={scopes} />
            {hasAccess && (
              <Button onClick={openDrivePicker}>choose file</Button>
            )}
          </Grid>
        )}
        <Grid size={12}>
          {hasAccess &&
            typeof documentId === "string" &&
            typeof sheetId === "number" &&
            typeof mappingId === "string" && (
              <GoogleSpreadSheetContainer
                documentId={documentId}
                sheetId={sheetId}
                mappingId={mappingId}
              />
            )}
        </Grid>
      </Grid>
    </Box>
  );
};

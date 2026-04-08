import MenuIcon from "@mui/icons-material/Menu";
import StorageIcon from "@mui/icons-material/Storage";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  SwipeableDrawer,
  Typography,
} from "@mui/material";
import type { SPARQLQueryType } from "@graviola/edb-core-types";
import { useAdbContext, useCrudProvider } from "@graviola/edb-state-hooks";
import { Writer } from "n3";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import YasguiSPARQLEditor from "./YasguiSPARQLEditor";
import { formatSparqlQuerySafe } from "./formatSparqlQuerySafe";
import {
  clearSparqlQueryLog,
  getSparqlQueryLogSnapshot,
  getServerSparqlQueryLogSnapshot,
  setSparqlQueryLogMaxEntries,
  setSparqlQueryLoggingEnabled,
  subscribeSparqlQueryLog,
  type SparqlQueryLogEntry,
} from "./sparqlQueryLogStore";

export type SparqlQueryDevtoolsButtonPosition =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

export type SparqlQueryDevtoolsPanelPosition =
  | "bottom"
  | "left"
  | "right"
  | "top";

export type SPARQLQueryDevtoolsProps = {
  initialIsOpen?: boolean;
  /** FAB corner (default bottom-left). */
  buttonPosition?: SparqlQueryDevtoolsButtonPosition;
  /** Drawer anchor (default bottom). */
  position?: SparqlQueryDevtoolsPanelPosition;
  maxEntries?: number;
  className?: string;
};

const queryTypeColor = (
  t: SPARQLQueryType,
):
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info" => {
  switch (t) {
    case "select":
      return "primary";
    case "construct":
      return "success";
    case "ask":
      return "warning";
    case "update":
      return "secondary";
    default:
      return "default";
  }
};

const fabSx = (pos: SparqlQueryDevtoolsButtonPosition) => {
  const base = { position: "fixed" as const, zIndex: 1400 };
  switch (pos) {
    case "bottom-left":
      return { ...base, bottom: 16, left: 16 };
    case "bottom-right":
      return { ...base, bottom: 16, right: 16 };
    case "top-left":
      return { ...base, top: 16, left: 16 };
    case "top-right":
      return { ...base, top: 16, right: 16 };
  }
};

const drawerPaperSx = (position: SparqlQueryDevtoolsPanelPosition) => {
  if (position === "bottom") {
    return { height: "50vh", borderTopLeftRadius: 8, borderTopRightRadius: 8 };
  }
  if (position === "top") {
    return {
      height: "50vh",
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    };
  }
  return { width: "min(560px, 90vw)" };
};

function datasetToTurtle(
  ds: Iterable<import("@rdfjs/types").Quad>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ format: "Turtle" });
    for (const q of ds) {
      writer.addQuad(q);
    }
    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result as string);
    });
  });
}

export const SPARQLQueryDevtools: React.FC<SPARQLQueryDevtoolsProps> = ({
  initialIsOpen = false,
  buttonPosition = "bottom-left",
  position = "bottom",
  maxEntries = 500,
  className,
}) => {
  const [open, setOpen] = useState(initialIsOpen);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [yasguiOpen, setYasguiOpen] = useState(false);
  const [yasguiMountKey, setYasguiMountKey] = useState(0);

  const entries = useSyncExternalStore(
    subscribeSparqlQueryLog,
    getSparqlQueryLogSnapshot,
    getServerSparqlQueryLogSnapshot,
  );

  const { crudOptions } = useCrudProvider();
  const { queryBuildOptions } = useAdbContext();
  const prefixes = queryBuildOptions?.prefixes;

  useEffect(() => {
    setSparqlQueryLoggingEnabled(true);
    setSparqlQueryLogMaxEntries(maxEntries);
    return () => {
      setSparqlQueryLoggingEnabled(false);
    };
  }, [maxEntries]);

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const selectedQueryDisplay = useMemo(
    () => (selected ? formatSparqlQuerySafe(selected.query) : ""),
    [selected?.id, selected?.query],
  );

  const handleDownloadTriples = useCallback(async () => {
    setMenuAnchor(null);
    if (!crudOptions?.constructFetch) return;
    const q = `CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`;
    const ds = await crudOptions.constructFetch(q, {
      queryKey: "devtools:dumpAllTriples",
    });
    const ttl = await datasetToTurtle(ds);
    const blob = new Blob([ttl], { type: "text/turtle" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all-triples-${Date.now()}.ttl`;
    a.click();
    URL.revokeObjectURL(url);
  }, [crudOptions]);

  const openYasgui = useCallback(() => {
    if (!selected) return;
    setYasguiMountKey((k) => k + 1);
    setYasguiOpen(true);
  }, [selected]);

  const yasguiContainerId = useMemo(
    () => `yasgui-sparql-devtools-${selected?.id ?? "none"}-${yasguiMountKey}`,
    [selected?.id, yasguiMountKey],
  );

  return (
    <>
      <Fab
        color="primary"
        aria-label="SPARQL query devtools"
        className={className}
        size="small"
        onClick={() => setOpen((o) => !o)}
        sx={fabSx(buttonPosition)}
      >
        <StorageIcon />
      </Fab>

      <SwipeableDrawer
        anchor={position}
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: drawerPaperSx(position) }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1,
              py: 0.5,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <IconButton
              aria-label="menu"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              size="small"
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle1" sx={{ flex: 1 }}>
              SPARQL queries
            </Typography>
            <Button size="small" onClick={() => clearSparqlQueryLog()}>
              Clear
            </Button>
            <Button size="small" onClick={() => setOpen(false)}>
              Close
            </Button>
          </Box>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem
              onClick={handleDownloadTriples}
              disabled={!crudOptions?.constructFetch}
            >
              Download all triples (CONSTRUCT)
            </MenuItem>
          </Menu>

          <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
            <Box
              sx={{
                width: "38%",
                minWidth: 120,
                borderRight: 1,
                borderColor: "divider",
                overflow: "auto",
              }}
            >
              <List dense disablePadding>
                {[...entries].reverse().map((e) => (
                  <ListItemButton
                    key={e.id}
                    selected={e.id === selectedId}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <ListItemText
                      primary={
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            flexWrap: "wrap",
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="span"
                          >
                            {new Date(e.timestamp).toLocaleTimeString()}
                          </Typography>
                          <Chip
                            size="small"
                            label={e.queryType}
                            color={queryTypeColor(e.queryType)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={e.queryKey ?? "—"}
                      secondaryTypographyProps={{
                        noWrap: true,
                        title: e.queryKey,
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>

            <Box sx={{ flex: 1, overflow: "auto", p: 1 }}>
              {selected ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {selected.durationMs.toFixed(2)} ms
                    {selected.error ? (
                      <Chip
                        size="small"
                        label={selected.error}
                        color="error"
                        sx={{ ml: 1 }}
                      />
                    ) : null}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                    Key: {selected.queryKey ?? "—"}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Box
                    component="pre"
                    sx={{
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "monospace",
                      m: 0,
                    }}
                  >
                    {selectedQueryDisplay}
                  </Box>
                  <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        void navigator.clipboard.writeText(selectedQueryDisplay)
                      }
                    >
                      Copy query
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={openYasgui}
                    >
                      Open in Yasgui
                    </Button>
                  </Box>
                </>
              ) : (
                <Typography color="text.secondary">Select a query</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </SwipeableDrawer>

      <Dialog
        open={yasguiOpen}
        onClose={() => setYasguiOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Yasgui</DialogTitle>
        <DialogContent sx={{ minHeight: 360 }}>
          {yasguiOpen && selected ? (
            <YasguiSPARQLEditor
              key={yasguiContainerId}
              containerId={yasguiContainerId}
              prefixes={prefixes}
              initialQuery={selected.query}
              sparqlCrud={crudOptions ?? null}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setYasguiOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

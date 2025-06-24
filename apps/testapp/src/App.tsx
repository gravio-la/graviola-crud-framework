import {
  Box,
  Button,
  ButtonGroup,
  Container,
  FormGroup,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CodeIcon from "@mui/icons-material/Code";
import "./App.css";
import { GenericForm } from "@graviola/semantic-json-form";
import { useState } from "react";

function App() {
  const [itemUrl, setItemUrl] = useState<string | undefined>(
    "https://www.example.org/WeldedComponent/1yjpjqkptbn",
  );
  const [inputURL, setInputURL] = useState<string>(
    "http://www.example.org/WeldedComponent/1yjpjqkptbn",
  );
  const [formData, setFormData] = useState<any>(undefined);

  const [showControls, setShowControls] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [hideForm, setHideForm] = useState(false);
  const handleHideAndShow = () => {
    setHideForm(!hideForm);
  };

  return (
    <Box sx={{ mt: 4, width: "600px" }}>
      <ButtonGroup sx={{ mb: 2 }}>
        <Button
          onClick={() => setShowControls(!showControls)}
          variant={showControls ? "contained" : "outlined"}
          startIcon={<VisibilityIcon />}
        >
          Controls
        </Button>
        <Button
          onClick={() => setShowDebug(!showDebug)}
          variant={showDebug ? "contained" : "outlined"}
          startIcon={<CodeIcon />}
        >
          Debug
        </Button>
      </ButtonGroup>

      <Paper
        sx={{
          mb: 2,
          p: 4,
          textAlign: "left",
          display: showControls ? "block" : "none",
        }}
      >
        <FormGroup
          sx={{
            display: "flex",
            flexDirection: "cloumn",
            alignItems: "center",
            gap: 2,
          }}
        >
          <TextField
            fullWidth
            label="Item URL"
            value={inputURL}
            onChange={(e) => setInputURL(e.target.value)}
          />
          <ButtonGroup variant="contained">
            <Button onClick={() => setItemUrl(inputURL)}>Load Item</Button>
            <Button onClick={() => setItemUrl(undefined)}>New Item</Button>
            <Button onClick={handleHideAndShow}>
              {hideForm ? "Show" : "Hide"} Form
            </Button>
          </ButtonGroup>
        </FormGroup>
      </Paper>

      {!hideForm ? (
        <GenericForm
          entityIRI={itemUrl}
          typeName="WeldedComponent"
          onFormDataChange={setFormData}
          wrapWithinCard={false}
        />
      ) : (
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Form is hidden
        </Typography>
      )}

      <Paper
        sx={{
          mt: 4,
          p: 2,
          textAlign: "left",
          display: showDebug ? "block" : "none",
        }}
      >
        <code>
          <pre>{formData && JSON.stringify(formData, null, 2)}</pre>
        </code>
      </Paper>
    </Box>
  );
}

export default App;

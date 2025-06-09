import { ControlProps, showAsRequired } from "@jsonforms/core";
import { withJsonFormsControlProps } from "@jsonforms/react";
import { Edit, EditOff, Image } from "@mui/icons-material";
import {
  FormControl,
  FormLabel,
  Grid,
  Hidden,
  IconButton,
} from "@mui/material";
import merge from "lodash-es/merge";
import React, { useCallback, useMemo, useState } from "react";
import rehypeExternalLinks from "rehype-external-links";
import rehypeSanitize from "rehype-sanitize";
import TurndownService from "turndown";

import MDEditor, { MDEditorMarkdown } from "./MDEditor";

type UploadedImage = {
  url: string;
  alt: string;
};

type ImageUploadOptions = {
  openImageSelectDialog?: (
    selectedText: string,
  ) => Promise<UploadedImage | null>;
  uploadImage?: (file: File) => Promise<string>;
  deleteImage?: (imageUrl: string) => Promise<void>;
};

const MarkdownTextFieldRendererComponent = (props: ControlProps) => {
  const {
    id,
    errors,
    label,
    uischema,
    visible,
    required,
    config,
    data,
    handleChange,
    path,
  } = props;
  const isValid = errors.length === 0;
  const appliedUiSchemaOptions = merge({}, config, uischema.options);
  const { openImageSelectDialog, uploadImage, deleteImage } =
    appliedUiSchemaOptions.imageUploadOptions || {};

  const [editMode, setEditMode] = useState(false);

  const handleChange_ = useCallback(
    (v?: string) => {
      handleChange(path, v || "");
    },
    [path, handleChange],
  );
  const rehypePlugins = useMemo(
    () => [[rehypeSanitize], [rehypeExternalLinks, { target: "_blank" }]],
    [],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      e.preventDefault();

      let contentToInsert = "";
      const plainText = e.clipboardData.getData("text/plain");

      // If shift key is pressed, insert as plain text by default
      if ((e as any).shiftKey) {
        contentToInsert = plainText;
      } else {
        const htmlContent = e.clipboardData.getData("text/html");

        if (htmlContent) {
          const turndownService = new TurndownService();
          const markdownContent = turndownService.turndown(htmlContent);

          if (markdownContent.trim()) {
            contentToInsert = markdownContent;
          } else {
            contentToInsert = plainText;
          }
        } else {
          contentToInsert = plainText;
        }
      }

      //insert text at cursor position
      const start = e.currentTarget.selectionStart,
        end = e.currentTarget.selectionEnd,
        text = e.currentTarget.value,
        before = text.substring(0, start),
        after = text.substring(end, text.length),
        newText = before + contentToInsert + after;
      handleChange_(newText);
    },
    [handleChange_],
  );

  // Custom command for inserting images
  const imageCommand = useMemo(() => {
    if (!openImageSelectDialog) return null;

    return {
      name: "insertImage",
      keyCommand: "insertImage",
      buttonProps: { "aria-label": "Insert image" },
      icon: <Image style={{ width: 12, height: 12 }} />,
      execute: async (state: any, api: any) => {
        try {
          const uploadedImage = await openImageSelectDialog(
            state.selectedText || "",
          );
          if (uploadedImage) {
            const imageMarkdown = `![${uploadedImage.alt}](${uploadedImage.url})`;
            api.replaceSelection(imageMarkdown);
          }
        } catch (error) {
          console.error("Failed to insert image:", error);
        }
      },
    };
  }, [openImageSelectDialog]);

  return (
    <Hidden xsUp={!visible}>
      <FormControl
        fullWidth={!appliedUiSchemaOptions.trim}
        id={id}
        sx={(theme) => ({ marginBottom: theme.spacing(2) })}
      >
        <Grid container alignItems="baseline">
          <Grid item>
            <FormLabel
              error={!isValid}
              required={showAsRequired(
                !!required,
                appliedUiSchemaOptions.hideRequiredAsterisk,
              )}
            >
              {label}
            </FormLabel>
          </Grid>
          <Grid item>
            <IconButton onClick={() => setEditMode((prev) => !prev)}>
              {editMode ? <EditOff /> : <Edit />}
            </IconButton>
          </Grid>
        </Grid>
        {editMode ? (
          <MDEditor
            textareaProps={{
              id: id + "-input",
              onPaste: handlePaste,
            }}
            value={(data || "") as string}
            onChange={handleChange_}
            previewOptions={{
              rehypePlugins: rehypePlugins as any,
            }}
            commandsFilter={(cmd) =>
              cmd?.name && /(divider|code|image|checked)/.test(cmd.name)
                ? false
                : cmd
            }
            extraCommands={imageCommand ? [imageCommand] : []}
          />
        ) : (
          <MDEditorMarkdown
            wrapperElement={{
              "data-color-mode": "light",
            }}
            source={(data || "") as string}
            rehypePlugins={rehypePlugins as any}
          />
        )}
      </FormControl>
    </Hidden>
  );
};

export const MarkdownTextFieldRenderer:
  | React.ComponentClass<any>
  | React.FunctionComponent<any> = withJsonFormsControlProps(
  MarkdownTextFieldRendererComponent,
);

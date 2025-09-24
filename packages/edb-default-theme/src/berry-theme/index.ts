import { ThemeOptions, createTheme } from "@mui/material";
export type { ThemeExtended } from "./themeType";

// assets
import { colors } from "./themes-vars";
// project imports
import componentStyleOverrides from "./compStyleOverride";
import themePalette from "./palette";
import { ThemeExtended } from "./themeType";
import themeTypography from "./typography";

let variant: "outlined" | "standard" | "filled" = "outlined";
export const getTheme = (customization: ThemeExtended["customization"]) => {
  const color = colors;

  const theme = {
    colors: color,
    heading: color.grey900,
    paper: color.paper,
    backgroundDefault: color.paper,
    background: color.primaryLight,
    darkTextPrimary: color.grey700,
    darkTextSecondary: color.grey500,
    textDark: color.grey900,
    menuSelected: color.secondaryDark,
    menuSelectedBack: color.secondaryLight,
    divider: color.grey200,
    variant,
    customization,
  } as any;

  // @ts-ignore
  const themeOptions: ThemeOptions = {
    direction: "ltr",
    palette: themePalette(theme),
    mixins: {
      toolbar: {
        minHeight: "48px",
        "@media (min-width: 600px)": {
          minHeight: "48px",
        },
      },
    },
    typography: themeTypography(theme),
  };

  const themes = createTheme(themeOptions);
  themes.components = componentStyleOverrides(theme);

  return themes;
};

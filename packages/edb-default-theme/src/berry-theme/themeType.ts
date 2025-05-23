import type { Theme } from "@mui/material/styles";

export interface ThemeExtended extends Theme {
  colors?: Partial<{
    primaryLight: string;
    primaryMain: string;
    primaryDark: string;
    secondaryLight: string;
    secondaryMain: string;
    secondaryDark: string;
    primary200: string;
    primary800: string;
    secondary200: string;
    secondary800: string;
    errorLight: string;
    errorMain: string;
    errorDark: string;
    orangeLight: string;
    orangeMain: string;
    orangeDark: string;
    warningLight: string;
    warningMain: string;
    warningDark: string;
    successLight: string;
    success200: string;
    successMain: string;
    successDark: string;
    grey50: string;
    grey300: string;
    grey500: string;
    grey400: string;
    grey700: string;
    grey100: string;
    darkLevel1: string;
    darkLevel2: string;
    darkBackground: string;
    darkPaper: string;
    darkTextPrimary: string;
    textDark: string;
  }>;
  paper: string;
  divider: string;
  textDark: string;
  menuSelected: string;
  menuSelectedBack: string;
  darkTextPrimary: string;
  darkTextSecondary: string;
  heading: string;
  backgroundDefault: string;
  background: string;
  variant?: "outlined" | "standard" | "filled";
  customization?: {
    fontFamily: string;
    borderRadius: number;
    navType: "light" | "dark";
  };
}

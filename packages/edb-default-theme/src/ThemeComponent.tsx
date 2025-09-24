// ** React Imports
// ** MUI Imports
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { ReactNode, useMemo } from "react";

import GlobalStyling from "./globalStyles";
import { getTheme } from "./berry-theme";
import { ThemeExtended } from "./berry-theme/themeType";

type Props = Partial<ThemeExtended["customization"]> & {
  children: ReactNode;
};

const themeSettings = {
  isOpen: [], // for active default menu
  defaultId: "default",
  fontFamily: "sans-serif",
  borderRadius: 3,
  opened: true,
  navType: "light",
} as const;

export const ThemeComponent = ({ children, ...customization }: Props) => {
  const themeFinal = useMemo(
    () =>
      getTheme({
        ...themeSettings,
        ...customization,
      }),
    [customization],
  );

  return (
    <ThemeProvider theme={themeFinal}>
      <CssBaseline />
      <GlobalStyles styles={() => GlobalStyling(themeFinal) as any} />
      {children}
    </ThemeProvider>
  );
};

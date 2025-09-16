import { useTheme, useMediaQuery } from "@mui/material";
import { useEffect, useState } from "react";

/**
 * A safe version of useMediaQuery that works reliably in production builds
 * and handles SSR/hydration issues properly.
 *
 * @param query - Media query string or function that takes theme and returns query string
 * @param options - Options for the media query
 * @returns boolean indicating if the media query matches
 */
export function useSafeMediaQuery(
  query: string | ((theme: any) => string),
  options?: {
    defaultMatches?: boolean;
    matchMedia?: typeof window.matchMedia;
    ssrMatchMedia?: (query: string) => { matches: boolean };
    noSsr?: boolean;
  },
): boolean {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);

  // Handle mounting state to avoid hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the actual query string
  const queryString = typeof query === "function" ? query(theme) : query;

  // Use Material-UI's useMediaQuery with safe defaults
  const matches = useMediaQuery(queryString, {
    defaultMatches: false, // Default to false to prevent hydration issues
    noSsr: true, // Disable SSR for this hook
    ...options,
  });

  // Return false during initial render to prevent hydration mismatches
  // This ensures consistent behavior between server and client
  if (!mounted) {
    return options?.defaultMatches ?? false;
  }

  return matches;
}

/**
 * Convenience hooks for common breakpoints
 */
export const useIsMobile = () =>
  useSafeMediaQuery((theme) => theme.breakpoints.down("sm"));
export const useIsTablet = () =>
  useSafeMediaQuery((theme) => theme.breakpoints.down("md"));
export const useIsDesktop = () =>
  useSafeMediaQuery((theme) => theme.breakpoints.up("md"));

/**
 * Hook that provides responsive breakpoint information
 */
export const useBreakpoints = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

  return {
    isMobile,
    isTablet,
    isDesktop,
    // Convenience flags
    isSmallScreen: isMobile,
    isMediumScreen: isTablet && !isMobile,
    isLargeScreen: isDesktop,
  };
};

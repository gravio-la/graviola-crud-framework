import { create } from "zustand";

export type FullscreenState = {
  isFullscreen: boolean;
  setFullscreen: (fullscreen: boolean | ((prev: boolean) => boolean)) => void;
  toggleFullscreen: () => void;
  exitFullscreen: () => void;
};

export const useFullscreenState = create<FullscreenState>((set, get) => ({
  isFullscreen: false,
  setFullscreen: (fullscreen) => {
    if (typeof fullscreen === "function") {
      set({ isFullscreen: fullscreen(get().isFullscreen) });
    } else {
      set({ isFullscreen: fullscreen });
    }
  },
  toggleFullscreen: () => set({ isFullscreen: !get().isFullscreen }),
  exitFullscreen: () => set({ isFullscreen: false }),
}));

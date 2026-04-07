import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig, PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { visualizer } from "rollup-plugin-visualizer";

const require = createRequire(import.meta.url);

/** Bun / monorepo installs may not place @emotion/* where esbuild resolves them from @mui/styled-engine. */
function emotionPackageRoot(name: "cache" | "serialize" | "sheet") {
  return path.dirname(require.resolve(`@emotion/${name}/package.json`));
}

function packageRoot(spec: string) {
  return path.dirname(require.resolve(`${spec}/package.json`));
}

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    // Avoid Vite's "__vite-optional-peer-dep:@emotion/react:@mui/styled-engine" stub (breaks CacheProvider).
    dedupe: ["@emotion/react", "@emotion/styled"],
    alias: {
      "@emotion/cache": emotionPackageRoot("cache"),
      "@emotion/react": packageRoot("@emotion/react"),
      "@emotion/serialize": emotionPackageRoot("serialize"),
      "@emotion/sheet": emotionPackageRoot("sheet"),
      "@emotion/styled": packageRoot("@emotion/styled"),
    },
  },
  plugins: [
    react(),
    visualizer({
      emitFile: true,
      filename: "stats.json",
      template: "raw-data",
    }) as PluginOption,
  ],
  optimizeDeps: {
    include: [
      "@emotion/cache",
      "@emotion/react",
      "@emotion/serialize",
      "@emotion/sheet",
      "@emotion/styled",
      "@mui/material",
      "@mui/styled-engine",
      "@mui/system",
    ],
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: "globalThis",
      },
      // Enable esbuild polyfill plugins
      plugins: [
        // @ts-ignore
        NodeGlobalsPolyfillPlugin({
          process: true,
        }),
      ],
    },
  },
});

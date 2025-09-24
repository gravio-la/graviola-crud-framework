import { makeConfigWithExternals } from "@graviola/edb-tsup-config/tsup.config.js";
import pkg from "./package.json";

const config = makeConfigWithExternals(pkg);
// Override the entry point to use .ts instead of .ts
config.entry = ["src/index.ts"];
export default config;

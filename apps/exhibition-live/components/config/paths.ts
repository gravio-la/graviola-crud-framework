export const BASE_IRI = "http://ontologies.slub-dresden.de/exhibition#";

export const getEnvVar: <T extends string | undefined>(
  varName: string,
  defaultValue: T,
) => T = (varName, defaultValue) => {
  const prefixes = ["NEXT_PUBLIC_", "VITE_", "STORYBOOK_"];
  try {
    const hasImportMeta =
      typeof import.meta !== "undefined" && import.meta.env !== undefined;
    const hasProcess =
      typeof process !== "undefined" && process.env !== undefined;
    for (const prefix of prefixes) {
      if (hasImportMeta) {
        return import.meta.env[prefix + varName];
      }
      if (hasProcess) {
        return process.env[prefix + varName];
      }
    }
    return defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export const PUBLIC_BASE_PATH = getEnvVar<string>("BASE_PATH", "");

/**
 * Rewrites workspace:* @graviola deps to npm semver or file: vendor tarballs.
 * Run from repo root on the split/manifestations branch after packages/ is removed.
 * Keeps workspace:* only for @slub/*.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

/** Published @graviola packages — pin to registry versions */
const NPM_VERSIONS = {
  "@graviola/async-oxigraph": "^0.2.0",
  "@graviola/data-mapping-hooks": "^1.1.8",
  "@graviola/edb-advanced-components": "^1.5.0",
  "@graviola/edb-authorities": "^0.2.4",
  "@graviola/edb-basic-components": "^1.3.0",
  "@graviola/edb-basic-renderer": "^4.0.0",
  "@graviola/edb-cli-creator": "^1.2.5",
  "@graviola/edb-core-types": "^1.3.0",
  "@graviola/edb-core-utils": "^1.4.1",
  "@graviola/edb-data-mapping": "^0.2.7",
  "@graviola/edb-debug-utils": "^1.2.2",
  "@graviola/edb-default-theme": "^1.1.2",
  "@graviola/edb-file-import": "^1.0.8",
  "@graviola/edb-global-types": "^1.2.0",
  "@graviola/edb-graph-traversal": "^1.3.2",
  "@graviola/edb-kxp-utils": "^1.1.8",
  "@graviola/edb-layout-renderer": "^1.2.0",
  "@graviola/edb-linked-data-renderer": "^4.0.1",
  "@graviola/edb-marc-to-rdf": "^1.1.5",
  "@graviola/edb-markdown-renderer": "^1.3.0",
  "@graviola/edb-state-hooks": "^1.5.0",
  "@graviola/edb-table-components": "^1.3.0",
  "@graviola/edb-ui-utils": "^0.2.6",
  "@graviola/edb-wikidata-utils": "^1.1.0",
  "@graviola/entity-finder": "^1.3.0",
  "@graviola/json-schema-prisma-utils": "^1.2.8",
  "@graviola/json-schema-utils": "^1.4.1",
  "@graviola/prisma-db-impl": "^1.5.4",
  "@graviola/remote-query-implementations": "^1.3.1",
  "@graviola/semantic-json-form": "^1.4.0",
  "@graviola/sparql-db-impl": "^1.4.0",
  "@graviola/sparql-schema": "^1.4.0",
  "@graviola/sparql-store-provider": "^4.0.0",
};

/** Vendored tarballs under vendor/graviola-packs/ (relative from apps/* and manifestation/*) */
const VENDOR_FILE = {
  "@graviola/edb-build-helper":
    "file:../../vendor/graviola-packs/graviola-edb-build-helper-0.4.4.tgz",
  "@graviola/edb-charts": "file:../../vendor/graviola-packs/graviola-edb-charts-0.3.3.tgz",
  "@graviola/edb-tsconfig": "file:../../vendor/graviola-packs/graviola-edb-tsconfig-0.1.0.tgz",
  "@graviola/edb-tsup-config":
    "file:../../vendor/graviola-packs/graviola-edb-tsup-config-1.1.0.tgz",
  "@graviola/edb-virtualized-components":
    "file:../../vendor/graviola-packs/graviola-edb-virtualized-components-1.1.4.tgz",
  "@graviola/edb-vis-timeline":
    "file:../../vendor/graviola-packs/graviola-edb-vis-timeline-1.1.4.tgz",
  "eslint-config-edb": "file:../../vendor/graviola-packs/eslint-config-edb-0.1.3.tgz",
};

const TARGET_FILES = [
  "apps/exhibition-live/package.json",
  "apps/edb-api/package.json",
  "apps/edb-cli/package.json",
  "manifestation/exhibition/package.json",
  "manifestation/kulinarik/package.json",
  "manifestation/exhibition-sparql-config/package.json",
];

function patchSection(section) {
  if (!section) return;
  for (const key of Object.keys(section)) {
    if (section[key] !== "workspace:*") continue;
    if (key.startsWith("@slub/")) continue;
    if (NPM_VERSIONS[key]) {
      section[key] = NPM_VERSIONS[key];
    } else if (VENDOR_FILE[key]) {
      section[key] = VENDOR_FILE[key];
    } else {
      throw new Error(`Unresolved workspace dep: ${key}`);
    }
  }
}

for (const rel of TARGET_FILES) {
  const fp = path.join(ROOT, rel);
  const raw = fs.readFileSync(fp, "utf8");
  const json = JSON.parse(raw);
  for (const sec of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    patchSection(json[sec]);
  }
  fs.writeFileSync(fp, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log("Patched", rel);
}

console.log("Done.");

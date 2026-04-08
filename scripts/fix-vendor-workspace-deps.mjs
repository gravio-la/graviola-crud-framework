/**
 * Replaces workspace:* in dependencies/peerDependencies of vendored tarballs with npm ranges.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.join(import.meta.dirname, "..");
const DIR = path.join(ROOT, "vendor/graviola-packs");

const RESOLVE = {
  "@graviola/edb-ui-utils": "^0.2.6",
  "@graviola/edb-core-types": "^1.3.0",
  "@graviola/edb-core-utils": "^1.4.1",
};

function patchDeps(obj) {
  if (!obj) return;
  for (const k of Object.keys(obj)) {
    if (obj[k] === "workspace:*") {
      if (RESOLVE[k]) obj[k] = RESOLVE[k];
      else throw new Error(`Unresolved workspace:* for ${k}`);
    }
  }
}

for (const name of fs.readdirSync(DIR)) {
  if (!name.endsWith(".tgz")) continue;
  const tgz = path.join(DIR, name);
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync("/tmp"), "fixws-"));
  try {
    execSync(`tar -xzf "${tgz}" -C "${tmp}"`, { stdio: "inherit" });
    const pkgDir = path.join(tmp, "package");
    const pjPath = path.join(pkgDir, "package.json");
    const pj = JSON.parse(fs.readFileSync(pjPath, "utf8"));
    patchDeps(pj.dependencies);
    patchDeps(pj.peerDependencies);
    patchDeps(pj.optionalDependencies);
    fs.writeFileSync(pjPath, JSON.stringify(pj, null, 2) + "\n", "utf8");
    fs.unlinkSync(tgz);
    execSync(`tar -czf "${tgz}" -C "${tmp}" package`, { stdio: "inherit" });
    console.log("Fixed workspace refs in", name);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

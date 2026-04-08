/**
 * Removes devDependencies from vendored .tgz files so Bun/npm does not try to
 * resolve workspace:* inside those manifests. Run from repo root.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.join(import.meta.dirname, "..");
const DIR = path.join(ROOT, "vendor/graviola-packs");

for (const name of fs.readdirSync(DIR)) {
  if (!name.endsWith(".tgz")) continue;
  const tgz = path.join(DIR, name);
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync("/tmp"), "sanitize-"));
  try {
    execSync(`tar -xzf "${tgz}" -C "${tmp}"`, { stdio: "inherit" });
    const pkgDir = path.join(tmp, "package");
    const pjPath = path.join(pkgDir, "package.json");
    const pj = JSON.parse(fs.readFileSync(pjPath, "utf8"));
    delete pj.devDependencies;
    fs.writeFileSync(pjPath, JSON.stringify(pj, null, 2) + "\n", "utf8");
    fs.unlinkSync(tgz);
    execSync(`tar -czf "${tgz}" -C "${tmp}" package`, { stdio: "inherit" });
    console.log("Sanitized", name);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

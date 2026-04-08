#!/usr/bin/env bash
# Run from monorepo root while packages/ still exists. Builds and packs unpublished
# @graviola packages into vendor/graviola-packs/ for the split/manifestations branch.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p vendor/graviola-packs

PACK_PATHS=(
  packages/build-helper
  packages/ideas/charts
  packages/tsconfig
  packages/tsup-config
  packages/virtualized-components
  packages/vis-timeline
  packages/eslint-config-edb
)

echo "Building all packages (required so tsup outputs exist before pack)..."
bun run build:packages

for rel in "${PACK_PATHS[@]}"; do
  echo "Packing $rel ..."
  (cd "$rel" && npm pack --pack-destination "$ROOT/vendor/graviola-packs")
done

echo "Sanitizing tarballs (strip devDeps, resolve workspace:* in dependencies)..."
node "$ROOT/scripts/sanitize-vendor-tarballs.mjs"
node "$ROOT/scripts/fix-vendor-workspace-deps.mjs"

echo "Done. Tarballs in vendor/graviola-packs/"
ls -la vendor/graviola-packs/

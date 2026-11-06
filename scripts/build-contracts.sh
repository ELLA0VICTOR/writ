#!/usr/bin/env bash
set -euo pipefail
node scripts/build-svg-fonts.mjs
node scripts/build-contract-media.mjs
node scripts/fetch-vendor.mjs
mkdir -p artifacts
for contract in executor owner-fixture collection adversary; do
  cargo near build non-reproducible-wasm --no-abi --manifest-path "contracts/$contract/Cargo.toml" --out-dir "$PWD/artifacts/$contract"
  artifact_name="${contract//-/_}"
  cp "artifacts/$contract/$artifact_name.wasm" "artifacts/$contract.wasm"
done

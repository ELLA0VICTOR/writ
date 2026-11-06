#!/usr/bin/env bash
set -euo pipefail
for contract in executor owner-fixture collection adversary; do
  cargo fmt --manifest-path "contracts/$contract/Cargo.toml"
done

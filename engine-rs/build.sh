#!/usr/bin/env bash
# Builds the Rust engine to WebAssembly and copies it into the app's assets.
# Needs: rust + the wasm32-unknown-unknown target (rustup target add wasm32-unknown-unknown); binaryen's wasm-opt is optional.
set -euo pipefail
cd "$(dirname "$0")"
cargo build --release
SRC=target/wasm32-unknown-unknown/release/cos_engine.wasm
DST=../app/src/main/assets/www/js/rs/engine.wasm
mkdir -p "$(dirname "$DST")"
if command -v wasm-opt >/dev/null; then wasm-opt -O3 "$SRC" -o "$DST"; else cp "$SRC" "$DST"; fi
ls -l "$DST"

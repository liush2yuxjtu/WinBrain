#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${ECC_REPO_URL:-https://github.com/affaan-m/ECC.git}"
REF="${ECC_REF:-main}"
ROOT="$(git rev-parse --show-toplevel)"
DEST="$ROOT/.codex/ecc/upstream"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --filter=blob:none --no-checkout --depth 1 --branch "$REF" "$REPO_URL" "$TMP/ECC"
git -C "$TMP/ECC" sparse-checkout init --cone
git -C "$TMP/ECC" sparse-checkout set hooks skills plugins commands agents
git -C "$TMP/ECC" checkout "$REF"

rm -rf "$DEST.new"
mkdir -p "$DEST.new"
for dir in hooks skills plugins commands agents; do
  cp -a "$TMP/ECC/$dir" "$DEST.new/$dir"
done

rm -rf "$DEST"
mv "$DEST.new" "$DEST"
git -C "$TMP/ECC" rev-parse HEAD > "$ROOT/.codex/ecc/ECC_COMMIT"
printf 'ECC %s installed at %s\n' "$(cat "$ROOT/.codex/ecc/ECC_COMMIT")" "$DEST"

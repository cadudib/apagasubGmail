#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-/opt/avancard/projetos/entrada/EXTCHROME}"
VERSION="$(node -e "console.log(require('${ROOT_DIR}/manifest.json').name.match(/V[0-9.]+/)[0])")"
ZIP_PATH="${OUT_DIR}/apagasub-${VERSION}.zip"

mkdir -p "${OUT_DIR}"
rm -f "${ZIP_PATH}"

(
  cd "${ROOT_DIR}"
  zip -r "${ZIP_PATH}" README.md manifest.json src
)

unzip -l "${ZIP_PATH}" | grep -q " manifest.json$"
echo "${ZIP_PATH}"

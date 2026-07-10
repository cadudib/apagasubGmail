#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Atualização automática indisponível: ${ROOT_DIR} não é um clone Git."
  echo "Clone o repositório nessa pasta para habilitar ./scripts/update.sh."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Atualização cancelada: existem alterações locais rastreadas nesta pasta."
  echo "Salve ou reverta essas alterações antes de atualizar."
  exit 1
fi

CURRENT_COMMIT="$(git rev-parse HEAD)"
git fetch origin main
REMOTE_COMMIT="$(git rev-parse origin/main)"

if [[ "${CURRENT_COMMIT}" == "${REMOTE_COMMIT}" ]]; then
  echo "Apaga Sub já está atualizado."
else
  git merge-base --is-ancestor "${CURRENT_COMMIT}" "${REMOTE_COMMIT}" || {
    echo "Atualização cancelada: o histórico local divergiu de origin/main."
    exit 1
  }
  git merge --ff-only "${REMOTE_COMMIT}"
fi

node --check src/popup.js
node --check src/content.js
node -e 'JSON.parse(require("fs").readFileSync("manifest.json", "utf8"))'
scripts/package.sh

VERSION="$(node -p 'require("./manifest.json").version')"
echo "Apaga Sub ${VERSION} instalado em ${ROOT_DIR}."
echo "Agora recarregue a extensão em chrome://extensions ou reinicie o Chrome."

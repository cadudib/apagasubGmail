#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/apagasub}"
PACKAGE_DIR="${PACKAGE_DIR:-/opt/avancard/projetos/entrada/EXTCHROME}"
VERSION="$(node -p "require('${ROOT_DIR}/manifest.json').version")"
PACKAGE_VERSION="V${VERSION%.*}"
PACKAGE_PATH="${PACKAGE_DIR}/apagasub-${PACKAGE_VERSION}.zip"

"${ROOT_DIR}/scripts/package.sh" "${PACKAGE_DIR}"
install -d "${WEB_ROOT}/download"
cp -a "${ROOT_DIR}/site/." "${WEB_ROOT}/"
install -m 0644 "${PACKAGE_PATH}" "${WEB_ROOT}/download/apagasub-latest.zip"
printf '{"version":"%s"}\n' "${VERSION}" > "${WEB_ROOT}/version.json"

echo "Landing publicada em ${WEB_ROOT}."
echo "Download publicado em ${WEB_ROOT}/download/apagasub-latest.zip."

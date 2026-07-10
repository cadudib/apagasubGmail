#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_SOURCE="${ROOT_DIR}/deploy/apagasub-updater.service"
UNIT_TARGET="/etc/systemd/system/apagasub-updater.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute este instalador como root."
  exit 1
fi

install -m 0644 "${UNIT_SOURCE}" "${UNIT_TARGET}"
systemctl daemon-reload
systemctl enable --now apagasub-updater.service
systemctl restart apagasub-updater.service
systemctl --no-pager --full status apagasub-updater.service

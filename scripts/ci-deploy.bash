#!/bin/bash
# Restart delphic-admin after CD downloads artifacts into DEPLOY_PATH.
# Expects: $DEPLOY_PATH/backend/delphic_admin and $DEPLOY_PATH/backend/public/
set -euo pipefail

DEPLOY_DIR="${DEPLOY_PATH:-/usr/local/delphic-admin}"
SERVICE="${SERVICE_NAME:-delphic-admin}"
BINARY="${DEPLOY_DIR}/backend/delphic_admin"
PUBLIC="${DEPLOY_DIR}/backend/public"
UNIT_SRC="$(cd "$(dirname "$0")" && pwd)/delphic-admin.service"

if [ ! -f "${BINARY}" ]; then
  echo "ERROR: missing ${BINARY}"
  exit 1
fi

if [ ! -d "${PUBLIC}" ]; then
  echo "ERROR: missing ${PUBLIC}"
  exit 1
fi

systemctl_cmd() {
  if [ "$(id -u)" -eq 0 ]; then
    systemctl "$@"
  else
    sudo systemctl "$@"
  fi
}

if ! systemctl_cmd cat "${SERVICE}.service" &>/dev/null; then
  echo "Installing systemd unit ${SERVICE}.service..."
  if [ "$(id -u)" -eq 0 ]; then
    install -m 644 "${UNIT_SRC}" "/etc/systemd/system/${SERVICE}.service"
  else
    sudo install -m 644 "${UNIT_SRC}" "/etc/systemd/system/${SERVICE}.service"
  fi
  systemctl_cmd daemon-reload
  systemctl_cmd enable "${SERVICE}"
fi

chmod 755 "${BINARY}"
systemctl_cmd restart "${SERVICE}"
echo "Done."

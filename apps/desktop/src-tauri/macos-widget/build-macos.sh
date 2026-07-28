#!/usr/bin/env bash
#
# Builds a macOS release whose DMG actually contains the widget.
#
# `tauri build` bundles the DMG from the .app before any post-processing hook can
# run, so the widget — which is embedded into the .app afterwards — would be
# missing from it. The order therefore has to be:
#
#   1. tauri build --bundles app   (app only; no DMG yet)
#   2. embed-widget.sh --dmg       (embed, re-sign, then build the DMG ourselves)
#
# `bundle.targets` stays "all" in tauri.conf.json because Windows and Linux need
# it; macOS narrows it here on the command line instead.
#
# Usage: ./build-macos.sh [extra tauri build args...]
#   e.g. ./build-macos.sh --target universal-apple-darwin

set -euo pipefail

cd "$(dirname "$0")"
WIDGET_DIR="$PWD"
APP_DIR="$(cd ../.. && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "build-macos.sh: macOS only" >&2
  exit 1
fi

cd "$APP_DIR"
pnpm tauri build --bundles app "$@"

# beforeBundleCommand already built the .appex during the step above.
bash "$WIDGET_DIR/embed-widget.sh" --dmg

bash "$WIDGET_DIR/verify-widget.sh" || {
  echo
  echo "build-macos.sh: the build is complete but verification found problems." >&2
  echo "Registration checks only pass for a copy installed in /Applications." >&2
}

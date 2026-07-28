#!/usr/bin/env bash
#
# Embeds TickrWidget.appex into a Tauri-built Tickr.app and re-signs it.
#
# Must run *after* `tauri build`, because the .app does not exist before the
# bundling phase. Adding anything to Contents/PlugIns invalidates the app's code
# seal, so the app is always re-signed last — nested code first, container after.
#
# Usage:
#   ./embed-widget.sh [/path/to/Tickr.app] [--dmg] [--optional]
#
# With --dmg, a disk image is rebuilt from the patched .app. Tauri creates its
# DMG before this script can run, so any DMG produced by `tauri build` contains a
# widget-less app and must be replaced.
#
# With --optional, a missing .appex is a warning instead of an error. build-widget.sh
# skips itself when the toolchain cannot build a widget, and a release should still
# go out in that case.

set -euo pipefail

# Resolved against the caller's directory, before the cd below changes it.
APP_PATH=""
MAKE_DMG=0
OPTIONAL=0
for arg in "$@"; do
  case "$arg" in
    --dmg) MAKE_DMG=1 ;;
    --optional) OPTIONAL=1 ;;
    /*) APP_PATH="$arg" ;;
    *) APP_PATH="$PWD/$arg" ;;
  esac
done

cd "$(dirname "$0")"
WIDGET_DIR="$PWD"
TAURI_DIR="$(cd .. && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macos-widget: not macOS, nothing to embed"
  exit 0
fi

APPEX="$WIDGET_DIR/build/Products/Release/TickrWidget.appex"
HELPER="$WIDGET_DIR/build/Products/Release/tickr-widget-refresh"
ENTITLEMENTS="$WIDGET_DIR/TickrWidget.entitlements"

if [[ ! -d "$APPEX" ]]; then
  if [[ "$OPTIONAL" == "1" ]]; then
    echo "macos-widget: no .appex built, leaving the app as-is" >&2
    exit 0
  fi
  echo "macos-widget: $APPEX not found — run build-widget.sh first" >&2
  exit 1
fi

# Newest matching bundle wins, so this works for both plain and --target builds.
if [[ -z "$APP_PATH" ]]; then
  APP_PATH="$(find "$TAURI_DIR/target" -maxdepth 4 -name 'Tickr.app' -type d 2>/dev/null \
    | xargs -I{} stat -f '%m %N' {} 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "macos-widget: could not locate Tickr.app — pass its path explicitly" >&2
  exit 1
fi

echo "macos-widget: embedding into $APP_PATH"

# Preserve whatever entitlements Tauri signed the app with; re-signing without
# them would silently strip capabilities.
APP_ENTITLEMENTS="$(mktemp -t tickr-app-entitlements).plist"
if codesign -d --entitlements "$APP_ENTITLEMENTS" --xml "$APP_PATH" 2>/dev/null \
  && [[ -s "$APP_ENTITLEMENTS" ]]; then
  echo "macos-widget: preserving existing app entitlements"
else
  rm -f "$APP_ENTITLEMENTS"
  APP_ENTITLEMENTS=""
fi

rm -rf "$APP_PATH/Contents/PlugIns/TickrWidget.appex"
mkdir -p "$APP_PATH/Contents/PlugIns"
cp -R "$APPEX" "$APP_PATH/Contents/PlugIns/"
cp -f "$HELPER" "$APP_PATH/Contents/MacOS/tickr-widget-refresh"

SIGN_IDENTITY="${APPLE_SIGNING_IDENTITY:--}"
echo "macos-widget: signing with identity '$SIGN_IDENTITY'"

# Inside out: nested code must be sealed before the container that references it.
codesign --force --sign "$SIGN_IDENTITY" \
  --entitlements "$ENTITLEMENTS" \
  "$APP_PATH/Contents/PlugIns/TickrWidget.appex"

codesign --force --sign "$SIGN_IDENTITY" \
  "$APP_PATH/Contents/MacOS/tickr-widget-refresh"

if [[ -n "$APP_ENTITLEMENTS" ]]; then
  codesign --force --sign "$SIGN_IDENTITY" --entitlements "$APP_ENTITLEMENTS" "$APP_PATH"
  rm -f "$APP_ENTITLEMENTS"
else
  codesign --force --sign "$SIGN_IDENTITY" "$APP_PATH"
fi

codesign --verify --deep --strict "$APP_PATH"
echo "macos-widget: signature verified"

if [[ "$MAKE_DMG" == "1" ]]; then
  DMG_DIR="$(dirname "$(dirname "$APP_PATH")")/dmg"
  VERSION="$(plutil -extract CFBundleShortVersionString raw "$APP_PATH/Contents/Info.plist")"
  ARCH="$(uname -m)"
  DMG_PATH="$DMG_DIR/Tickr_${VERSION}_${ARCH}.dmg"
  STAGING="$(mktemp -d)/Tickr"

  mkdir -p "$DMG_DIR" "$STAGING"
  cp -R "$APP_PATH" "$STAGING/"
  ln -s /Applications "$STAGING/Applications"

  rm -f "$DMG_PATH"
  hdiutil create -volname "Tickr" -srcfolder "$STAGING" -ov -format UDZO "$DMG_PATH" >/dev/null
  rm -rf "$(dirname "$STAGING")"
  echo "macos-widget: wrote $DMG_PATH"
fi

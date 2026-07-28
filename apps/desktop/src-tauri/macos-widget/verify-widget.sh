#!/usr/bin/env bash
#
# Checks everything about the widget that can be checked without a human looking
# at the widget gallery.
#
# The open question this answers: does an *ad-hoc signed* app extension register
# with the widget daemon, and does its sandbox actually permit reading the shared
# state file? Registration is observable via pluginkit; the sandbox decision is
# tested by signing a probe binary with the widget's own entitlements (see step 4).
#
# Registration only happens for an app in /Applications, so that copy is checked
# by default — point the script at a build directory to check layout and signing
# before installing.
#
# Usage: ./verify-widget.sh [/path/to/Tickr.app]

set -euo pipefail

# Resolved against the caller's directory, before the cd below changes it.
APP_PATH="${1:-}"
if [[ -n "$APP_PATH" && "$APP_PATH" != /* ]]; then
  APP_PATH="$PWD/$APP_PATH"
fi

cd "$(dirname "$0")"
WIDGET_DIR="$PWD"
TAURI_DIR="$(cd .. && pwd)"

if [[ -z "$APP_PATH" ]]; then
  if [[ -d /Applications/Tickr.app ]]; then
    APP_PATH=/Applications/Tickr.app
  else
    APP_PATH="$(find "$TAURI_DIR/target" -maxdepth 4 -name 'Tickr.app' -type d 2>/dev/null | head -1)"
  fi
fi

STATE_FILE="$HOME/Library/Application Support/Tickr/widget-state.json"
APPEX="$APP_PATH/Contents/PlugIns/TickrWidget.appex"
ENTITLEMENTS_FILE="$WIDGET_DIR/TickrWidget.entitlements"
BUNDLE_ID="app.tickr.desktop.TickrWidget"
failures=0

pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; failures=$((failures + 1)); }
info() { printf '  --    %s\n' "$1"; }

echo "Tickr widget verification"
echo "  app:   ${APP_PATH:-<not found>}"
echo "  state: $STATE_FILE"
echo

echo "1. Bundle layout"
if [[ -d "$APPEX" ]]; then
  pass "TickrWidget.appex is embedded"
else
  fail "TickrWidget.appex missing from Contents/PlugIns"
fi
if [[ -x "$APP_PATH/Contents/MacOS/tickr-widget-refresh" ]]; then
  pass "tickr-widget-refresh helper present"
else
  fail "tickr-widget-refresh helper missing from Contents/MacOS"
fi
if [[ -d "$APPEX" ]]; then
  point="$(plutil -extract NSExtension.NSExtensionPointIdentifier raw "$APPEX/Contents/Info.plist" 2>/dev/null || echo '')"
  if [[ "$point" == "com.apple.widgetkit-extension" ]]; then
    pass "extension point is com.apple.widgetkit-extension"
  else
    fail "unexpected extension point: ${point:-<none>}"
  fi
fi
echo

echo "2. Code signature"
if codesign --verify --deep --strict "$APP_PATH" 2>/dev/null; then
  pass "app signature valid (nested code included)"
else
  fail "app signature invalid — re-run embed-widget.sh"
fi
# Output is captured before matching rather than piped into `grep -q`: with
# `pipefail`, grep exiting on its first match sends SIGPIPE upstream and the whole
# pipeline reports failure even though the match succeeded.
appex_entitlements="$(codesign -d --entitlements - --xml "$APPEX" 2>/dev/null | plutil -convert xml1 -o - - 2>/dev/null || true)"
if [[ "$appex_entitlements" == *'temporary-exception.files.home-relative-path.read-only'* ]]; then
  pass "appex carries the read-only temporary exception"
else
  fail "appex is missing the sandbox temporary exception"
fi
appex_signature="$(codesign -dv "$APPEX" 2>&1 || true)"
if [[ "$appex_signature" == *'Signature=adhoc'* ]]; then
  info "appex is ad-hoc signed (no Team ID — App Groups would not work here)"
else
  info "appex is signed with a real identity"
fi
echo

echo "3. Shared state file"
if [[ -f "$STATE_FILE" ]]; then
  pass "state file exists"
  if plutil -lint "$STATE_FILE" >/dev/null 2>&1 || python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$STATE_FILE" 2>/dev/null; then
    pass "state file is valid JSON"
  else
    fail "state file is not valid JSON"
  fi
else
  info "state file not written yet — launch Tickr and start a timer"
fi
echo

echo "4. Sandbox read decision"
# Builds a throwaway probe, signs it ad-hoc with the widget's *own* entitlements
# file, and has it read the state file the same way the widget does. This is the
# only faithful test: `sandbox-exec` with a hand-written profile cannot stand in
# for it, because a profile strict enough to be meaningful also stops the process
# from launching (dyld needs far more than file reads), which reads as a denial
# whether or not the exception works.
#
# An embedded Info.plist is required — without a CFBundleIdentifier the sandbox
# has no container to assign and the process is killed at launch.
if [[ ! -f "$STATE_FILE" ]]; then
  info "skipped: no state file to read"
elif ! command -v cc >/dev/null 2>&1; then
  info "skipped: no C compiler"
else
  PROBE_DIR="$(mktemp -d -t tickr-probe)"
  cat > "$PROBE_DIR/probe.c" <<'PROBE_EOF'
#include <pwd.h>
#include <stdio.h>
#include <unistd.h>

/* Resolves the real home like WidgetState.swift: inside the sandbox
   NSHomeDirectory()/$HOME point at the container, not at /Users/<you>. */
int main(void) {
  struct passwd *pw = getpwuid(getuid());
  if (!pw || !pw->pw_dir) return 2;
  char path[4096];
  snprintf(path, sizeof(path),
           "%s/Library/Application Support/Tickr/widget-state.json", pw->pw_dir);
  FILE *f = fopen(path, "r");
  if (!f) return 1;
  fclose(f);
  return 0;
}
PROBE_EOF
  cat > "$PROBE_DIR/Info.plist" <<'PROBE_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key><string>app.tickr.desktop.sandboxprobe</string>
	<key>CFBundleName</key><string>TickrSandboxProbe</string>
	<key>CFBundleVersion</key><string>1</string>
</dict>
</plist>
PROBE_EOF
  if cc -o "$PROBE_DIR/probe" "$PROBE_DIR/probe.c" \
       -sectcreate __TEXT __info_plist "$PROBE_DIR/Info.plist" 2>/dev/null \
     && codesign --force --sign - \
       --identifier app.tickr.desktop.sandboxprobe \
       --entitlements "$ENTITLEMENTS_FILE" "$PROBE_DIR/probe" 2>/dev/null; then
    if "$PROBE_DIR/probe" 2>/dev/null; then
      pass "a sandboxed process reads the state file with these entitlements"
    else
      fail "sandboxed read denied — try the absolute-path exception on /Users/Shared"
    fi
  else
    info "skipped: could not build the probe"
  fi
  rm -rf "$PROBE_DIR"
fi
echo

echo "5. WidgetKit registration"
if ! command -v pluginkit >/dev/null 2>&1; then
  info "pluginkit unavailable"
elif [[ "$APP_PATH" != /Applications/* ]]; then
  # Registration is a property of the installed copy, so a build directory can
  # never satisfy it. Reporting a failure here would be misleading.
  info "not applicable: only an app in /Applications is offered to the widget daemon"
else
  registered="$(pluginkit -mAvvv -p com.apple.widgetkit-extension 2>/dev/null || true)"
  if [[ "$registered" == *"$BUNDLE_ID"* ]]; then
    pass "registered with the widget daemon as $BUNDLE_ID"
  else
    fail "not registered — launch the app once, or run lsregister -f on it"
    info "watch the daemon's reasoning: log stream --predicate 'process == \"chronod\"'"
  fi
fi
echo

echo "6. Shipped DMG"
# What lands in the DMG is what users get. Tauri builds its DMG before the widget
# can be embedded, so this catches the case where the DMG was not rebuilt
# afterwards and silently ships a widget-less app.
DMG_PATH="$(find "$(dirname "$(dirname "$APP_PATH")")/dmg" -maxdepth 1 -name '*.dmg' 2>/dev/null | head -1 || true)"
if [[ -z "$DMG_PATH" ]]; then
  info "no DMG next to this .app — skipped"
else
  echo "  ($(basename "$DMG_PATH"))"
  MNT="$(mktemp -d)"
  if hdiutil attach "$DMG_PATH" -mountpoint "$MNT" -nobrowse -readonly >/dev/null 2>&1; then
    if [[ -d "$MNT/Tickr.app/Contents/PlugIns/TickrWidget.appex" ]]; then
      pass "DMG's app contains the widget"
    else
      fail "DMG's app has no widget — rebuild it with embed-widget.sh --dmg"
    fi
    if codesign --verify --deep --strict "$MNT/Tickr.app" 2>/dev/null; then
      pass "DMG's app signature valid"
    else
      fail "DMG's app signature invalid"
    fi
    hdiutil detach "$MNT" >/dev/null 2>&1 || true
  else
    info "could not mount the DMG — skipped"
  fi
  rmdir "$MNT" 2>/dev/null || true
fi
echo

if [[ "$failures" -gt 0 ]]; then
  echo "$failures check(s) failed."
  exit 1
fi

echo "All automated checks passed."
echo "Remaining manual step: right-click the desktop, Edit Widgets, and add Tickr."

#!/usr/bin/env bash
#
# Builds TickrWidget.appex and the tickr-widget-refresh helper.
#
# Runs from tauri.conf.json's beforeBundleCommand, so it must be a no-op on any
# platform or machine that cannot build it. A missing Xcode means no widget, not
# a failed release.
#
# Products land in macos-widget/build/Products/Release/ for embed-widget.sh.

set -euo pipefail

cd "$(dirname "$0")"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macos-widget: not macOS, skipping widget build"
  exit 0
fi

if [[ "${TICKR_SKIP_WIDGET:-0}" == "1" ]]; then
  echo "macos-widget: TICKR_SKIP_WIDGET=1, skipping widget build"
  exit 0
fi

if ! command -v xcodebuild >/dev/null 2>&1 || ! xcodebuild -version >/dev/null 2>&1; then
  echo "macos-widget: no usable Xcode toolchain, skipping widget build" >&2
  exit 0
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "macos-widget: xcodegen not found (brew install xcodegen), skipping widget build" >&2
  exit 0
fi

BUILD_DIR="$PWD/build"

# Match the architecture Tauri is building. Cargo's target triple is the most
# reliable signal during a `tauri build --target ...`; otherwise build both so a
# universal .app gets a universal widget.
ARCHS_ARG=()
case "${CARGO_BUILD_TARGET:-${TICKR_TARGET_TRIPLE:-}}" in
  aarch64-apple-darwin) ARCHS_ARG=(ARCHS=arm64) ;;
  x86_64-apple-darwin) ARCHS_ARG=(ARCHS=x86_64) ;;
  *) ARCHS_ARG=(ARCHS="arm64 x86_64") ;;
esac

echo "macos-widget: generating Xcode project"
xcodegen generate --quiet

# xcodebuild chatters about unrelated simulator problems on some machines, so its
# output is captured and only shown when something actually goes wrong. The status
# is taken from xcodebuild itself, not from a pipeline — a filter that drops every
# line exits non-zero and would look like a build failure.
LOG="$(mktemp -t tickr-widget-build)"
trap 'rm -f "$LOG"' EXIT

NOISE='CoreSimulator|DVTErrorPresenter|iOSSimulator|SimServiceContext|IDERunDestination|Recovery Suggestion|Failure Reason|^Domain:|^Code:|^--$|matching destinations|platform:macOS'

for scheme in TickrWidget tickr-widget-refresh; do
  echo "macos-widget: building $scheme"
  status=0
  xcodebuild \
    -project TickrWidget.xcodeproj \
    -scheme "$scheme" \
    -configuration Release \
    -derivedDataPath "$BUILD_DIR" \
    CONFIGURATION_BUILD_DIR="$BUILD_DIR/Products/Release" \
    "${ARCHS_ARG[@]}" \
    ONLY_ACTIVE_ARCH=NO \
    CODE_SIGNING_ALLOWED=NO \
    build \
    -quiet >"$LOG" 2>&1 || status=$?

  if [[ "$status" -ne 0 ]]; then
    # An Xcode too old for the widget's deployment target must not take the whole
    # release down with it — the app is perfectly usable without a widget.
    echo "macos-widget: $scheme failed to build — continuing without a widget" >&2
    grep -Ev "$NOISE" "$LOG" >&2 || true
    exit 0
  fi
done

APPEX="$BUILD_DIR/Products/Release/TickrWidget.appex"
HELPER="$BUILD_DIR/Products/Release/tickr-widget-refresh"

for artifact in "$APPEX" "$HELPER"; do
  if [[ ! -e "$artifact" ]]; then
    echo "macos-widget: expected artifact missing: $artifact" >&2
    exit 1
  fi
done

echo "macos-widget: built $APPEX"
echo "macos-widget: built $HELPER"

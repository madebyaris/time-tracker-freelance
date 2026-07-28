# ttf-007 — Widget feasibility spike

**Status:** complete — proven viable
**Date:** 2026-07-28
**Environment:** macOS 26.6 (25G72), Xcode 26.6, Apple Silicon

## Question

Tickr has no Apple Developer Program membership, so builds are ad-hoc signed
(`APPLE_SIGNING_IDENTITY: '-'`). A macOS widget must ship as a sandboxed
`.appex`, and the conventional way for it to read the host app's data is an App
Group — which is keyed on a Team ID that only Apple can issue.

Two things had to be true before committing to ttf-008:

1. Does an **ad-hoc signed** `.appex` register with the widget daemon at all?
2. Can that sandboxed extension **read** a file the non-sandboxed app writes to
   `~/Library/Application Support/Tickr/`, via a temporary-exception
   entitlement instead of an App Group?

## Answer: yes to both

`macos-widget/verify-widget.sh` automates the evidence. All checks pass against
an ad-hoc signed `/Applications/Tickr.app`:

```
2. Code signature
  ok    appex carries the read-only temporary exception
  --    appex is ad-hoc signed (no Team ID — App Groups would not work here)
4. Sandbox read decision
  ok    a sandboxed process reads the state file with these entitlements
5. WidgetKit registration
  ok    registered with the widget daemon as app.tickr.desktop.TickrWidget
```

### 1. Registration works ad-hoc

After `ditto`-ing the bundle to `/Applications` and running `lsregister -f`:

```
app.tickr.desktop.TickrWidget(0.5.0)
   Path = /Applications/Tickr.app/Contents/PlugIns/TickrWidget.appex
   Parent Bundle = /Applications/Tickr.app
   Platform = macOS
```

No Developer ID involved. The `.appex` bundle identifier must be prefixed by the
host app's (`app.tickr.desktop` → `app.tickr.desktop.TickrWidget`) or PlugInKit
ignores it.

### 2. The temporary exception grants the read

Tested with a probe binary signed ad-hoc using the widget's own
`TickrWidget.entitlements`, with a control differing only in entitlements:

| Signing | Entitlements | Read of `widget-state.json` |
|---|---|---|
| ad-hoc (`-`) | sandbox + `temporary-exception.files.home-relative-path.read-only` | **succeeded** |
| ad-hoc (`-`) | sandbox only | `NSPOSIXErrorDomain 1 "Operation not permitted"` |

The exception is doing the work, not some ambient permission. Temporary
exceptions need no provisioning profile, so ad-hoc signing is sufficient.

The `/Users/Shared` absolute-path fallback and the free-Personal-Team + App
Group fallback are both **not needed**.

## Confirmed gotchas

- **`NSHomeDirectory()` is useless inside the sandbox.** It returned
  `/Users/aris/Library/Containers/app.tickr.desktop.sandboxprobe/Data`, not
  `/Users/aris`. The real home must come from `getpwuid(getuid())->pw_dir`;
  `$HOME` is redirected too. `WidgetState.swift` does this.
- **A sandboxed binary needs a bundle identifier.** A standalone executable with
  no embedded `Info.plist` is killed at launch (SIGTRAP, exit 133) because the
  sandbox has no container to assign it.
- **`sandbox-exec` cannot be used to test this.** A hand-written profile strict
  enough to be meaningful (`deny default`) also prevents the process from
  launching — dyld needs far more than file reads — so it reports a denial
  whether or not the exception works. The first version of check 4 made exactly
  this mistake and produced a false negative. Only a signed binary carrying the
  real entitlements is a valid test.
- **Read-only means read-only.** The widget cannot write back, so v1 is
  display-only. An interactive Start/Stop `AppIntent` would need a writable
  channel, which this approach does not provide.
- **Widgets only appear in the picker from `/Applications`.** The dev loop is
  build → embed → install → relaunch, which is slower than normal Tauri work.

## Consequences for ttf-008

- Keep the app **non-sandboxed** (it writes the state file) and the widget
  sandboxed with the read-only exception. Do not add App Groups.
- Signing and distribution are unchanged: ad-hoc, unnotarized, with the
  Gatekeeper workaround in `docs/install-unsigned.md`. Released builds get a
  working widget, not just local ones.
- Widget v1 is display-only. Interactivity is deferred, not merely gated on
  macOS 14.

## Artifacts

Kept rather than thrown away, since they are the ttf-008 foundation:

- `macos-widget/project.yml` — xcodegen definition (`.appex` + refresh helper)
- `macos-widget/Sources/Shared/WidgetState.swift` — state contract, real-home resolution
- `macos-widget/Sources/Widget/TickrWidget.swift` — SwiftUI views and timeline provider
- `macos-widget/TickrWidget.entitlements` — the proven entitlements
- `macos-widget/build-widget.sh`, `embed-widget.sh`, `verify-widget.sh`
- `src-tauri/src/widget.rs` — snapshot writer and reload trigger

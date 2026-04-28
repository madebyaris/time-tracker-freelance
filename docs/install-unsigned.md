# Installing Tickr (Unsigned Builds)

The Tickr installers published through GitHub Releases are **not signed by an
Apple Developer ID** and **not signed by an EV certificate on Windows**.
Signing certificates cost money and are not part of this open-source build.
That means macOS Gatekeeper and Windows SmartScreen will warn you the first
time you launch the app. The instructions below explain how to allow Tickr to
run.

The app and installers are still ad-hoc signed (macOS) or use the Tauri
`nsis` installer (Windows), so they're tamper-evident — Gatekeeper / SmartScreen
just don't recognize the signature.

---

## macOS

Tickr is shipped as a `.dmg` and `.app.tar.gz` for both Apple Silicon
(`aarch64`) and Intel (`x86_64`).

### Recommended: right-click → Open

1. Download the `.dmg` matching your Mac (Apple Silicon or Intel).
2. Open it and drag **Tickr.app** into **Applications**.
3. In Finder, open the **Applications** folder.
4. **Right-click** (or Control-click) **Tickr.app** → choose **Open**.
5. macOS will warn the app is from an unidentified developer. Click **Open**.

You only need to do this once. After that, double-clicking works normally.

### If macOS refuses to open it at all

On newer macOS versions (14+), Gatekeeper sometimes blocks the right-click
trick with a message like *"Tickr.app is damaged and can't be opened"* or
*"Apple could not verify Tickr.app is free of malware"*. Strip the quarantine
attribute and try again:

```bash
xattr -cr /Applications/Tickr.app
```

Then double-click Tickr normally.

### Why this happens

Apple charges \$99/year for the Developer ID certificate and notarization
service that suppresses Gatekeeper warnings. The CI builds skip that step and
sign with the ad-hoc identity (`codesign --sign -`), which is enough to run
locally but not enough for Gatekeeper's "Apple notarized" check.

---

## Windows

Tickr ships as both an MSI and an NSIS `.exe` installer.

1. Download the `.msi` (recommended) or `.exe`.
2. Double-click to run.
3. Windows SmartScreen will show *"Windows protected your PC"*.
4. Click **More info** → **Run anyway**.

You only need to confirm once per installer.

If SmartScreen still blocks it after **More info**, right-click the file →
**Properties** → check **Unblock** at the bottom → **OK**, then run it again.

---

## Linux

Tickr ships as `.deb` (Debian/Ubuntu), `.rpm` (Fedora/openSUSE), and
`.AppImage` (any distro).

### Debian / Ubuntu

```bash
sudo dpkg -i Tickr_<version>_amd64.deb
sudo apt-get -f install   # only if dpkg complains about missing deps
```

### Fedora / openSUSE

```bash
sudo rpm -i Tickr-<version>-1.x86_64.rpm
```

### AppImage (any distro)

```bash
chmod +x Tickr_<version>_amd64.AppImage
./Tickr_<version>_amd64.AppImage
```

You can also drop the AppImage into `~/.local/bin` or wire it up with
[AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) for menu
integration.

Linux builds depend on the system WebKitGTK runtime. On a fresh distro you
may need to install it once:

```bash
# Ubuntu / Debian
sudo apt-get install libwebkit2gtk-4.1-0 libgtk-3-0 librsvg2-2

# Fedora
sudo dnf install webkit2gtk4.1 gtk3 librsvg2
```

---

## Building Locally Instead

If you don't trust the unsigned binaries, you can build Tickr yourself in a
few minutes — see the **Run From Source** section in the
[main README](../README.md).

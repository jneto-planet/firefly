# Firefly v1.1.0

## ✨ New Features

### Firmware Update
- New **Firmware** page to apply firmware `.zip` packages via drag-and-drop or file picker.
- Validates the package `manifest.xml` (label must match the file name) and previews the bundles to be installed.
- Per-bundle **MD5 verification** before installing.
- **Downgrade detection** — prompts to update anyway (clean reinstall) or skip individual APKs.
- Handles device **reboots** mid-update: waits for the device to come back online and continues automatically.

### OPI Simulator
- New **OPI Simulator** launcher, configurable via a path in Settings (same as Butterfly / Proxy Tool).

### Software Section Redesign
- The Software list is now a set of clickable **cards** (3-column grid) showing each tool's icon and name.
- Click a card to launch; cards open Settings when not yet configured.
- Logger Client shows its **settings gear** on hover.

## 🐛 Fixes & Improvements
- The **"No connected device"** warning is no longer shown while a firmware update reboot is in progress.
- After a reboot that drops the ADB connection mid-install, the app now **verifies the installed version** instead of falsely reporting an install failure.
- Project restructured: the app now lives at the repository root, with legacy code moved to `deprecated/`.

## 📦 Downloads
- **macOS (Apple Silicon):** `firefly-1.1.0.dmg`
- **Windows (x64 / arm64):** `firefly-1.1.0-setup.exe`

**Full changelog:** v1.0.11...v1.1.0

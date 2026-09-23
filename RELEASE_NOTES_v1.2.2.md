# Firefly v1.2.2

## ✨ New Features

### Wi-Fi Toggle
The connected device's Wi-Fi radio can now be switched on and off directly from Firefly.

- A **Wi-Fi button** lives in the device card, right under the device details.
- The icon reflects the **live radio state** — `Wi-Fi` when enabled, `Wi-Fi off` when disabled — and is read from the device on every refresh.
- Clicking it **enables or disables the radio** and then **re-confirms the state against the device** a moment later, so the icon always matches reality rather than just the last click.
- A pulsing indicator shows while the change is in flight, and the button is disabled when the state can't be determined (for example, on a device that doesn't report it).
- Failures are surfaced in the status bar instead of failing silently.

## 🎨 Improvements

### Device Actions Moved Into the Device Card
- **Reboot Device** has moved out of the *Adb Actions* row and now sits next to the new Wi-Fi toggle in a dedicated **device actions row** inside the device card.
- Both actions are grouped under a subtle divider, keeping device-level controls together and separate from the ADB tooling below.
- The *Adb Actions* row is now less crowded as a result.

## 📦 Downloads
- **macOS (Apple Silicon):** `firefly-1.2.2.dmg`
- **Windows (x64 / arm64):** `firefly-1.2.2-setup.exe`

**Full changelog:** v1.2.1...v1.2.2

# Firefly

> Desktop application for managing Android payment terminals — built with Electron, React and TypeScript.

Firefly is an internal tool developed by the **Planet Payment Development Team (JNE)** that provides a unified interface to manage PAX Android terminals. It bundles ADB and scrcpy so no external tooling is required on the host machine.

---

## Features

| Tab | Description |
|-----|-------------|
| **Configuration** | Pull, edit and push XML config files (`3cixml`) directly from/to the connected device |
| **Logcat** | Real-time Android log stream with level filtering, app-only toggle and full-text search |
| **Apps** | List all / third-party packages, install APKs and uninstall apps on the device |
| **Video Generator** | Assemble a sequence of images into a video using bundled ffmpeg |
| **Accessibility Converter** | Apply color inversion or color-correction (protanomaly matrix) to images |

Additional capabilities:
- **Multi-device** support — switch between connected devices from the sidebar
- **Screen mirroring** via scrcpy (no driver installation needed)
- **Screenshots** captured directly from the toolbar
- **Logger Client** integration with configurable launch parameters
- **Auto-updater** powered by `electron-updater`

---

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop shell
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — UI
- [electron-vite](https://electron-vite.org/) — build tooling
- [Tailwind CSS v4](https://tailwindcss.com/) — styling
- [Framer Motion](https://www.framer.com/motion/) — animations
- [electron-builder](https://www.electron.build/) — packaging & distribution
- Bundled **ADB** and **ffmpeg** (no host dependencies required in production)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- npm ≥ 9

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

### Type checking

```bash
npm run typecheck
```

### Run tests

```bash
npm test
```

---

## Building

| Command | Output |
|---------|--------|
| `npm run build:mac` | macOS `.dmg` / `.zip` |
| `npm run build:win` | Windows `.exe` installer |
| `npm run build:linux` | Linux AppImage |
| `npm run build:unpack` | Unpacked directory (all platforms) |

### Publishing a release

```bash
# All platforms
npm run release

# Platform-specific
npm run release:mac
npm run release:win
npm run release:linux
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FIREFLY_DISABLE_GPU=1` | Force-disable hardware acceleration (useful on macOS if you encounter GPU rendering issues) |

---

## Project Structure

```
src/
  main/         # Electron main process (ADB, IPC, updater, config)
  preload/      # Context-bridge API exposed to the renderer
  renderer/     # React application
    components/ # Feature panels and dialogs
    lib/        # Utilities (device icons, app cache)
    types/      # Shared TypeScript types
resources/
  ffmpeg/       # Bundled ffmpeg binaries
  platform-tools/
    darwin/     # Bundled ADB + scrcpy for macOS
    windows/    # Bundled ADB + scrcpy for Windows
```

---

## License

Internal use only — Planet Payment / JNE Development Team.

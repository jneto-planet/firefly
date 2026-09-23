# Firefly v1.2.1

## ✨ New Features

### Files — Device File Explorer
A new **Files** entry under *Adb Actions* brings an Android Studio–style device file explorer to Firefly.

- **Browse** the device filesystem with folder, file and symlink entries showing size, permissions and modification time.
- **Download** any file or folder to your computer through a native save dialog.
- **Upload** one or more files into the folder you're currently viewing.
- **Delete** files and folders, with a confirmation dialog that warns when a folder's contents will be removed.
- **Search** to filter the current folder as you type.
- **Refresh** to re-read the current folder on demand.
- **Navigation** via clickable breadcrumbs, an *up one level* button, and a typable path field.
- **Shortcuts** for **Root** (`/`) and **IntegraTE** (`/data/data/com.cccintegra.pax`), plus a **+** button to save your own shortcuts — these persist between sessions.

**Access to protected folders.** Firefly now escalates the same way Android Studio does — plain shell, then `run-as <package>` for app-private storage, then root. Because `/data` and `/data/data` are traversable but not readable by the shell user, their contents are derived from the package manager and directory probes instead, so app data directories stay browsable on non-rooted devices. Uploads and downloads into app-private storage are routed through the same privileged path.

### In-App Update Button
Users no longer have to open Settings to discover that a new version exists.

- Firefly **checks for updates automatically** shortly after launch and every 6 hours.
- When an update is found, an **Update button appears next to the Settings icon** in the sidebar.
- Clicking it **downloads the update with live progress** and **restarts into the new version** automatically.
- Update checks no longer interrupt you with native pop-up dialogs.

## 📦 Downloads
- **macOS (Apple Silicon):** `firefly-1.2.1.dmg`
- **Windows (x64 / arm64):** `firefly-1.2.1-setup.exe`

**Full changelog:** v1.1.1...v1.2.1
